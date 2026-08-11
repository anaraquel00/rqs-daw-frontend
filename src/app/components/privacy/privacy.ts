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
  selector: 'app-privacy',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    RouterLink
  ],
  templateUrl: './privacy.html',
  styleUrls: ['./privacy.scss']
})
export class PrivacyComponent {

  readonly lang = inject(LanguageService);

  private seo = inject(SeoService);

  constructor() {

    effect(() => {

      const isPt =
        this.lang.currentLang() === 'pt';

      const canonicalUrl =
        'https://studio.raquelsynths.com/privacy';

      this.seo.update({
        title: isPt
          ? 'Política de Privacidade | RQS Studio'
          : 'Privacy Policy | RQS Studio',

        description: isPt
          ? 'Saiba como o RQS Studio trata arquivos de áudio, dados operacionais, cookies e informações relacionadas ao uso da plataforma.'
          : 'Learn how RQS Studio handles audio files, operational data, cookies and information related to platform usage.',

        url: canonicalUrl,

        type: 'website',

        locale: isPt
          ? 'pt_BR'
          : 'en_US',

        siteName: 'RQS Studio',

        robots: 'index, follow',

        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebPage',

          name: isPt
            ? 'Política de Privacidade do RQS Studio'
            : 'RQS Studio Privacy Policy',

          url: canonicalUrl,

          description: isPt
            ? 'Política de privacidade aplicável ao RQS Studio.'
            : 'Privacy policy applicable to RQS Studio.',

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
