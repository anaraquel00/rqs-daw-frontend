import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ViewportScroller } from '@angular/common';
import { Footer } from '../footer/footer';
import { LanguageService, UiLanguage } from '../services/language.service';
import { SeoConfig, SeoService } from '../services/seo.service';
import { AnalyticsService } from '../services/analytics.service';

type PricingCurrency = 'BRL' | 'USD' | 'PLN';

const PRICING = {
  BRL: { free: 0, master: 24.90, plus: 39.90, pro: 59.90 },
  USD: { free: 0, master: 4.99, plus: 7.99, pro: 11.99 },
  PLN: { free: 0, master: 19.99, plus: 29.99, pro: 44.99 }
} as const;

export function pricingSeoConfig(currentLang: UiLanguage): SeoConfig {
  const isPt = currentLang === 'pt';
  const isPl = currentLang === 'pl';
  const canonicalUrl = 'https://studio.raquelsynths.com/pricing';

  return {
    title: isPt
      ? 'Preços do RQS Studio | Masterização, Setlists e Uplink'
      : isPl
        ? 'Cennik RQS Studio | Mastering, Setlisty i Uplink'
        : 'RQS Studio Pricing | Mastering, Setlists & Uplink',
    description: isPt
      ? 'Conheça os preços planejados do RQS Studio para masterização, setlists e RQS Uplink. Public Beta disponível agora.'
      : isPl
        ? 'Poznaj planowany cennik RQS Studio dla masteringu, workflow setlist i RQS Uplink. Public Beta jest już dostępna.'
        : 'Explore planned RQS Studio pricing for mastering, setlist workflows and RQS Uplink. Public Beta available now.',
    url: canonicalUrl,
    type: 'website',
    locale: isPt ? 'pt_BR' : isPl ? 'pl_PL' : 'en_US',
    siteName: 'RQS Studio',
    robots: 'index, follow',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: isPt ? 'Preços do RQS Studio' : isPl ? 'Cennik RQS Studio' : 'RQS Studio Pricing',
      url: canonicalUrl,
      description: isPt
        ? 'Prévia de preços de lançamento do RQS Studio durante o Public Beta.'
        : isPl
          ? 'Podgląd cen premierowych RQS Studio podczas Public Beta.'
          : 'RQS Studio launch pricing preview during Public Beta.',
      isPartOf: {
        '@type': 'WebSite',
        name: 'RQS Studio',
        url: 'https://studio.raquelsynths.com/'
      }
    }
  };
}

@Component({
  selector: 'app-pricing-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, Footer],
  templateUrl: './pricing-page.html',
  styleUrls: ['./pricing-page.scss']
})
export class PricingPageComponent implements AfterViewInit {
  readonly lang = inject(LanguageService);
  readonly currency = signal<PricingCurrency>('USD');
  readonly copy = computed(() => this.lang.tr().PRICING);
  readonly prices = computed(() => PRICING[this.currency()]);
  readonly waitlistState = signal<'idle' | 'sending' | 'success' | 'error'>('idle');
  private readonly viewportScroller = inject(ViewportScroller);

  waitlistEmail = '';
  private currencyManuallySelected = false;
  private readonly seo = inject(SeoService);
  private readonly analytics = inject(AnalyticsService);
  private desiredPlan: 'master' | 'plus' | 'pro' | 'unknown' = 'unknown';

  constructor() {
    effect(() => {
      const currentLang = this.lang.currentLang();
      if (!this.currencyManuallySelected) {
        this.currency.set(this.defaultCurrency(currentLang));
      }

      this.seo.update(pricingSeoConfig(currentLang));
    });
  }
  ngAfterViewInit(): void {
  this.viewportScroller.scrollToPosition([0, 0]);
}

  setCurrency(currency: PricingCurrency): void {
    this.currencyManuallySelected = true;
    this.currency.set(currency);
  }

  formatPrice(plan: keyof typeof PRICING.BRL): string {
    const value = this.prices()[plan];
    const currency = this.currency();
    const locale = currency === 'BRL' ? 'pt-BR' : currency === 'PLN' ? 'pl-PL' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: value === 0 ? 0 : 2,
      maximumFractionDigits: value === 0 ? 0 : 2
    }).format(value);
  }

  async joinWaitlist(): Promise<void> {
    const email = this.waitlistEmail.trim();
    if (!email || this.waitlistState() === 'sending') return;

    this.waitlistState.set('sending');
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'studio.raquelsynths.com/pricing',
          language: this.lang.currentLang() === 'pl' ? 'en' : this.lang.currentLang(),
          website: ''
        })
      });
      const result = await response.json();
      const success = response.ok && result?.success;
      this.waitlistState.set(success ? 'success' : 'error');

      if (success) {
        this.analytics.trackEvent('waitlist_joined', {
          desired_plan: this.desiredPlan
        });
      }
    } catch {
      this.waitlistState.set('error');
    }
  }

  scrollToWaitlist(plan: 'master' | 'plus' | 'pro'): void {
    this.desiredPlan = plan;
    this.analytics.trackEvent('pricing_plan_interest', {
      plan,
      currency: this.currency()
    });

    const target = document.getElementById('waitlist');
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => document.getElementById('pricing-waitlist-email')?.focus(), 350);
  }

  private defaultCurrency(language: UiLanguage): PricingCurrency {
    if (language === 'pt') return 'BRL';
    if (language === 'pl') return 'PLN';
    return 'USD';
  }
}
