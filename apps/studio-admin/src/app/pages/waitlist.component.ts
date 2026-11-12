import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AdminActionsConfig,
  AdminApiService,
  WaitlistRecord,
  WaitlistSummary,
} from '../core/admin-api.service';
import { AdminSeoService } from '../core/admin-seo.service';
import { ReviewActionControlComponent } from '../components/review-action-control.component';

@Component({
  selector: 'rqs-admin-waitlist',
  standalone: true,
  imports: [ReviewActionControlComponent],
  template: `
    <section class="page-heading">
      <p>GROWTH / WAITLIST</p>
      <h1>WAITLIST INTELLIGENCE</h1>
      <span>Bounded operational records with masked contact identity. Read-only by design.</span>
    </section>

    @if (summaryLoading()) {
      <div class="state" aria-live="polite">AGGREGATING WAITLIST…</div>
    } @else if (summaryFailed()) {
      <div class="state error" role="alert">WAITLIST SUMMARY API UNAVAILABLE. NO DATA WAS CHANGED.</div>
    } @else if (summary(); as data) {
      <section class="metrics waitlist" aria-label="Waitlist aggregate metrics">
        <article class="total"><span>TOTAL ENTRIES</span><strong>{{ data.total }}</strong><small>PRO_WAITLIST</small></article>
        <article><span>MASTER</span><strong>{{ data.byPlanInterest.master }}</strong><small>PLAN INTEREST</small></article>
        <article><span>PLUS</span><strong>{{ data.byPlanInterest.plus }}</strong><small>PLAN INTEREST</small></article>
        <article><span>PRO</span><strong>{{ data.byPlanInterest.pro }}</strong><small>PLAN INTEREST</small></article>
        <article><span>UNDECIDED</span><strong>{{ data.byPlanInterest.undecided }}</strong><small>EXPLICIT</small></article>
        <article><span>UNKNOWN</span><strong>{{ data.byPlanInterest.unknown }}</strong><small>LEGACY / UNSET</small></article>
      </section>
      <p class="generated">GENERATED {{ data.generatedAt }}</p>
    }

    <section class="records-section" aria-label="Waitlist records">
      <div class="records-heading">
        <div>
          <p>READ-ONLY RECORDS</p>
          <h2>MASKED WAITLIST VIEW</h2>
        </div>
        <span>PAGE {{ pageNumber() }} · MAX 25 RECORDS</span>
      </div>

      <div class="filters" aria-label="Waitlist filters">
        <label>
          <span>PLAN</span>
          <select [value]="planInterest()" (change)="planInterest.set(selectValue($event)); applyFilters()">
            <option value="">ALL</option>
            <option value="master">MASTER</option>
            <option value="plus">PLUS</option>
            <option value="pro">PRO</option>
            <option value="undecided">UNDECIDED</option>
            <option value="unknown">UNKNOWN / LEGACY</option>
          </select>
        </label>

        <label>
          <span>STATUS</span>
          <select [value]="status()" (change)="status.set(selectValue($event)); applyFilters()">
            <option value="">ALL</option>
            <option value="waiting">WAITING</option>
            <option value="unknown">UNKNOWN / LEGACY</option>
          </select>
        </label>

        <label>
          <span>LANGUAGE</span>
          <select [value]="language()" (change)="language.set(selectValue($event)); applyFilters()">
            <option value="">ALL</option>
            <option value="pt">PT</option>
            <option value="en">EN</option>
            <option value="pl">PL</option>
            <option value="fr">FR</option>
            <option value="unknown">UNKNOWN / LEGACY</option>
          </select>
        </label>

        <label>
          <span>REFERRAL</span>
          <select [value]="referralAttributed()" (change)="referralAttributed.set(selectValue($event)); applyFilters()">
            <option value="">ALL</option>
            <option value="true">ATTRIBUTED</option>
            <option value="false">NOT ATTRIBUTED</option>
          </select>
        </label>

        <button type="button" class="secondary" (click)="resetFilters()">RESET FILTERS</button>
      </div>

      @if (recordsLoading()) {
        <div class="state" aria-live="polite">LOADING MASKED RECORDS…</div>
      } @else if (recordsFailed()) {
        <div class="state error" role="alert">WAITLIST RECORDS API UNAVAILABLE. NO DATA WAS CHANGED.</div>
      } @else if (records().length === 0) {
        <div class="state">EMPTY DATASET FOR CURRENT FILTERS</div>
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>MASKED CONTACT</th>
                <th>PLAN</th>
                <th>STATUS</th>
                <th>LANG</th>
                <th>SOURCE</th>
                <th>REFERRAL</th>
                <th>CREATED</th>
                @if (actionsConfig()?.enabled) {
                  <th>REVIEW</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (record of records(); track record.id) {
                <tr>
                  <td><strong>{{ record.maskedEmail }}</strong><small>MASKED</small></td>
                  <td>{{ displayKnown(record.planInterest) }}</td>
                  <td>{{ displayKnown(record.status) }}</td>
                  <td>{{ displayKnown(record.language) }}</td>
                  <td>{{ record.source }}</td>
                  <td>
                    {{ record.referralAttributed ? 'YES' : 'NO' }}
                    @if (record.referralAttributed) {
                      <small>{{ displayKnown(record.referralStatus) }}</small>
                    }
                  </td>
                  <td>{{ displayDate(record.createdAt) }}</td>
                  @if (actionsConfig()?.enabled) {
                    <td>
                      <rqs-review-action-control
                        targetKind="waitlist"
                        [targetId]="record.id"
                        [targetLabel]="record.maskedEmail"
                      />
                    </td>
                  }
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
export class WaitlistComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly summaryLoading = signal(true);
  readonly summaryFailed = signal(false);
  readonly summary = signal<WaitlistSummary | null>(null);

  readonly recordsLoading = signal(true);
  readonly recordsFailed = signal(false);
  readonly records = signal<WaitlistRecord[]>([]);
  readonly nextCursor = signal<string | null>(null);
  readonly currentCursor = signal<string | null>(null);
  readonly cursorHistory = signal<Array<string | null>>([]);

  readonly planInterest = signal('');
  readonly status = signal('');
  readonly language = signal('');
  readonly referralAttributed = signal('');

  readonly actionsConfig =
    signal<AdminActionsConfig | null>(null);

  constructor(seo: AdminSeoService) {
    seo.setCanonical('/waitlist');
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.loadSummary(),
      this.loadRecords(null),
      this.loadActionsConfig(),
    ]);
  }

  async applyFilters(): Promise<void> {
    this.cursorHistory.set([]);
    await this.loadRecords(null);
  }

  async resetFilters(): Promise<void> {
    this.planInterest.set('');
    this.status.set('');
    this.language.set('');
    this.referralAttributed.set('');
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

  displayKnown(value: string): string {
    return value === 'unknown' ? 'UNKNOWN / LEGACY' : value.toUpperCase();
  }

  displayDate(value: string | null): string {
    return value || 'UNKNOWN / LEGACY';
  }

  private async loadActionsConfig(): Promise<void> {
    try {
      this.actionsConfig.set(
        await this.api.actionsConfig(),
      );
    } catch {
      this.actionsConfig.set(null);
    }
  }

  private async loadSummary(): Promise<void> {
    this.summaryLoading.set(true);
    this.summaryFailed.set(false);
    try {
      this.summary.set(await this.api.waitlistSummary());
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
      const page = await this.api.waitlistRecords({
        limit: 25,
        cursor,
        planInterest: this.planInterest(),
        status: this.status(),
        language: this.language(),
        referralAttributed: this.referralAttributed(),
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
