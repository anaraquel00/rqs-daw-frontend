import { Component, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LanguageService } from '../services/language.service';
import { SeoService } from '../services/seo.service';
import { CookieConsentService } from '../services/cookie-consent.service';
import { AnalyticsService } from '../services/analytics.service';
import { Footer } from '../footer/footer';

@Component({
  selector: 'app-cookies-page',
  standalone: true,
  imports: [CommonModule, RouterLink, Footer],
  templateUrl: './cookies-page.html',
  styleUrls: ['./cookies-page.scss']
})
export class CookiesPageComponent {
  readonly lang = inject(LanguageService);
  readonly consent = inject(CookieConsentService);
  private readonly analytics = inject(AnalyticsService);
  private readonly seo = inject(SeoService);

  readonly copy = computed(() => {
    const language = this.lang.currentLang();

    if (language === 'pt') {
      return {
        eyebrow: 'RQS STUDIO // LEGAL',
        title: 'Política de Cookies',
        updated: 'Última atualização: 21 de agosto de 2026',
        intro: 'Esta Política explica como o RQS Studio utiliza cookies e tecnologias semelhantes, incluindo o uso opcional de Google Analytics 4 (GA4).',
        sections: [
          ['1. O que são cookies', 'Cookies são pequenos arquivos ou identificadores armazenados pelo navegador para permitir funções técnicas, lembrar preferências ou medir de forma agregada como um serviço é utilizado.'],
          ['2. Tecnologias necessárias', 'O Studio utiliza armazenamento local e tecnologias semelhantes para funções essenciais, como sessão, preferência de idioma, estado da aplicação e sua escolha de cookies. Essas tecnologias são necessárias para operar recursos básicos e não dependem da ativação do GA4.'],
          ['3. Cookies analíticos', 'Com sua permissão, o RQS Studio carrega Google Analytics 4 para medir page views e eventos agregados de produto. O GA4 não é carregado pelo Studio antes da sua escolha por Analytics.'],
          ['4. Dados que não enviamos ao GA4', 'A instrumentação atual não envia intencionalmente e-mail, nome, UUID de usuário, nomes de arquivos, títulos de faixas, URLs submetidas pelo usuário, conteúdo de áudio, tokens OAuth, credenciais ou URLs S3/presigned.'],
          ['5. Publicidade', 'Esta implementação não ativa Google Signals, personalização de anúncios, remarketing, AdSense ou eventos de compra/subscrição. O objetivo atual é analytics de produto e medição do funil do Beta Público.'],
          ['6. Como alterar sua escolha', 'Você pode abrir Preferências de Cookies a qualquer momento pelo footer. Ao escolher Somente necessários, o Studio deixa de enviar novos eventos ao GA4 e tenta remover cookies GA existentes do domínio do Studio.'],
          ['7. Retenção e fornecedores', 'A duração de cookies analíticos é determinada pela configuração e pelo funcionamento do Google Analytics. O fornecedor associado ao analytics é o Google. Consulte também nossa Política de Privacidade para informações sobre dados, finalidades, fornecedores e direitos.'],
          ['8. Alterações', 'Esta Política pode ser atualizada quando houver mudança nas tecnologias, fornecedores, finalidades ou mecanismos de consentimento utilizados pelo Studio.']
        ],
        current: 'Preferência atual',
        unset: 'Ainda não definida',
        necessary: 'Somente necessários',
        analytics: 'Analytics permitido',
        manage: 'ABRIR PREFERÊNCIAS',
        privacy: 'Política de Privacidade'
      };
    }

    if (language === 'pl') {
      return {
        eyebrow: 'RQS STUDIO // LEGAL',
        title: 'Polityka plików cookie',
        updated: 'Ostatnia aktualizacja: 21 sierpnia 2026',
        intro: 'Niniejsza Polityka wyjaśnia, w jaki sposób RQS Studio używa plików cookie i podobnych technologii, w tym opcjonalnego Google Analytics 4 (GA4).',
        sections: [
          ['1. Czym są pliki cookie', 'Pliki cookie to niewielkie pliki lub identyfikatory przechowywane przez przeglądarkę w celu obsługi funkcji technicznych, zapamiętywania preferencji lub zagregowanego pomiaru korzystania z usługi.'],
          ['2. Technologie niezbędne', 'Studio używa pamięci lokalnej i podobnych technologii do funkcji podstawowych, takich jak sesja, język, stan aplikacji oraz zapis wyboru dotyczącego plików cookie. Nie wymagają one aktywacji GA4.'],
          ['3. Analityczne pliki cookie', 'Za Twoją zgodą RQS Studio ładuje Google Analytics 4 w celu pomiaru odsłon i zagregowanych zdarzeń produktu. Studio nie ładuje GA4 przed wyrażeniem zgody na Analytics.'],
          ['4. Danych, których nie wysyłamy do GA4', 'Obecna instrumentacja celowo nie wysyła adresu e-mail, imienia, UUID użytkownika, nazw plików, tytułów utworów, adresów URL przesłanych przez użytkownika, treści audio, tokenów OAuth, danych uwierzytelniających ani adresów S3/presigned.'],
          ['5. Reklama', 'Ta implementacja nie aktywuje Google Signals, personalizacji reklam, remarketingu, AdSense ani zdarzeń zakupu/subskrypcji. Celem jest analityka produktu i pomiar lejka Public Beta.'],
          ['6. Zmiana wyboru', 'Preferencje plików cookie można otworzyć w dowolnym momencie z poziomu stopki. Wybranie Tylko niezbędne zatrzymuje nowe zdarzenia GA4 i powoduje próbę usunięcia istniejących plików cookie GA z domeny Studio.'],
          ['7. Retencja i dostawcy', 'Okres działania analitycznych plików cookie zależy od konfiguracji i działania Google Analytics. Dostawcą analityki jest Google. Szczegóły dotyczące danych i praw znajdują się również w Polityce prywatności.'],
          ['8. Zmiany', 'Polityka może być aktualizowana, gdy zmienią się technologie, dostawcy, cele lub mechanizmy zgody stosowane przez Studio.']
        ],
        current: 'Aktualne ustawienie',
        unset: 'Jeszcze nie wybrano',
        necessary: 'Tylko niezbędne',
        analytics: 'Analytics dozwolone',
        manage: 'OTWÓRZ PREFERENCJE',
        privacy: 'Polityka prywatności'
      };
    }


    if (language === 'fr') {
      return {
        eyebrow: 'RQS STUDIO // JURIDIQUE', title: 'Politique de cookies', updated: 'Dernière mise à jour : 21 août 2026',
        intro: 'Cette Politique explique comment RQS Studio utilise les cookies et technologies similaires, y compris l’utilisation optionnelle de Google Analytics 4 (GA4).',
        sections: [
          ['1. Que sont les cookies', 'Les cookies sont de petits fichiers ou identifiants stockés par le navigateur pour assurer des fonctions techniques, mémoriser des préférences ou mesurer de manière agrégée l’utilisation d’un service.'],
          ['2. Technologies nécessaires', 'Le Studio utilise le stockage local et des technologies similaires pour la session, la langue, l’état de l’application et votre choix de cookies.'],
          ['3. Cookies Analytics', 'Avec votre autorisation, RQS Studio charge Google Analytics 4 afin de mesurer les pages vues et les événements produit agrégés.'],
          ['4. Données non envoyées à GA4', 'L’instrumentation actuelle n’envoie pas intentionnellement e-mail, nom, UUID utilisateur, noms de fichiers, titres de pistes, URL utilisateur, contenu audio, tokens OAuth, identifiants ou URL S3/presigned.'],
          ['5. Publicité', 'Cette implémentation n’active pas Google Signals, la personnalisation publicitaire, le remarketing, AdSense ni les événements d’achat ou d’abonnement.'],
          ['6. Modifier votre choix', 'Vous pouvez ouvrir les Préférences de cookies à tout moment depuis le footer. En choisissant Nécessaires uniquement, le Studio cesse d’envoyer de nouveaux événements à GA4.'],
          ['7. Conservation et fournisseurs', 'La durée des cookies Analytics dépend de la configuration et du fonctionnement de Google Analytics. Google est le fournisseur associé à l’analytics.'],
          ['8. Modifications', 'Cette Politique peut être mise à jour lorsque le Studio modifie les technologies, fournisseurs, finalités ou mécanismes de consentement.']
        ],
        current: 'Préférence actuelle', unset: 'Pas encore définie', necessary: 'Nécessaires uniquement', analytics: 'Analytics autorisé', manage: 'OUVRIR LES PRÉFÉRENCES', privacy: 'Politique de confidentialité'
      };
    }

    return {
      eyebrow: 'RQS STUDIO // LEGAL',
      title: 'Cookie Policy',
      updated: 'Last Updated: August 21, 2026',
      intro: 'This Policy explains how RQS Studio uses cookies and similar technologies, including optional Google Analytics 4 (GA4).',
      sections: [
        ['1. What cookies are', 'Cookies are small files or identifiers stored by a browser to support technical functions, remember preferences or measure aggregate use of a service.'],
        ['2. Necessary technologies', 'The Studio uses local storage and similar technologies for essential functions such as session handling, language preference, application state and storing your cookie choice. These technologies do not depend on GA4 being enabled.'],
        ['3. Analytics cookies', 'With your permission, RQS Studio loads Google Analytics 4 to measure page views and aggregate product events. The Studio does not load GA4 before you choose to allow Analytics.'],
        ['4. Data we do not send to GA4', 'The current instrumentation intentionally does not send email, name, user UUID, file names, track titles, user-submitted URLs, audio content, OAuth tokens, credentials or S3/presigned URLs.'],
        ['5. Advertising', 'This implementation does not enable Google Signals, ads personalization, remarketing, AdSense or purchase/subscription events. The current purpose is product analytics and Public Beta funnel measurement.'],
        ['6. Changing your choice', 'You can open Cookie Preferences at any time from the footer. Choosing Necessary only stops new GA4 events and the Studio attempts to remove existing GA cookies from the Studio domain.'],
        ['7. Retention and providers', 'Analytics-cookie duration depends on Google Analytics configuration and operation. Google is the provider associated with analytics. See the Privacy Policy for information about data, purposes, providers and rights.'],
        ['8. Changes', 'This Policy may be updated when the Studio changes technologies, providers, purposes or consent mechanisms.']
      ],
      current: 'Current preference',
      unset: 'Not set yet',
      necessary: 'Necessary only',
      analytics: 'Analytics allowed',
      manage: 'OPEN PREFERENCES',
      privacy: 'Privacy Policy'
    };
  });

