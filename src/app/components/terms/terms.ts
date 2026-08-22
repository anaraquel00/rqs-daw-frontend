import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterModule } from '@angular/router';
import { LanguageService } from '../../services/language.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink],
  templateUrl: './terms.html',
  styleUrls: ['./terms.scss']
})
export class TermsComponent {
  readonly lang = inject(LanguageService);
  private readonly seo = inject(SeoService);

  constructor() {
    effect(() => {
      const language = this.lang.currentLang();
      const canonicalUrl = 'https://studio.raquelsynths.com/terms';
      const meta = {
        pt: {
          title: 'Termos de Serviço | RQS Studio',
          description: 'Consulte os Termos de Serviço do RQS Studio, incluindo regras de uso, processamento de áudio e componentes da plataforma.',
          locale: 'pt_BR',
          name: 'Termos de Serviço do RQS Studio',
          shortDescription: 'Termos aplicáveis ao uso da plataforma RQS Studio.'
        },
        en: {
          title: 'Terms of Service | RQS Studio',
          description: 'Read the RQS Studio Terms of Service, including platform usage, audio processing and service component rules.',
          locale: 'en_US',
          name: 'RQS Studio Terms of Service',
          shortDescription: 'Terms applicable to use of the RQS Studio platform.'
        },
        pl: {
          title: 'Warunki korzystania | RQS Studio',
          description: 'Zapoznaj się z Warunkami korzystania z RQS Studio, w tym zasadami użytkowania, przetwarzania audio i działania modułów platformy.',
          locale: 'pl_PL',
          name: 'Warunki korzystania z RQS Studio',
          shortDescription: 'Warunki mające zastosowanie do korzystania z platformy RQS Studio.'
        },
        fr: {
          title: 'Conditions d’utilisation | RQS Studio',
          description: 'Consultez les Conditions d’utilisation de RQS Studio, notamment les règles d’usage, de traitement audio et de fonctionnement des modules.',
          locale: 'fr_FR',
          name: 'Conditions d’utilisation de RQS Studio',
          shortDescription: 'Conditions applicables à l’utilisation de la plateforme RQS Studio.'
        }
      }[language];

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
}
