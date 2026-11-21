import {
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';

import {
  AdminApiService,
  UsageRecord,
} from '../core/admin-api.service';

import {
  AdminSeoService,
} from '../core/admin-seo.service';

@Component({
  selector: 'rqs-admin-usage',
  standalone: true,
  template: `
    <section class="page-heading">
      <p>SUPABASE / PRODUCT USAGE</p>
      <h1>USAGE OBSERVABILITY</h1>
      <span>
        Read-only quota telemetry from the same canonical MASTER,
        PITCH, BUILD and UPLINK quota engines used by RQS Studio.
      </span>
    </section>

    <section
      class="records-section"
      aria-label="Product usage records"
    >
      <div class="records-heading">
        <div>
          <p>READ-ONLY PRODUCT USAGE</p>
          <h2>QUOTA CONTROL VIEW</h2>
        </div>

        <span>
          PAGE {{ pageNumber() }} · MAX 25 RECORDS
        </span>
      </div>

      <div
        class="filters referrals"
        aria-label="Usage filters"
      >
        <label>
          <span>PLAN</span>

          <select
            [value]="plan()"
            (change)="
              plan.set(selectValue($event));
              applyFilters()
            "
          >
            <option value="">ALL</option>
            <option value="free">FREE</option>
            <option value="master">MASTER</option>
            <option value="plus">PLUS</option>
            <option value="pro">PRO</option>
            <option value="unknown">
              UNKNOWN / NO PROFILE
            </option>
          </select>
        </label>

        <button
          type="button"
          class="secondary"
          (click)="resetFilters()"
        >
          RESET FILTERS
        </button>
      </div>

      @if (loading()) {
        <div
          class="state"
          aria-live="polite"
        >
          LOADING PRODUCT USAGE…
        </div>
      } @else if (failed()) {
        <div
          class="state error"
          role="alert"
        >
          PRODUCT USAGE API UNAVAILABLE.
          NO DATA WAS CHANGED.
        </div>
      } @else if (records().length === 0) {
        <div class="state">
          EMPTY DATASET FOR CURRENT FILTERS
        </div>
      } @else {
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>REF</th>
                <th>MASKED CONTACT</th>
                <th>PLAN</th>
                <th>MASTER</th>
                <th>PITCH</th>
                <th>BUILD PROJECTS</th>
                <th>BUILD STORAGE</th>
                <th>UPLINK</th>
              </tr>
            </thead>

            <tbody>
              @for (
                record of records();
                track record.identityRef
              ) {
                <tr>
                  <td>
                    <strong>
                      {{ record.identityRef }}
                    </strong>
                    <small>ANONYMIZED REF</small>
                  </td>

                  <td>
                    <strong>
                      {{ record.maskedEmail }}
                    </strong>
                    <small>MASKED</small>
                  </td>

                  <td>
                    {{ displayKnown(record.plan) }}
                  </td>

                  <td>
                    <strong>
                      {{
                        displayCounter(
                          record.master.used,
                          record.master.limit
                        )
                      }}
                    </strong>
                    <small>
                      {{
                        quotaDetail(
                          record.master.reserved,
                          record.master.period,
                          record.master.periodKey
                        )
                      }}
                    </small>
                    <small>
                      {{
                        availability(
                          record.master.available
                        )
                      }}
                    </small>
                  </td>

                  <td>
                    <strong>
                      {{
                        displayCounter(
                          record.pitch.used,
                          record.pitch.limit
                        )
                      }}
                    </strong>
                    <small>
                      {{
                        quotaDetail(
                          record.pitch.reserved,
                          record.pitch.period,
                          record.pitch.periodKey
                        )
                      }}
                    </small>
                    <small>
                      {{
                        availability(
                          record.pitch.available
                        )
                      }}
                    </small>
                  </td>

                  <td>
                    <strong>
                      {{
                        displayCounter(
                          record.build.projects.used,
                          record.build.projects.limit
                        )
                      }}
                    </strong>
                    <small>
                      REMAINING
                      {{
                        displayValue(
                          record.build.projects.remaining
                        )
                      }}
                    </small>
                    <small>
                      {{
                        availability(
                          record.build.projects.available
                        )
                      }}
                    </small>
                  </td>

                  <td>
                    <strong>
                      {{
                        storageUsage(record)
                      }}
                    </strong>
                    <small>
                      CONFIRMED
                      {{
                        formatBytes(
                          record.build.storage.confirmedBytes
                        )
                      }}
                      · RESERVED
                      {{
                        formatBytes(
                          record.build.storage.reservedBytes
                        )
                      }}
                    </small>
                    <small>
                      {{
                        availability(
                          record.build.storage.available
                        )
                      }}
                    </small>
                  </td>

                  <td>
                    <strong>
                      {{
                        uplinkActiveUsage(record)
                      }}
                    </strong>
                    <small>
                      {{
                        availability(
                          record.uplink.active.available
                        )
                      }}
                    </small>
                    <small>
                      {{
                        uplinkClickUsage(record)
                      }}
                    </small>
                    <small>
                      {{
                        uplinkClickDetail(record)
                      }}
                    </small>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <div class="pagination">
        <button
          type="button"
          class="secondary"
          (click)="previousPage()"
          [disabled]="
            cursorHistory().length === 0 ||
            loading()
          "
        >
          PREVIOUS
        </button>

        <span>
          PAGE {{ pageNumber() }}
        </span>

        <button
          type="button"
          class="secondary"
          (click)="nextPage()"
          [disabled]="
            !nextCursor() ||
            loading()
          "
        >
          NEXT
        </button>
      </div>
    </section>
  `,
  styleUrl: './dashboard.component.scss',
})
export class UsageComponent
implements OnInit {
  private readonly api =
    inject(AdminApiService);

  readonly loading =
    signal(true);

  readonly failed =
    signal(false);

  readonly records =
    signal<UsageRecord[]>([]);

  readonly nextCursor =
    signal<string | null>(null);

  readonly currentCursor =
    signal<string | null>(null);

  readonly cursorHistory =
    signal<Array<string | null>>([]);

  readonly plan =
    signal('');

  constructor(
    seo: AdminSeoService,
  ) {
    seo.setCanonical(
      '/usage',
    );
  }

  async ngOnInit(): Promise<void> {
    await this.loadRecords(null);
  }

  async applyFilters(): Promise<void> {
    this.cursorHistory.set([]);
    await this.loadRecords(null);
  }

  async resetFilters(): Promise<void> {
    this.plan.set('');
    this.cursorHistory.set([]);
    await this.loadRecords(null);
  }

  async nextPage(): Promise<void> {
    const next =
      this.nextCursor();

    if (
      !next ||
      this.loading()
    ) {
      return;
    }

    this.cursorHistory.update(
      history => [
        ...history,
        this.currentCursor(),
      ],
    );

    await this.loadRecords(next);
  }

  async previousPage(): Promise<void> {
    const history =
      this.cursorHistory();

    if (
      history.length === 0 ||
      this.loading()
    ) {
      return;
    }

    const previous =
      history.at(-1) ??
      null;

    this.cursorHistory.set(
      history.slice(0, -1),
    );

    await this.loadRecords(
      previous,
    );
  }

  pageNumber(): number {
    return (
      this.cursorHistory().length +
      1
    );
  }

  selectValue(
    event: Event,
  ): string {
    return (event.target as HTMLSelectElement).value;
  }

  displayKnown(
    value: string,
  ): string {
    const normalized =
      String(value || '')
        .trim();

    return (
      !normalized ||
      normalized === 'unknown'
    )
      ? 'UNKNOWN'
      : normalized.toUpperCase();
  }

  displayValue(
    value: number | null,
  ): string {
    return value === null
      ? 'N/A'
      : String(value);
  }

  displayCounter(
    used: number | null,
    limit: number | null,
  ): string {
    if (
      used === null ||
      limit === null
    ) {
      return 'N/A';
    }

    return `${used} / ${limit}`;
  }

  availability(
    value: boolean | null,
  ): string {
    if (value === null) {
      return 'N/A';
    }

    return value
      ? 'AVAILABLE'
      : 'EXHAUSTED';
  }

  quotaDetail(
    reserved: number | null,
    period: string | null,
    periodKey: string | null,
  ): string {
    if (
      reserved === null ||
      period === null
    ) {
      return 'N/A';
    }

    const key =
      periodKey
        ? ` · ${periodKey.toUpperCase()}`
        : '';

    return (
      `${reserved} RESERVED · ` +
      `${period.toUpperCase()}` +
      key
    );
  }


  uplinkActiveUsage(
    record: UsageRecord,
  ): string {
    const active =
      record.uplink.active;

    if (active.used === null) {
      return 'ACTIVE N/A';
    }

    if (active.unlimited === true) {
      return `ACTIVE ${active.used} / ∞`;
    }

    if (active.limit === null) {
      return 'ACTIVE N/A';
    }

    return (
      `ACTIVE ${active.used} / ` +
      `${active.limit}`
    );
  }

  uplinkClickUsage(
    record: UsageRecord,
  ): string {
    const clicks =
      record.uplink.clicks;

    if (
      clicks.used === null ||
      clicks.limit === null
    ) {
      return 'CLICKS N/A';
    }

    return (
      `CLICKS ${clicks.used} / ` +
      `${clicks.limit}`
    );
  }

  uplinkClickDetail(
    record: UsageRecord,
  ): string {
    const clicks =
      record.uplink.clicks;

    if (clicks.period === null) {
      return 'N/A';
    }

    const key =
      clicks.periodKey
        ? ` · ${clicks.periodKey.toUpperCase()}`
        : '';

    return (
      `${clicks.period.toUpperCase()}` +
      key +
      ` · ${this.availability(clicks.available)}`
    );
  }

  storageUsage(
    record: UsageRecord,
  ): string {
    const used =
      record.build.storage.usedBytes;

    const limit =
      record.build.storage.limitBytes;

    if (
      used === null ||
      limit === null
    ) {
      return 'N/A';
    }

    return (
      `${this.formatBytes(used)} / ` +
      `${this.formatBytes(limit)}`
    );
  }

  formatBytes(
    value: number | null,
  ): string {
    if (value === null) {
      return 'N/A';
    }

    if (value === 0) {
      return '0 B';
    }

    const gib =
      1024 ** 3;

    const mib =
      1024 ** 2;

    if (value >= gib) {
      const result =
        value / gib;

      return (
        Number.isInteger(result)
          ? result.toFixed(0)
          : result.toFixed(1)
      ) + ' GiB';
    }

    if (value >= mib) {
      return (
        value / mib
      ).toFixed(1) + ' MiB';
    }

    return `${value} B`;
  }

  private async loadRecords(
    cursor: string | null,
  ): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);

    try {
      const page =
        await this.api.usageRecords({
          limit: 25,
          cursor,
          plan: this.plan(),
        });

      this.records.set(
        page.records,
      );

      this.nextCursor.set(
        page.nextCursor,
      );

      this.currentCursor.set(
        cursor,
      );
    } catch {
      this.failed.set(true);
      this.records.set([]);
      this.nextCursor.set(null);
    } finally {
      this.loading.set(false);
    }
  }
}
