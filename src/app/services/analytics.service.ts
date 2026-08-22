import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Title } from '@angular/platform-browser';
import { filter } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { CookieConsentService } from './cookie-consent.service';

type AnalyticsParam = string | number | boolean;
type AnalyticsParams = Record<string, AnalyticsParam | null | undefined>;

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly document = inject(DOCUMENT);
  private readonly consent = inject(CookieConsentService);

  private active = false;
  private gtagConfigured = false;
  private routerSubscribed = false;
  private lastPageKey = '';

  private readonly blockedParamNames = new Set([
    'email',
    'name',
    'full_name',
    'username',
    'user_id',
    'user_uuid',
    'profile_id',
    'filename',
    'file_name',
    'track_title',
    'artist_name',
    'target_url',
    'public_url',
    's3_url',
    'presigned_url',
    'bucket',
    'oauth_token',
    'access_token',
    'refresh_token',
    'token'
  ]);

  initialize(): void {
    if (
      !environment.analyticsEnabled ||
      !isPlatformBrowser(this.platformId) ||
      !this.consent.analyticsAllowed()
    ) {
      return;
    }

    this.active = true;

    window.dataLayer = window.dataLayer || [];
    if (!window.gtag) {
    window.gtag = function (...args: unknown[]) {
    window.dataLayer.push(arguments);
  };
  }

    if (!this.gtagConfigured) {
      window.gtag('js', new Date());
      window.gtag('config', environment.analyticsMeasurementId, {
        send_page_view: false
      });

      const scriptId = 'rqs-ga4-gtag';
      if (!this.document.getElementById(scriptId)) {
        const script = this.document.createElement('script');
        script.id = scriptId;
        script.async = true;
        script.src =
          `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(environment.analyticsMeasurementId)}`;
        this.document.head.appendChild(script);
      }

      this.gtagConfigured = true;
    }

    window.gtag('consent', 'update', {
      analytics_storage: 'granted'
    });

    if (!this.routerSubscribed) {
      this.routerSubscribed = true;

      this.router.events
        .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
        .subscribe(() => {
          queueMicrotask(() => this.trackCurrentPage());
        });
    }

    queueMicrotask(() => this.trackCurrentPage());
  }

  disable(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.active = false;
    this.lastPageKey = '';

    if (typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        analytics_storage: 'denied'
      });
    }

    this.deleteGaCookies();
  }

  trackPageView(): void {
    if (!this.canTrack()) return;

    // Never send query strings or fragments to GA4. OAuth codes, tokens,
    // e-mail addresses or other user-provided values may legitimately appear
    // there even though custom event parameters are separately filtered.
    const pagePath = window.location.pathname || '/';
    const pageLocation = `${window.location.origin}${pagePath}`;
    const pageKey = pagePath;

    if (pageKey === this.lastPageKey) {
      return;
    }

    this.lastPageKey = pageKey;

    this.send('event', 'page_view', {
      page_path: pagePath,
      page_location: pageLocation,
      page_title: this.title.getTitle() || this.document.title
    });
  }

  trackEvent(name: string, params: AnalyticsParams = {}): void {
    if (!this.canTrack()) return;

    const safeParams: Record<string, AnalyticsParam> = {};

    for (const [key, value] of Object.entries(params)) {
      if (
        value === null ||
        value === undefined ||
        this.blockedParamNames.has(key.toLowerCase())
      ) {
        continue;
      }

      safeParams[key] = value;
    }

    this.send('event', name, safeParams);
  }

  private trackCurrentPage(): void {
    if (!this.canTrack()) return;

    this.trackPageView();

    const path = window.location.pathname;

    if (path === '/app') {
      this.trackEvent('studio_open');
    }

    if (path === '/pricing') {
      this.trackEvent('pricing_view');
    }
  }

  private canTrack(): boolean {
    return (
      this.active &&
      this.consent.analyticsAllowed() &&
      environment.analyticsEnabled &&
      isPlatformBrowser(this.platformId) &&
      typeof window.gtag === 'function'
    );
  }

  private send(command: string, eventName: string, params: Record<string, unknown> = {}): void {
    if (!window.gtag) return;

    const payload = environment.analyticsDebugMode
      ? { ...params, debug_mode: true }
      : params;

    window.gtag(command, eventName, payload);
  }

  private deleteGaCookies(): void {
    const cookieNames = this.document.cookie
      .split(';')
      .map((item) => item.trim().split('=')[0])
      .filter((name) => name === '_ga' || name.startsWith('_ga_'));

    const hostname = window.location.hostname;
    const registrableDomain = hostname.endsWith('.raquelsynths.com')
      ? '.raquelsynths.com'
      : undefined;

    for (const name of cookieNames) {
      this.expireCookie(name);
      this.expireCookie(name, hostname);

      if (registrableDomain) {
        this.expireCookie(name, registrableDomain);
      }
    }
  }

  private expireCookie(name: string, domain?: string): void {
    const domainPart = domain ? `; Domain=${domain}` : '';
    this.document.cookie =
      `${name}=; Max-Age=0; Path=/${domainPart}; SameSite=Lax`;
  }
}
