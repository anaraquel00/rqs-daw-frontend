import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { CookieConsentService } from '../services/cookie-consent.service';
import { AnalyticsService } from '../services/analytics.service';
import { LanguageService } from '../services/language.service';

@Component({
  selector: 'app-cookie-consent',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './cookie-consent.html',
  styleUrls: ['./cookie-consent.scss']
})
export class CookieConsentComponent {
  readonly consent = inject(CookieConsentService);
  readonly lang = inject(LanguageService);
  private readonly analytics = inject(AnalyticsService);

  readonly copy = computed(() => {
    const language = this.lang.currentLang();

    if (language === 'pt') {
      return {
        eyebrow: 'RQS STUDIO // PRIVACIDADE',
        title: 'Preferências de cookies',
        text: 'Usamos tecnologias necessárias para operar o Studio e, com sua permissão, Google Analytics 4 para entender de forma agregada como o produto é utilizado.',
        necessary: 'SOMENTE NECESSÁRIOS',
        analytics: 'ACEITAR ANALYTICS',
        cookies: 'Política de Cookies',
        privacy: 'Política de Privacidade',
        close: 'Fechar'
      };
    }

    if (language === 'pl') {
      return {
        eyebrow: 'RQS STUDIO // PRYWATNOŚĆ',
        title: 'Preferencje plików cookie',
        text: 'Używamy technologii niezbędnych do działania Studio oraz, za Twoją zgodą, Google Analytics 4 do zagregowanej analizy korzystania z produktu.',
        necessary: 'TYLKO NIEZBĘDNE',
        analytics: 'AKCEPTUJ ANALITYCZNE',
        cookies: 'Polityka plików cookie',
        privacy: 'Polityka prywatności',
        close: 'Zamknij'
      };
    }


    if (language === 'fr') {
      return {
        eyebrow: 'RQS STUDIO // CONFIDENTIALITÉ', title: 'Préférences de cookies',
        text: 'Nous utilisons les technologies nécessaires au fonctionnement du Studio et, avec votre autorisation, Google Analytics 4 pour comprendre de manière agrégée l’utilisation du produit.',
        necessary: 'NÉCESSAIRES UNIQUEMENT', analytics: 'ACCEPTER ANALYTICS', cookies: 'Politique de cookies', privacy: 'Politique de confidentialité', close: 'Fermer'
      };
    }

    return {
      eyebrow: 'RQS STUDIO // PRIVACY',
      title: 'Cookie preferences',
      text: 'We use technologies necessary to operate the Studio and, with your permission, Google Analytics 4 to understand aggregate product usage.',
      necessary: 'NECESSARY ONLY',
      analytics: 'ACCEPT ANALYTICS',
      cookies: 'Cookie Policy',
      privacy: 'Privacy Policy',
      close: 'Close'
    };
  });

  acceptAnalytics(): void {
    this.consent.acceptAnalytics();
    this.analytics.initialize();
  }

  necessaryOnly(): void {
    this.consent.necessaryOnly();
    this.analytics.disable();
  }

  close(): void {
    this.consent.closePreferences();
  }
}
