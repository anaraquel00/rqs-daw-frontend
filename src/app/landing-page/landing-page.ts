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
  const isFr = currentLang === 'fr';
  const canonicalUrl = 'https://studio.raquelsynths.com/';

  return {
    title: isPt
      ? 'RQS Studio | Masterização Online para Artistas Independentes'
      : isPl
        ? 'RQS Studio | Mastering Online dla Niezależnych Artystów'
        : isFr
          ? 'RQS Studio | Mastering en Ligne pour Artistes Indépendants'
          : 'RQS Studio | Online Music Mastering for Independent Artists',
    description: isPt
      ? 'Masterize sua faixa online no navegador com o RQS MASTER. Public Beta gratuita para músicos independentes, produtores e criadores de música assistida por IA.'
      : isPl
        ? 'Masteruj utwór online w przeglądarce dzięki RQS MASTER. Darmowa Public Beta dla niezależnych muzyków, producentów i twórców muzyki wspieranej przez AI.'
        : isFr
          ? 'Masterisez votre morceau en ligne dans le navigateur avec RQS MASTER. Public Beta gratuite pour les musiciens indépendants, producteurs et créateurs assistés par IA.'
          : 'Master your track online in the browser with RQS MASTER. Free Public Beta for independent musicians, producers and AI-assisted music creators.',
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
        ? 'Ferramentas web para masterização online e criação musical independente.'
        : isPl
          ? 'Narzędzia webowe do masteringu online dla niezależnych twórców muzyki.'
          : isFr
            ? 'Outils web de mastering en ligne pour les créateurs de musique indépendants.'
            : 'Browser-based online mastering for independent music creators.',
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
