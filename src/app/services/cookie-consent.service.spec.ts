import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CookieConsentService } from './cookie-consent.service';

describe('CookieConsentService', () => {
  const storageKey = 'rqs_cookie_consent_v1';

  beforeEach(() => {
    localStorage.removeItem(storageKey);
    TestBed.configureTestingModule({
      providers: [
        CookieConsentService,
        { provide: PLATFORM_ID, useValue: 'browser' }
      ]
    });
  });

  afterEach(() => {
    localStorage.removeItem(storageKey);
  });

  it('starts unset with the preference banner visible', () => {
    const service = TestBed.inject(CookieConsentService);

    expect(service.preference()).toBe('unset');
    expect(service.bannerVisible()).toBeTrue();
    expect(service.analyticsAllowed()).toBeFalse();
  });

  it('persists explicit analytics consent', () => {
    const service = TestBed.inject(CookieConsentService);

    service.acceptAnalytics();

    expect(localStorage.getItem(storageKey)).toBe('analytics');
    expect(service.preference()).toBe('analytics');
    expect(service.bannerVisible()).toBeFalse();
    expect(service.analyticsAllowed()).toBeTrue();
  });

  it('persists necessary-only choice without analytics permission', () => {
    const service = TestBed.inject(CookieConsentService);

    service.necessaryOnly();

    expect(localStorage.getItem(storageKey)).toBe('necessary');
    expect(service.preference()).toBe('necessary');
    expect(service.bannerVisible()).toBeFalse();
    expect(service.analyticsAllowed()).toBeFalse();
  });
});