import { Component, OnInit, inject, signal } from '@angular/core';
import { AdminApiService, WaitlistSummary } from '../core/admin-api.service';
import { AdminSeoService } from '../core/admin-seo.service';

@Component({
  selector: 'rqs-admin-waitlist',
  standalone: true,
  template: `
    <section class="page-heading"><p>GROWTH / WAITLIST</p><h1>WAITLIST INTELLIGENCE</h1><span>Aggregate demand signals. No individual records or personal data.</span></section>
    @if (loading()) {
      <div class="state" aria-live="polite">AGGREGATING WAITLIST…</div>
    } @else if (failed()) {
      <div class="state error" role="alert">WAITLIST API UNAVAILABLE. NO DATA WAS CHANGED.</div>
    } @else if (summary(); as data) {
      @if (data.total === 0) {
        <div class="state">EMPTY DATASET</div>
      } @else {
        <section class="metrics waitlist" aria-label="Waitlist aggregate metrics">
          <article class="total"><span>TOTAL ENTRIES</span><strong>{{ data.total }}</strong><small>PRO_WAITLIST</small></article>
          <article><span>MASTER</span><strong>{{ data.byPlanInterest.master }}</strong><small>PLAN INTEREST</small></article>
          <article><span>PLUS</span><strong>{{ data.byPlanInterest.plus }}</strong><small>PLAN INTEREST</small></article>
          <article><span>PRO</span><strong>{{ data.byPlanInterest.pro }}</strong><small>PLAN INTEREST</small></article>
          <article><span>UNDECIDED</span><strong>{{ data.byPlanInterest.undecided }}</strong><small>EXPLICIT</small></article>
          <article><span>UNKNOWN</span><strong>{{ data.byPlanInterest.unknown }}</strong><small>LEGACY / UNSET</small></article>
        </section>
      }
      <p class="generated">GENERATED {{ data.generatedAt }}</p>
    }
  `,
  styleUrl: './dashboard.component.scss',
})
export class WaitlistComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly summary = signal<WaitlistSummary | null>(null);

  constructor(seo: AdminSeoService) { seo.setCanonical('/waitlist'); }

  async ngOnInit(): Promise<void> {
    try { this.summary.set(await this.api.waitlistSummary()); }
    catch { this.failed.set(true); }
    finally { this.loading.set(false); }
  }
}
