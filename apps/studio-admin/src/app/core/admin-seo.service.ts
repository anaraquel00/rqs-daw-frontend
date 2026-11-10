import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';

@Injectable({ providedIn: 'root' })
export class AdminSeoService {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);

  setCanonical(path: string): void {
    this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow, noarchive' });
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = `https://studio-admin.raquelsynths.com${path}`;
  }
}
