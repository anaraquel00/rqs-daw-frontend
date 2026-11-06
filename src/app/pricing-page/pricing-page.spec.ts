import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ViewportScroller } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AnalyticsService } from '../services/analytics.service';
import { LanguageService } from '../services/language.service';
import { SeoService } from '../services/seo.service';
import { ThemeService } from '../services/theme.service';
import { PricingPageComponent } from './pricing-page';

describe('PricingPageComponent waitlist analytics', () => {
  let component: PricingPageComponent;
  let analytics: jasmine.SpyObj<AnalyticsService>;

  beforeEach(() => {
    analytics = jasmine.createSpyObj<AnalyticsService>('AnalyticsService', ['trackEvent']);

    TestBed.configureTestingModule({
      providers: [
        { provide: AnalyticsService, useValue: analytics },
        {
          provide: LanguageService,
          useValue: {
            currentLang: signal('en'),
            tr: signal({ PRICING: {} }),
          },
        },
        {
          provide: ThemeService,
          useValue: {
            themes: [],
            themePreference: signal('system'),
            setTheme: jasmine.createSpy('setTheme'),
          },
        },
        { provide: SeoService, useValue: { update: jasmine.createSpy('update') } },
        { provide: ViewportScroller, useValue: { scrollToPosition: jasmine.createSpy('scrollToPosition') } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: { get: () => null } } },
        },
      ],
    });

    component = TestBed.runInInjectionContext(() => new PricingPageComponent());
    component.waitlistEmail = 'artist@example.com';
  });

  it('does not report waitlist_joined when the API rejects the subscription', async () => {
    spyOn(globalThis, 'fetch').and.resolveTo(new Response(
      JSON.stringify({ success: false }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    ));

    await component.joinWaitlist();

    expect(component.waitlistState()).toBe('error');
    expect(analytics.trackEvent).not.toHaveBeenCalledWith('waitlist_joined', jasmine.anything());
  });

  it('reports waitlist_joined only after a successful API response', async () => {
    spyOn(globalThis, 'fetch').and.resolveTo(new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    await component.joinWaitlist();

    expect(component.waitlistState()).toBe('success');
    expect(analytics.trackEvent).toHaveBeenCalledOnceWith('waitlist_joined', {
      desired_plan: 'unknown',
    });
  });
});
