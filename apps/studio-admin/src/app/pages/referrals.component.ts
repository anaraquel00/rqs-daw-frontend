import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AdminApiService,
  ReferralRecord,
  ReferralSummary,
} from '../core/admin-api.service';
import { AdminSeoService } from '../core/admin-seo.service';

@Component({
  selector: 'rqs-admin-referrals',
  standalone: true,
  template: `
    <section class="page-heading">
      <p>GROWTH / FOUNDING REFERRALS</p>
      <h1>REFERRAL INTELLIGENCE</h1>
      <span>Operational referral signals with masked codes and no referrer identity exposed.</span>
    </section>

    @if (summaryLoading()) {
      <div class="state" aria-live="polite">AGGREGATING REFERRALS…</div>
    } @else if (summaryFailed()) {
      <div class="state error" role="alert">REFERRAL SUMMARY API UNAVAILABLE. NO DATA WAS CHANGED.</div>
    } @else if (summary(); as data) {
      <section class="metrics referral" aria-label="Referral aggregate metrics">
        <article><span>PARTICIPANTS</span><strong>{{ data.total }}</strong><small>FOUNDING REFERRAL</small></article>
        <article><span>ACTIVE</span><strong>{{ data.active }}</strong><small>PARTICIPANTS</small></article>
        <article><span>ATTRIBUTED WAITLIST</span><strong>{{ data.attributedWaitlist }}</strong><small>WAITLIST RECORDS</small></article>
      </section>
      <p class="generated">GENERATED {{ data.generatedAt }}</p>
    }

    <section class="records-section" aria-label="Referral records">
      <div class="records-heading">
        <div>
          <p>READ-ONLY RECORDS</p>
          <h2>FOUNDING REFERRAL PARTICIPANTS</h2>
        </div>
        <span>PAGE {{ pageNumber() }} · MAX 25 RECORDS</span>
      </div>

      <div class="filters referrals" aria-label="Referral filters">
        <label>
          <span>STATUS</span>
          <select [value]="status()" (change)="status.set(selectValue($event)); applyFilters()">
            <option value="">ALL</option>
            <option value="active">ACTIVE</option>
            <option value="unknown">UNKNOWN / LEGACY</option>
          </select>
        </label>

        <label class="campaign-filter">
          <span>CAMPAIGN ID</span>
          <input
            type="text"
            maxlength="80"
            [value]="campaignId()"
            (input)="campaignId.set(inputValue($event))"
            (keyup.enter)="applyFilters()"
            placeholder="founding-2026"
          />
        </label>

        <button type="button" class="secondary" (click)="applyFilters()">APPLY FILTERS</button>
        <button type="button" class="secondary" (click)="resetFilters()">RESET FILTERS</button>
      </div>

      @if (recordsLoading()) {
        <div class="state" aria-live="polite">LOADING REFERRAL RECORDS…</div>
      } @else if (recordsFailed()) {
        <div class="state error" role="alert">REFERRAL RECORDS API UNAVAILABLE. NO DATA WAS CHANGED.</div>
      } @else if (records().length === 0) {
        <div class="state">EMPTY DATASET FOR CURRENT FILTERS</div>
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>CODE</th>
                <th>CAMPAIGN</th>
                <th>STATUS</th>
                <th>REFERRED</th>
                <th>PENDING</th>
                <th>QUALIFIED</th>
                <th>DISCOUNT</th>
                <th>CREATED</th>
              </tr>
            </thead>
            <tbody>
              @for (record of records(); track record.id) {
                <tr>
                  <td><strong>{{ record.maskedReferralCode }}</strong><small>MASKED</small></td>
                  <td>{{ record.campaignId }}</td>
                  <td>{{ displayKnown(record.status) }}</td>
                  <td>{{ record.referredCount }}</td>
                  <td>{{ record.pendingCount }}</td>
                  <td>{{ record.qualifiedCount }}</td>
                  <td>{{ record.discountPercent }}%</td>
                  <td>{{ displayDate(record.createdAt) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <div class="pagination">
        <button type="button" class="secondary" (click)="previousPage()" [disabled]="cursorHistory().length === 0 || recordsLoading()">PREVIOUS</button>
        <span>PAGE {{ pageNumber() }}</span>
        <button type="button" class="secondary" (click)="nextPage()" [disabled]="!nextCursor() || recordsLoading()">NEXT</button>
      </div>
    </section>
  `,
  styleUrl: './dashboard.component.scss',
})
export class ReferralsComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly summaryLoading = signal(true);
  readonly summaryFailed = signal(false);
  readonly summary = signal<ReferralSummary | null>(null);

  readonly recordsLoading = signal(true);
  readonly recordsFailed = signal(false);
  readonly records = signal<ReferralRecord[]>([]);
  readonly nextCursor = signal<string | null>(null);
  readonly currentCursor = signal<string | null>(null);
  readonly cursorHistory = signal<Array<string | null>>([]);

  readonly status = signal('');
  readonly campaignId = signal('');

  constructor(seo: AdminSeoService) {
    seo.setCanonical('/referrals');
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([this.loadSummary(), this.loadRecords(null)]);
  }

  async applyFilters(): Promise<void> {
    this.cursorHistory.set([]);
    await this.loadRecords(null);
  }

  async resetFilters(): Promise<void> {
    this.status.set('');
    this.campaignId.set('');
    this.cursorHistory.set([]);
    await this.loadRecords(null);
  }

  async nextPage(): Promise<void> {
    const next = this.nextCursor();
    if (!next || this.recordsLoading()) return;
    this.cursorHistory.update(history => [...history, this.currentCursor()]);
    await this.loadRecords(next);
  }

  async previousPage(): Promise<void> {
    const history = this.cursorHistory();
    if (history.length === 0 || this.recordsLoading()) return;
    const previous = history.at(-1) ?? null;
    this.cursorHistory.set(history.slice(0, -1));
    await this.loadRecords(previous);
  }

  pageNumber(): number {
    return this.cursorHistory().length + 1;
  }

  selectValue(event: Event): string {
    return (event.target as HTMLSelectElement).value;
  }

  inputValue(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  displayKnown(value: string): string {
    return value === 'unknown' ? 'UNKNOWN / LEGACY' : value.toUpperCase();
  }

  displayDate(value: string | null): string {
    return value || 'UNKNOWN / LEGACY';
  }

  private async loadSummary(): Promise<void> {
    this.summaryLoading.set(true);
    this.summaryFailed.set(false);
    try {
      this.summary.set(await this.api.referralSummary());
    } catch {
      this.summaryFailed.set(true);
    } finally {
      this.summaryLoading.set(false);
    }
  }

  private async loadRecords(cursor: string | null): Promise<void> {
    this.recordsLoading.set(true);
    this.recordsFailed.set(false);
    try {
      const page = await this.api.referralRecords({
        limit: 25,
        cursor,
        status: this.status(),
        campaignId: this.campaignId().trim(),
      });
      this.records.set(page.records);
      this.nextCursor.set(page.nextCursor);
      this.currentCursor.set(cursor);
    } catch {
      this.recordsFailed.set(true);
      this.records.set([]);
      this.nextCursor.set(null);
    } finally {
      this.recordsLoading.set(false);
    }
  }
}
