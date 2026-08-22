import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { AnalyticsService } from './analytics.service';
import { CookieConsentService } from './cookie-consent.service';

describe('AnalyticsService privacy contract', () => {
  let service: AnalyticsService;
  let gtag: jasmine.Spy;
  let routerEvents: Subject<unknown>;
  let consent: jasmine.SpyObj<CookieConsentService>;
  let originalAnalyticsEnabled: boolean;
  let originalDebugMode: boolean;

  beforeEach(() => {
    originalAnalyticsEnabled = environment.analyticsEnabled;
    originalDebugMode = environment.analyticsDebugMode;
    environment.analyticsEnabled = true;
    environment.analyticsDebugMode = false;

    routerEvents = new Subject<unknown>();
    consent = jasmine.createSpyObj<CookieConsentService>('CookieConsentService', ['analyticsAllowed']);
    consent.analyticsAllowed.and.returnValue(true);

    gtag = jasmine.createSpy('gtag');
    window.dataLayer = [];
    window.gtag = gtag;

    TestBed.configureTestingModule({
      providers: [
        AnalyticsService,
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: DOCUMENT, useValue: document },
        { provide: Router, useValue: { events: routerEvents.asObservable() } },
        { provide: Title, useValue: { getTitle: () => 'RQS Test' } },
        { provide: CookieConsentService, useValue: consent }
      ]
    });

    service = TestBed.inject(AnalyticsService);
  });

  afterEach(() => {
    environment.analyticsEnabled = originalAnalyticsEnabled;
    environment.analyticsDebugMode = originalDebugMode;
    history.replaceState({}, '', '/');
    window.gtag = undefined;
    window.dataLayer = [];
    document.getElementById('rqs-ga4-gtag')?.remove();
    routerEvents.complete();
  });

  it('strips query strings and fragments from GA4 page view location', () => {
    history.replaceState({}, '', '/app?code=oauth-secret&email=user%40example.com#token-fragment');

    service.initialize();
    service.trackPageView();

    const pageViewCall = gtag.calls
      .allArgs()
      .filter((args) => args[0] === 'event' && args[1] === 'page_view')
      .at(-1);

    expect(pageViewCall).toBeDefined();

    const payload = pageViewCall?.[2] as Record<string, unknown>;
    expect(payload['page_path']).toBe('/app');
    expect(payload['page_location']).toBe(`${window.location.origin}/app`);
    expect(JSON.stringify(payload)).not.toContain('oauth-secret');
    expect(JSON.stringify(payload)).not.toContain('user%40example.com');
    expect(JSON.stringify(payload)).not.toContain('token-fragment');
  });

  it('drops blocked sensitive custom event parameter names', () => {
    service.initialize();
    gtag.calls.reset();

    service.trackEvent('mastering_test', {
      atmosphere: 'thunder',
      token: 'secret-token',
      email: 'private@example.com',
      filename: 'private-track.wav'
    });

    const eventCall = gtag.calls
      .allArgs()
      .find((args) => args[0] === 'event' && args[1] === 'mastering_test');

    expect(eventCall).toBeDefined();

    const payload = eventCall?.[2] as Record<string, unknown>;
    expect(payload['atmosphere']).toBe('thunder');
    expect(payload['token']).toBeUndefined();
    expect(payload['email']).toBeUndefined();
    expect(payload['filename']).toBeUndefined();
  });
});