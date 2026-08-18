import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Component, effect, inject } from '@angular/core';

import { LanguageService } from '../services/language.service';
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

  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  constructor() {
    effect(() => {
      const currentLang = this.lang.currentLang();
      const isPt = currentLang === 'pt';
      const canonicalUrl = 'https://studio.raquelsynths.com/';
      const socialImage =
        'https://studio.raquelsynths.com/assets/images/studio.webp';

      this.seo.update({
        title: isPt
          ? 'RQS Studio | Masterização, Stems, Setlists e Uplink'
          : 'RQS Studio | Mastering, Stems, Setlists & Uplink',
        description: isPt
          ? 'RQS Studio reúne masterização, separação de stems, criação de setlists e o RQS Uplink Engine em um workflow web para criadores.'
          : 'RQS Studio brings mastering, stem separation, setlist creation and the RQS Uplink Engine into one web workflow for creators.',
        url: canonicalUrl,
        image: socialImage,
        type: 'website',
        locale: isPt ? 'pt_BR' : currentLang === 'pl' ? 'pl_PL' : 'en_US',
        siteName: 'RQS Studio',
        robots: 'index, follow',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'RQS Studio',
          alternateName: 'RaQuel Synths Studio',
          url: canonicalUrl,
          description: isPt
            ? 'Ferramentas web para masterização, stems, setlists e links musicais.'
            : 'Web tools for mastering, stems, setlists and music links.',
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
}
