import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LanguageService } from '../services/language.service';
import {
  Component,
  effect,
  inject
} from '@angular/core';


import { SeoService } from '../services/seo.service';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing-page.html',
  styleUrls: ['./landing-page.scss']
})
export class LandingPageComponent {

  readonly lang = inject(LanguageService);

  private router = inject(Router);
  private seo = inject(SeoService);

  constructor() {

    effect(() => {

      const isPt =
        this.lang.currentLang() === 'pt';

      const canonicalUrl =
        'https://studio.raquelsynths.com/';

      this.seo.update({
        title: isPt
          ? 'RQS Studio | Workstation Inteligente para Música'
          : 'RQS Studio | Intelligent Music Workstation',

        description: isPt
          ? 'RQS Studio é a workstation web da RaQuel Synths para masterização de áudio, DSP inteligente, criação de setlists e deep links musicais.'
          : 'RQS Studio is the RaQuel Synths web workstation for audio mastering, intelligent DSP, setlist creation and music deep links.',

        url: canonicalUrl,

        type: 'website',

        locale: isPt
          ? 'pt_BR'
          : 'en_US',

        siteName: 'RQS Studio',

        robots: 'index, follow',

        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebSite',

          name: 'RQS Studio',

          alternateName:
            'RaQuel Synths Digital Audio Workstation',

          url: canonicalUrl,

          description: isPt
            ? 'Workstation web para produção, processamento e ferramentas inteligentes para música.'
            : 'Web workstation for music production, processing and intelligent music tools.',

          publisher: {
            '@type': 'Organization',
            name: 'RaQuel Synths',
            url: 'https://raquelsynths.com'
          }
        }
      });
    });
  }

  enterMainframe(): void {
    this.router.navigate(['/app']);
  }

  buyProPlan(): void {
    window.open(
      'https://buy.stripe.com/test_aFa00bdzW3Qmgt9dT7djO00',
      '_blank'
    );
  }
}
