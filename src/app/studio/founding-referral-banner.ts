import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AnalyticsService } from '../services/analytics.service';
import { AuthService } from '../services/auth.service';
import { FoundingReferralService } from '../services/founding-referral.service';
import { LanguageService } from '../services/language.service';
import { FOUNDING_REFERRAL_COPY } from './founding-referral-copy';

@Component({ selector: 'app-founding-referral-banner', standalone: true, imports: [RouterLink],
  templateUrl: './founding-referral-banner.html', styleUrl: './founding-referral-banner.scss' })
export class FoundingReferralBannerComponent {
  readonly auth = inject(AuthService); readonly referral = inject(FoundingReferralService);
  private readonly lang = inject(LanguageService);
  readonly copy = computed(() => FOUNDING_REFERRAL_COPY[this.lang.currentLang()]);
  readonly confirming = signal(false); readonly accepted = signal(false); readonly copied = signal(false);
  readonly analytics = inject(AnalyticsService);
  private lastUser: string | null = null;

  constructor() {
    this.analytics.trackEvent('referral_banner_view');
    effect(() => {
      const user = this.auth.session()?.user.id ?? null;
      if (user === this.lastUser) return;
      this.lastUser = user;
      if (user) void this.referral.load(); else this.referral.reset();
    });
  }

  async activate(): Promise<void> {
    if (!this.accepted()) return;
    if (await this.referral.activate()) {
      this.confirming.set(false);
      this.analytics.trackEvent('referral_waitlist_activated');
      this.analytics.trackEvent('referral_link_created');
    }
  }

  referralUrl(): string { return `https://studio.raquelsynths.com/pricing?ref=${this.referral.status().referralCode}#waitlist`; }
  async copyLink(): Promise<void> { await navigator.clipboard.writeText(this.referralUrl()); this.copied.set(true); this.analytics.trackEvent('referral_link_copied'); }
  async share(): Promise<void> { this.analytics.trackEvent('referral_share_started'); if (navigator.share) await navigator.share({ title: 'RQS Studio', url: this.referralUrl() }); else await this.copyLink(); }
}
