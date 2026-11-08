import { Component, Input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnalyticsService } from '../../services/analytics.service';
import { LanguageService } from '../../services/language.service';
import {
  PricingUpgradeIntent,
  PricingUpgradeSource,
} from '../../services/pricing-upgrade-context';

@Component({
  selector: 'app-plan-upgrade-cta',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './plan-upgrade-cta.html',
  styleUrl: './plan-upgrade-cta.scss',
})
export class PlanUpgradeCtaComponent {
  @Input({ required: true }) source!: PricingUpgradeSource;
  @Input({ required: true }) intent!: PricingUpgradeIntent;

  readonly lang = inject(LanguageService);
  private readonly analytics = inject(AnalyticsService);

  trackClick(): void {
    this.analytics.trackEvent('pricing_upgrade_cta_clicked', {
      source_module: this.source,
      intent: this.intent,
    });
  }
}
