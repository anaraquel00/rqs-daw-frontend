import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AdminApiService,
  EntitlementPlan,
  IdentityRecord,
  IdentitySummary,
} from '../core/admin-api.service';
import { AdminSeoService } from '../core/admin-seo.service';

@Component({
  selector: 'rqs-admin-identity',
  standalone: true,
  template: `
    <section class="page-heading">
      <p>SUPABASE / IDENTITY & ENTITLEMENTS</p>
      <h1>IDENTITY CONTROL</h1>
      <span>
        Auth users are the canonical identities. Commercial entitlements are resolved from
        profiles.rqs_plan and the reviewed RQS plan catalog. Read-only by design.
      </span>
    </section>

    @if (summaryLoading()) {
      <div class="state" aria-live="polite">LOADING IDENTITY TELEMETRY…</div>
    } @else if (summaryFailed()) {
      <div class="state error" role="alert">IDENTITY SUMMARY API UNAVAILABLE. NO DATA WAS CHANGED.</div>
    } @else if (summary(); as data) {
      <section class="metrics" aria-label="Identity metrics">
        <article>
          <span>AUTH USERS</span>
          <strong>{{ data.totalUsers }}</strong>
          <small>CANONICAL IDENTITIES</small>
        </article>
        <article>
          <span>ACTIVE</span>
          <strong>{{ data.activeUsers }}</strong>
          <small>CONFIRMED / NOT BANNED</small>
        </article>
        <article>
          <span>CONFIRMED</span>
          <strong>{{ data.confirmedUsers }}</strong>
          <small>AUTH CONFIRMED</small>
        </article>
        <article>
          <span>UNCONFIRMED</span>
          <strong>{{ data.unconfirmedUsers }}</strong>
          <small>AUTH PENDING</small>
        </article>
        <article>
          <span>AUTH WITHOUT PROFILE</span>
          <strong>{{ data.authWithoutProfile }}</strong>
          <small>DATA QUALITY</small>
        </article>
        <article>
          <span>ORPHAN PROFILES</span>
          <strong>{{ data.profilesWithoutAuth }}</strong>
          <small>PROFILE WITHOUT AUTH USER</small>
        </article>
      </section>

      <section class="breakdowns" aria-label="Plan distribution">
        <div class="breakdown-panel">
          <div class="section-title">
            <span>PLAN ASSIGNMENT</span>
            <small>AUTH-BACKED USERS ONLY</small>
          </div>
          <dl>
            <div><dt>FREE</dt><dd>{{ data.byPlan.free }}</dd></div>
            <div><dt>MASTER</dt><dd>{{ data.byPlan.master }}</dd></div>
            <div><dt>PLUS</dt><dd>{{ data.byPlan.plus }}</dd></div>
            <div><dt>PRO</dt><dd>{{ data.byPlan.pro }}</dd></div>
            <div><dt>UNKNOWN / NO PROFILE</dt><dd>{{ data.byPlan.unknown }}</dd></div>
          </dl>
        </div>

        <div class="breakdown-panel">
          <div class="section-title">
            <span>BOUNDARY</span>
            <small>CANONICAL SOURCES</small>
          </div>
          <dl>
            <div><dt>IDENTITY</dt><dd>auth.users</dd></div>
            <div><dt>PLAN ASSIGNMENT</dt><dd>profiles.rqs_plan</dd></div>
            <div><dt>ENTITLEMENTS</dt><dd>rqs_plan_entitlements</dd></div>
            <div><dt>ADMIN RBAC</dt><dd>studio_admin_memberships</dd></div>
          </dl>
        </div>
      </section>

      <p class="generated">GENERATED {{ data.generatedAt }}</p>
    }

    <section class="records-section" aria-label="Identity records">
      <div class="records-heading">
        <div>
          <p>READ-ONLY IDENTITIES</p>
          <h2>MASKED USER VIEW</h2>
        </div>
        <span>PAGE {{ pageNumber() }} · MAX 25 RECORDS</span>
      </div>

      <div class="filters referrals" aria-label="Identity filters">
        <label>
          <span>PLAN</span>
          <select [value]="plan()" (change)="plan.set(selectValue($event)); applyFilters()">
            <option value="">ALL</option>
            <option value="free">FREE</option>
            <option value="master">MASTER</option>
            <option value="plus">PLUS</option>
            <option value="pro">PRO</option>
            <option value="unknown">UNKNOWN / NO PROFILE</option>
          </select>
        </label>

        <label>
          <span>AUTH STATUS</span>
          <select [value]="status()" (change)="status.set(selectValue($event)); applyFilters()">
            <option value="">ALL</option>
            <option value="active">ACTIVE</option>
            <option value="unconfirmed">UNCONFIRMED</option>
            <option value="banned">BANNED</option>
            <option value="deleted">DELETED</option>
            <option value="anonymous">ANONYMOUS</option>
          </select>
        </label>

        <button type="button" class="secondary" (click)="resetFilters()">RESET FILTERS</button>
      </div>

      @if (recordsLoading()) {
        <div class="state" aria-live="polite">LOADING MASKED IDENTITIES…</div>
      } @else if (recordsFailed()) {
        <div class="state error" role="alert">IDENTITY RECORDS API UNAVAILABLE. NO DATA WAS CHANGED.</div>
      } @else if (records().length === 0) {
        <div class="state">EMPTY DATASET FOR CURRENT FILTERS</div>
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>REF</th>
                <th>MASKED CONTACT</th>
                <th>STATUS</th>
                <th>PROVIDER</th>
                <th>PLAN</th>
                <th>MASTER</th>
                <th>PITCH</th>
                <th>BUILD</th>
                <th>CREATED</th>
                <th>LAST SIGN-IN</th>
              </tr>
            </thead>
            <tbody>
              @for (record of records(); track record.identityRef) {
                <tr>
                  <td><strong>{{ record.identityRef }}</strong><small>ANONYMIZED REF</small></td>
                  <td><strong>{{ record.maskedEmail }}</strong><small>MASKED</small></td>
                  <td>{{ displayKnown(record.authStatus) }}</td>
                  <td>{{ displayKnown(record.provider) }}</td>
                  <td>{{ displayKnown(record.plan) }}</td>
                  <td>{{ displayLimit(record.entitlements.fullMasterLimit) }}</td>
                  <td>{{ displayLimit(record.entitlements.spotifyPitchLimit) }}</td>
                  <td>{{ displayLimit(record.entitlements.buildProjectLimit) }}</td>
                  <td>{{ displayDate(record.createdAt) }}</td>
                  <td>{{ displayDate(record.lastSignInAt) }}</td>
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

    <section class="records-section" aria-label="Entitlement catalog">
      <div class="records-heading">
        <div>
          <p>READ-ONLY ENTITLEMENTS</p>
          <h2>PLAN CATALOG</h2>
        </div>
        <span>CANONICAL LIMITS</span>
      </div>

      @if (catalogLoading()) {
        <div class="state" aria-live="polite">LOADING PLAN ENTITLEMENTS…</div>
      } @else if (catalogFailed()) {
        <div class="state error" role="alert">ENTITLEMENT CATALOG API UNAVAILABLE. NO DATA WAS CHANGED.</div>
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>PLAN</th>
                <th>PERIOD</th>
                <th>FULL MASTER</th>
                <th>SPOTIFY PITCH</th>
                <th>BUILD PROJECTS</th>
                <th>BUILD STORAGE</th>
              </tr>
            </thead>
            <tbody>
              @for (item of catalog(); track item.plan) {
                <tr>
                  <td><strong>{{ item.plan.toUpperCase() }}</strong></td>
                  <td>{{ item.period.toUpperCase() }}</td>
                  <td>{{ item.fullMasterLimit }}</td>
                  <td>{{ item.spotifyPitchLimit }}</td>
                  <td>{{ item.buildProjectLimit }}</td>
                  <td>{{ storageGiB(item) }} GiB</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
  styleUrl: './dashboard.component.scss',
})
export class IdentityComponent implements OnInit {
  private readonly api = inject(AdminApiService);

  readonly summaryLoading = signal(true);
  readonly summaryFailed = signal(false);
  readonly summary = signal<IdentitySummary | null>(null);

  readonly recordsLoading = signal(true);
  readonly recordsFailed = signal(false);
  readonly records = signal<IdentityRecord[]>([]);
  readonly nextCursor = signal<string | null>(null);
  readonly currentCursor = signal<string | null>(null);
  readonly cursorHistory = signal<Array<string | null>>([]);

  readonly catalogLoading = signal(true);
  readonly catalogFailed = signal(false);
  readonly catalog = signal<EntitlementPlan[]>([]);

  readonly plan = signal('');
  readonly status = signal('');

  constructor(seo: AdminSeoService) {
    seo.setCanonical('/identity');
  }

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.loadSummary(),
      this.loadRecords(null),
      this.loadCatalog(),
    ]);
  }

  async applyFilters(): Promise<void> {
    this.cursorHistory.set([]);
    await this.loadRecords(null);
  }

  async resetFilters(): Promise<void> {
    this.plan.set('');
    this.status.set('');
    this.cursorHistory.set([]);
    await this.loadRecords(null);
  }

  async nextPage(): Promise<void> {
    const next = this.nextCursor();
    if (!next || this.recordsLoading()) return;

    this.cursorHistory.update(
      history => [...history, this.currentCursor()],
    );

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
    const normalized = String(value || '').trim();
    return !normalized || normalized === 'unknown'
      ? 'UNKNOWN'
      : normalized.toUpperCase();
  }

  displayDate(value: string | null): string {
    return value || 'NEVER / UNKNOWN';
  }

  displayLimit(value: number | null): string {
    return value === null ? 'N/A' : String(value);
  }

  storageGiB(item: EntitlementPlan): string {
    return (
      item.buildStorageBytesLimit /
      (1024 ** 3)
    ).toFixed(0);
  }

  private async loadSummary(): Promise<void> {
    this.summaryLoading.set(true);
    this.summaryFailed.set(false);

    try {
      this.summary.set(
        await this.api.identitySummary(),
      );
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
      const page = await this.api.identityRecords({
        limit: 25,
        cursor,
        plan: this.plan(),
        status: this.status(),
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

  private async loadCatalog(): Promise<void> {
    this.catalogLoading.set(true);
    this.catalogFailed.set(false);

    try {
      const response =
        await this.api.entitlementCatalog();

      this.catalog.set(
        response.plans,
      );
    } catch {
      this.catalogFailed.set(true);
      this.catalog.set([]);
    } finally {
      this.catalogLoading.set(false);
    }
  }
}
