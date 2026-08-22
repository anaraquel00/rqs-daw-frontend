import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ViewportScroller } from '@angular/common';
import { Footer } from '../footer/footer';
import { LanguageService, UiLanguage } from '../services/language.service';
import { SeoService } from '../services/seo.service';
import { AnalyticsService } from '../services/analytics.service';

type PricingCurrency = 'BRL' | 'USD' | 'PLN';

const PRICING = {
  BRL: { free: 0, master: 24.90, plus: 39.90, pro: 59.90 },
  USD: { free: 0, master: 4.99, plus: 7.99, pro: 11.99 },
  PLN: { free: 0, master: 19.99, plus: 29.99, pro: 44.99 }
} as const;

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
      if (!this.currencyManuallySelected) this.currency.set(this.defaultCurrency(currentLang));

      const canonicalUrl = 'https://studio.raquelsynths.com/pricing';
      const meta = {
        pt: {
          title: 'Preços do RQS Studio | Masterização, Stems, Setlists e Uplink',
          description: 'Conheça os preços planejados do RQS Studio para masterização, separação de stems, setlists e RQS Uplink. Public Beta disponível agora.',
          locale: 'pt_BR',
          name: 'Preços do RQS Studio',
          shortDescription: 'Prévia de preços de lançamento do RQS Studio durante o Public Beta.'
        },
        en: {
          title: 'RQS Studio Pricing | Mastering, Stems, Setlists & Uplink',
          description: 'Explore planned RQS Studio pricing for mastering, stem separation, setlist workflows and RQS Uplink. Public Beta available now.',
          locale: 'en_US',
          name: 'RQS Studio Pricing',
          shortDescription: 'RQS Studio launch pricing preview during Public Beta.'
        },
        pl: {
          title: 'Cennik RQS Studio | Mastering, Stemy, Setlisty i Uplink',
          description: 'Poznaj planowany cennik RQS Studio dla masteringu, separacji stemów, workflow setlist i RQS Uplink. Public Beta jest już dostępna.',
          locale: 'pl_PL',
          name: 'Cennik RQS Studio',
          shortDescription: 'Podgląd cen premierowych RQS Studio podczas Public Beta.'
        },
        fr: {
          title: 'Tarifs RQS Studio | Mastering, Stems, Setlists et Uplink',
          description: 'Découvrez les tarifs prévus de RQS Studio pour le mastering, la séparation des stems, les setlists et RQS Uplink. Bêta publique disponible.',
          locale: 'fr_FR',
          name: 'Tarifs RQS Studio',
          shortDescription: 'Aperçu des tarifs de lancement de RQS Studio pendant la bêta publique.'
        }
      }[currentLang];

      this.seo.update({
        title: meta.title,
        description: meta.description,
        url: canonicalUrl,
        type: 'website',
        locale: meta.locale,
        siteName: 'RQS Studio',
        robots: 'index, follow',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: meta.name,
          url: canonicalUrl,
          description: meta.shortDescription,
          isPartOf: {
            '@type': 'WebSite',
            name: 'RQS Studio',
            url: 'https://studio.raquelsynths.com/'
          }
        }
      });
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
      style: 'currency', currency,
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
          // The existing waitlist endpoint currently understands PT/EN only.
          language: this.lang.currentLang() === 'pt' ? 'pt' : 'en',
          website: ''
        })
      });
      const result = await response.json();
      const success = response.ok && result?.success;
      this.waitlistState.set(success ? 'success' : 'error');

      if (success) {
        this.analytics.trackEvent('waitlist_joined', { desired_plan: this.desiredPlan });
      }
    } catch {
      this.waitlistState.set('error');
    }
  }

  scrollToWaitlist(plan: 'master' | 'plus' | 'pro'): void {
    this.desiredPlan = plan;
    this.analytics.trackEvent('pricing_plan_interest', { plan, currency: this.currency() });

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
