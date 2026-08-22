import { Component, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterModule } from '@angular/router';
import { LanguageService } from '../../services/language.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-privacy',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink],
  templateUrl: './privacy.html',
  styleUrls: ['./privacy.scss']
})
export class PrivacyComponent {
  readonly lang = inject(LanguageService);
  private readonly seo = inject(SeoService);

  constructor() {
    effect(() => {
      const language = this.lang.currentLang();
      const canonicalUrl = 'https://studio.raquelsynths.com/privacy';
      const meta = {
        pt: { title: 'Política de Privacidade | RQS Studio', description: 'Saiba como o RQS Studio trata arquivos de áudio, dados operacionais, cookies e informações relacionadas ao uso da plataforma.', locale: 'pt_BR', name: 'Política de Privacidade do RQS Studio', shortDescription: 'Política de privacidade aplicável ao RQS Studio.' },
        en: { title: 'Privacy Policy | RQS Studio', description: 'Learn how RQS Studio handles audio files, operational data, cookies and information related to platform usage.', locale: 'en_US', name: 'RQS Studio Privacy Policy', shortDescription: 'Privacy policy applicable to RQS Studio.' },
        pl: { title: 'Polityka prywatności | RQS Studio', description: 'Dowiedz się, jak RQS Studio przetwarza pliki audio, dane operacyjne, pliki cookie i informacje związane z korzystaniem z platformy.', locale: 'pl_PL', name: 'Polityka prywatności RQS Studio', shortDescription: 'Polityka prywatności dotycząca RQS Studio.' },
        fr: { title: 'Politique de confidentialité | RQS Studio', description: 'Découvrez comment RQS Studio traite les fichiers audio, les données opérationnelles, les cookies et les informations liées à l’utilisation de la plateforme.', locale: 'fr_FR', name: 'Politique de confidentialité de RQS Studio', shortDescription: 'Politique de confidentialité applicable à RQS Studio.' }
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
          isPartOf: { '@type': 'WebSite', name: 'RQS Studio', url: 'https://studio.raquelsynths.com/' }
        }
      });
    });
  }
}
