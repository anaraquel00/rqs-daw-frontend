import {
  Component,
  effect,
  inject
} from '@angular/core';

import { CommonModule } from '@angular/common';
import {
  RouterLink,
  RouterModule
} from '@angular/router';

import { LanguageService } from '../../services/language.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-terms',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterLink
  ],
  templateUrl: './terms.html',
  styleUrls: ['./terms.scss']
})
export class TermsComponent {

  readonly lang = inject(LanguageService);

  private seo = inject(SeoService);

  constructor() {

    effect(() => {

      const isPt =
        this.lang.currentLang() === 'pt';
      const isFr = this.lang.currentLang() === 'fr';

      const canonicalUrl =
        'https://studio.raquelsynths.com/terms';

      this.seo.update({
        title: isPt
          ? 'Termos de Serviço | RQS Studio'
          : isFr ? 'Conditions d’utilisation | RQS Studio' : 'Terms of Service | RQS Studio',

        description: isPt
          ? 'Consulte os Termos de Serviço do RQS Studio, incluindo regras de uso, processamento de áudio e componentes da plataforma.'
          : isFr ? 'Consultez les Conditions d’utilisation de RQS Studio, notamment les règles d’usage, le traitement audio et les composants de la plateforme.' : 'Read the RQS Studio Terms of Service, including platform usage, audio processing and service component rules.',

        url: canonicalUrl,

        type: 'website',

        locale: isPt
          ? 'pt_BR'
          : isFr ? 'fr_FR' : 'en_US',

        siteName: 'RQS Studio',

        robots: 'index, follow',

        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',

          name: isPt
            ? 'Termos de Serviço do RQS Studio'
            : isFr ? 'Conditions d’utilisation de RQS Studio' : 'RQS Studio Terms of Service',

          url: canonicalUrl,

          description: isPt
            ? 'Termos aplicáveis ao uso da plataforma RQS Studio.'
            : isFr ? 'Conditions applicables à l’utilisation de la plateforme RQS Studio.' : 'Terms applicable to use of the RQS Studio platform.',

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
