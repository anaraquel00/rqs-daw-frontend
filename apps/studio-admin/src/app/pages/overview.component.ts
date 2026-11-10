import { Component, OnInit, inject, signal } from '@angular/core';
import { AdminApiService, AdminOverview } from '../core/admin-api.service';
import { AdminSeoService } from '../core/admin-seo.service';

@Component({
  selector: 'rqs-admin-overview',
  standalone: true,
  template: `
    <section class="page-heading">
      <p>OBSERVABILITY / OVERVIEW</p>
      <h1>CONTROL SURFACE</h1>
      <span>Aggregated operational intelligence. Read-only by design.</span>
    </section>

    @if (loading()) {
      <div class="state" aria-live="polite">LOADING ADMIN TELEMETRY…</div>
    } @else if (failed()) {
      <div class="state error" role="alert">ADMIN API UNAVAILABLE. NO DATA WAS CHANGED.</div>
    } @else if (overview(); as data) {
      <section class="metrics" aria-label="Admin overview metrics">
        <article>
          <span>WAITLIST</span>
          <strong>{{ data.waitlistTotal }}</strong>
          <small>TOTAL ENTRIES</small>
        </article>
        <article>
          <span>FOUNDING REFERRALS</span>
          <strong>{{ data.foundingReferralParticipants }}</strong>
          <small>PARTICIPANTS</small>
        </article>
        <article>
          <span>ACTIVE REFERRALS</span>
          <strong>{{ data.activeFoundingReferralParticipants }}</strong>
          <small>ACTIVE PARTICIPANTS</small>
        </article>
        <article>
          <span>ATTRIBUTED WAITLIST</span>
          <strong>{{ data.referralAttributedWaitlist }}</strong>
          <small>REFERRAL SIGNAL</small>
        </article>
        <article>
          <span>ADMIN STATUS</span>
          <strong class="text-value">ACTIVE</strong>
          <small>OWNER VERIFIED</small>
        </article>
        <article>
          <span>SYSTEM STATUS</span>
          <strong class="text-value ok">ONLINE</strong>
          <small>READ-ONLY API</small>
        </article>
      </section>

      <section class="breakdowns" aria-label="Operational breakdowns">
        <div class="breakdown-panel">
          <div class="section-title">
            <span>PLAN INTEREST</span>
            <small>WAITLIST BREAKDOWN</small>
          </div>
          <dl>
            <div><dt>MASTER</dt><dd>{{ data.byPlanInterest.master }}</dd></div>
            <div><dt>PLUS</dt><dd>{{ data.byPlanInterest.plus }}</dd></div>
            <div><dt>PRO</dt><dd>{{ data.byPlanInterest.pro }}</dd></div>
            <div><dt>UNDECIDED</dt><dd>{{ data.byPlanInterest.undecided }}</dd></div>
            <div><dt>UNKNOWN / LEGACY</dt><dd>{{ data.byPlanInterest.unknown }}</dd></div>
          </dl>
        </div>

        <div class="breakdown-panel">
          <div class="section-title">
            <span>LANGUAGE</span>
            <small>KNOWN LOCALES</small>
          </div>
          <dl>
            <div><dt>PT</dt><dd>{{ data.byLanguage.pt }}</dd></div>
            <div><dt>EN</dt><dd>{{ data.byLanguage.en }}</dd></div>
            <div><dt>PL</dt><dd>{{ data.byLanguage.pl }}</dd></div>
            <div><dt>FR</dt><dd>{{ data.byLanguage.fr }}</dd></div>
            <div><dt>UNKNOWN / LEGACY</dt><dd>{{ data.byLanguage.unknown }}</dd></div>
          </dl>
        </div>
      </section>

      <p class="generated">GENERATED {{ data.generatedAt }}</p>
    }
  `,
  styleUrl: './dashboard.component.scss',
})
export class OverviewComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly overview = signal<AdminOverview | null>(null);

  constructor(seo: AdminSeoService) {
    seo.setCanonical('/');
  }

  async ngOnInit(): Promise<void> {
    try {
      this.overview.set(await this.api.overview());
    } catch {
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }
}
