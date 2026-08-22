import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  effect,
  inject
} from '@angular/core';
import { Router } from '@angular/router';

import { LanguageService } from '../services/language.service';
import { SeoService } from '../services/seo.service';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './landing-page.html',
  styleUrls: ['./landing-page.scss']
})
export class LandingPageComponent implements AfterViewInit, OnDestroy {
  readonly lang = inject(LanguageService);

  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly platformId = inject(PLATFORM_ID);

  private videoObserver?: IntersectionObserver;

  constructor() {
    effect(() => {
      const currentLang = this.lang.currentLang();
      const canonicalUrl = 'https://studio.raquelsynths.com/';
      const socialImage = 'https://studio.raquelsynths.com/assets/images/studio.webp';
      const meta = {
        pt: {
          title: 'RQS Studio | Masterização, Stems, Setlists e Uplink',
          description: 'RQS Studio reúne masterização, separação de stems, criação de setlists e o RQS Uplink Engine em um workflow web para criadores.',
          shortDescription: 'Ferramentas web para masterização, stems, setlists e links musicais.',
          locale: 'pt_BR'
        },
        en: {
          title: 'RQS Studio | Mastering, Stems, Setlists & Uplink',
          description: 'RQS Studio brings mastering, stem separation, setlist creation and the RQS Uplink Engine into one web workflow for creators.',
          shortDescription: 'Web tools for mastering, stems, setlists and music links.',
          locale: 'en_US'
        },
        pl: {
          title: 'RQS Studio | Mastering, Stemy, Setlisty i Uplink',
          description: 'RQS Studio łączy mastering, separację stemów, tworzenie setlist i RQS Uplink Engine w jednym webowym workflow dla twórców.',
          shortDescription: 'Narzędzia webowe do masteringu, stemów, setlist i linków muzycznych.',
          locale: 'pl_PL'
        },
        fr: {
          title: 'RQS Studio | Mastering, Stems, Setlists et Uplink',
          description: 'RQS Studio réunit mastering, séparation des stems, création de setlists et RQS Uplink Engine dans un workflow web pour les créateurs.',
          shortDescription: 'Outils web pour le mastering, les stems, les setlists et les liens musicaux.',
          locale: 'fr_FR'
        }
      }[currentLang];

      this.seo.update({
        title: meta.title,
        description: meta.description,
        url: canonicalUrl,
        image: socialImage,
        type: 'website',
        locale: meta.locale,
        siteName: 'RQS Studio',
        robots: 'index, follow',
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'RQS Studio',
          alternateName: 'RaQuel Synths Studio',
          url: canonicalUrl,
          description: meta.shortDescription,
          publisher: {
            '@type': 'Organization',
            name: 'RaQuel Synths',
            url: 'https://raquelsynths.com'
          }
        }
      });
    });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const mobile = window.matchMedia('(max-width: 720px)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (mobile || reducedMotion) return;

    const videos = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLVideoElement>('video.section-motion[data-src]')
    );

    this.videoObserver = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          const video = entry.target as HTMLVideoElement;
          if (entry.isIntersecting) this.activateVideo(video);
          else {
            video.classList.remove('is-active');
            video.pause();
          }
        }
      },
      { rootMargin: '22% 0px', threshold: 0.04 }
    );

    videos.forEach(video => this.videoObserver?.observe(video));
  }

  ngOnDestroy(): void {
    this.videoObserver?.disconnect();
    if (isPlatformBrowser(this.platformId)) {
      this.host.nativeElement
        .querySelectorAll<HTMLVideoElement>('video.section-motion')
        .forEach(video => video.pause());
    }
  }

  private activateVideo(video: HTMLVideoElement): void {
    const startPlayback = () => {
      void video.play()
        .then(() => video.classList.add('is-active'))
        .catch(() => video.classList.remove('is-active'));
    };

    if (!video.src) {
      const src = video.dataset['src'];
      if (!src) return;
      video.src = src;
      video.addEventListener('canplay', startPlayback, { once: true });
      video.load();
      return;
    }

    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) startPlayback();
    else video.addEventListener('canplay', startPlayback, { once: true });
  }

  enterMainframe(): void {
    this.router.navigate(['/app']);
  }

  openPricing(): void {
    this.router.navigate(['/pricing']);
  }
}
