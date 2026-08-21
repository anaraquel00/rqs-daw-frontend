import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';

export type CookieConsentPreference = 'unset' | 'necessary' | 'analytics';

@Injectable({
  providedIn: 'root'
})
export class CookieConsentService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'rqs_cookie_consent_v1';

  readonly preference = signal<CookieConsentPreference>('unset');
  readonly bannerVisible = signal(false);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const saved = localStorage.getItem(this.storageKey);

    if (saved === 'necessary' || saved === 'analytics') {
      this.preference.set(saved);
      this.bannerVisible.set(false);
      return;
    }

    this.preference.set('unset');
    this.bannerVisible.set(true);
  }

  analyticsAllowed(): boolean {
    return this.preference() === 'analytics';
  }

  acceptAnalytics(): void {
    this.save('analytics');
  }

  necessaryOnly(): void {
    this.save('necessary');
  }

  openPreferences(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.bannerVisible.set(true);
  }

  closePreferences(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.preference() !== 'unset') {
      this.bannerVisible.set(false);
    }
  }

  private save(preference: Exclude<CookieConsentPreference, 'unset'>): void {
    if (!isPlatformBrowser(this.platformId)) return;

    localStorage.setItem(this.storageKey, preference);
    this.preference.set(preference);
    this.bannerVisible.set(false);
  }
}
