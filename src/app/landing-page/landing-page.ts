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

import { LanguageService, UiLanguage } from '../services/language.service';
import { SeoConfig, SeoService } from '../services/seo.service';

export function landingSeoConfig(currentLang: UiLanguage): SeoConfig {
  const isPt = currentLang === 'pt';
  const isPl = currentLang === 'pl';
  const canonicalUrl = 'https://studio.raquelsynths.com/';

  return {
    title: isPt
      ? 'RQS Studio | Masterização, Setlists e Uplink'
      : isPl
        ? 'RQS Studio | Mastering, Setlisty i Uplink'
        : 'RQS Studio | Mastering, Setlists & Uplink',
    description: isPt
      ? 'RQS Studio reúne masterização, criação de setlists e o RQS Uplink Engine em um workflow web para criadores.'
      : isPl
        ? 'RQS Studio łączy mastering, tworzenie setlist i RQS Uplink Engine w jednym webowym workflow dla twórców.'
        : 'RQS Studio brings mastering, setlist creation and the RQS Uplink Engine into one web workflow for creators.',
    url: canonicalUrl,
    image: 'https://studio.raquelsynths.com/assets/images/studio.webp',
    type: 'website',
    locale: isPt ? 'pt_BR' : isPl ? 'pl_PL' : 'en_US',
    siteName: 'RQS Studio',
    robots: 'index, follow',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'RQS Studio',
      alternateName: 'RaQuel Synths Studio',
      url: canonicalUrl,
      description: isPt
        ? 'Ferramentas web para masterização, setlists e links musicais.'
        : isPl
          ? 'Narzędzia webowe do masteringu, setlist i linków muzycznych.'
          : 'Web tools for mastering, setlists and music links.',
      publisher: {
        '@type': 'Organization',
        name: 'RaQuel Synths',
        url: 'https://raquelsynths.com'
      }
    }
  };
}

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
      this.seo.update(landingSeoConfig(currentLang));
    });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const mobile = window.matchMedia('(max-width: 720px)').matches;
    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (mobile || reducedMotion) {
      return;
    }

    const videos = Array.from(
      this.host.nativeElement.querySelectorAll<HTMLVideoElement>(
        'video.section-motion[data-src]'
      )
    );

    this.videoObserver = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          const video = entry.target as HTMLVideoElement;

          if (entry.isIntersecting) {
            this.activateVideo(video);
          } else {
            video.classList.remove('is-active');
            video.pause();
          }
        }
      },
      {
        rootMargin: '22% 0px',
        threshold: 0.04
      }
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

      if (!src) {
        return;
      }

      video.src = src;
      video.addEventListener('canplay', startPlayback, { once: true });
      video.load();
      return;
    }

    if (video.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
      startPlayback();
    } else {
      video.addEventListener('canplay', startPlayback, { once: true });
    }
  }

  enterMainframe(): void {
    this.router.navigate(['/app']);
  }

  openPricing(): void {
    this.router.navigate(['/pricing']);
  }
}