  readonly preferenceLabel = computed(() => {
    const preference = this.consent.preference();
    const copy = this.copy();

    if (preference === 'analytics') return copy.analytics;
    if (preference === 'necessary') return copy.necessary;
    return copy.unset;
  });

  constructor() {
    effect(() => {
      const language = this.lang.currentLang();
      const canonicalUrl = 'https://studio.raquelsynths.com/cookies';

      this.seo.update({
        title: language === 'pt'
          ? 'Política de Cookies | RQS Studio'
          : language === 'pl'
            ? 'Polityka plików cookie | RQS Studio'
            : language === 'fr' ? 'Politique de cookies | RQS Studio' : 'Cookie Policy | RQS Studio',
        description: language === 'pt'
          ? 'Saiba como o RQS Studio utiliza tecnologias necessárias e, com consentimento, Google Analytics 4.'
          : language === 'pl'
            ? 'Dowiedz się, jak RQS Studio korzysta z niezbędnych technologii oraz, za zgodą, Google Analytics 4.'
            : language === 'fr' ? 'Découvrez comment RQS Studio utilise les technologies nécessaires et, avec votre consentement, Google Analytics 4.' : 'Learn how RQS Studio uses necessary technologies and, with consent, Google Analytics 4.',
        url: canonicalUrl,
        type: 'website',
        locale: language === 'pt' ? 'pt_BR' : language === 'pl' ? 'pl_PL' : language === 'fr' ? 'fr_FR' : 'en_US',
        siteName: 'RQS Studio',
        robots: 'index, follow',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: this.copy().title,
          url: canonicalUrl,
          description: this.copy().intro
        }
      });
    });
  }

  openPreferences(): void {
    this.consent.openPreferences();
  }
}
