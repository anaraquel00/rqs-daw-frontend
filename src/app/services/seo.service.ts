import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

export interface SeoConfig {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: 'website' | 'article';
  robots?: string;
  locale?: string;
  siteName?: string;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

@Injectable({
  providedIn: 'root'
})
export class SeoService {
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);
  private readonly document = inject(DOCUMENT);

  update(config: SeoConfig): void {
    const {
      title,
      description,
      url,
      image,
      type = 'website',
      robots = 'index, follow',
      locale = 'pt_BR',
      siteName = 'RaQuel Synths',
      jsonLd
    } = config;

    this.titleService.setTitle(title);

    this.metaService.updateTag({
      name: 'description',
      content: description
    });

    this.metaService.updateTag({
      name: 'robots',
      content: robots
    });

    this.metaService.updateTag({
      property: 'og:title',
      content: title
    });

    this.metaService.updateTag({
      property: 'og:description',
      content: description
    });

    this.metaService.updateTag({
      property: 'og:url',
      content: url
    });

    this.metaService.updateTag({
      property: 'og:type',
      content: type
    });

    this.metaService.updateTag({
      property: 'og:site_name',
      content: siteName
    });

    this.metaService.updateTag({
      property: 'og:locale',
      content: locale
    });

    this.metaService.updateTag({
      name: 'twitter:card',
      content: image ? 'summary_large_image' : 'summary'
    });

    this.metaService.updateTag({
      name: 'twitter:title',
      content: title
    });

    this.metaService.updateTag({
      name: 'twitter:description',
      content: description
    });

    if (image) {
      this.metaService.updateTag({
        property: 'og:image',
        content: image
      });

      this.metaService.updateTag({
        name: 'twitter:image',
        content: image
      });
    } else {
      this.metaService.removeTag("property='og:image'");
      this.metaService.removeTag("name='twitter:image'");
    }

    this.setCanonical(url);

    if (jsonLd) {
      this.setJsonLd(jsonLd);
    } else {
      this.removeJsonLd();
    }
  }

  setNoIndex(url?: string): void {
    this.metaService.updateTag({
      name: 'robots',
      content: 'noindex, nofollow'
    });

    if (url) {
      this.setCanonical(url);
    }
  }

  setCanonical(url: string): void {
    let canonical = this.document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]'
    );

    if (!canonical) {
      canonical = this.document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      this.document.head.appendChild(canonical);
    }

    canonical.setAttribute('href', url);
  }

  setJsonLd(data: Record<string, unknown> | Record<string, unknown>[]): void {
    this.removeJsonLd();

    const script = this.document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'rqs-seo-jsonld';
    script.textContent = JSON.stringify(data);

    this.document.head.appendChild(script);
  }

  private removeJsonLd(): void {
    this.document
      .getElementById('rqs-seo-jsonld')
      ?.remove();
  }
}
