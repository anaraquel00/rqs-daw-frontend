import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ViewportScroller } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { AnalyticsService } from '../services/analytics.service';
import { AuthService } from '../services/auth.service';
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
        { provide: AuthService, useValue: { isLoggedIn: signal(true) } },
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

  it('does not report waitlist_joined after an HTTP error', async () => {
    spyOn(globalThis, 'fetch').and.resolveTo(new Response(
      JSON.stringify({ success: false }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    ));

    await component.joinWaitlist();

    expect(component.waitlistState()).toBe('error');
    expect(analytics.trackEvent).not.toHaveBeenCalledWith('waitlist_joined', jasmine.anything());
  });

  it('does not report waitlist_joined when persistence reports failure', async () => {
    spyOn(globalThis, 'fetch').and.resolveTo(new Response(
      JSON.stringify({ success: false, error: 'persistence failed' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    await component.joinWaitlist();

    expect(component.waitlistState()).toBe('error');
    expect(analytics.trackEvent).not.toHaveBeenCalledWith('waitlist_joined', jasmine.anything());
  });

  it('reports waitlist_joined only after a newly persisted subscription', async () => {
    const request = spyOn(globalThis, 'fetch').and.resolveTo(new Response(
      JSON.stringify({ success: true, alreadyJoined: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    await component.joinWaitlist();

    expect(component.waitlistState()).toBe('success');
    expect(analytics.trackEvent).toHaveBeenCalledOnceWith('waitlist_joined', {
      desired_plan: 'unknown',
    });
    const options = request.calls.mostRecent().args[1] as RequestInit;
    expect(JSON.parse(String(options.body))).toEqual(jasmine.objectContaining({
      email: 'artist@example.com',
      plan_interest: 'undecided',
    }));
  });

  it('shows an already-joined state without reporting a duplicate conversion', async () => {
    spyOn(globalThis, 'fetch').and.resolveTo(new Response(
      JSON.stringify({ success: true, alreadyJoined: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    await component.joinWaitlist();

    expect(component.waitlistState()).toBe('already-joined');
    expect(analytics.trackEvent).not.toHaveBeenCalledWith('waitlist_joined', jasmine.anything());
    expect(analytics.trackEvent).not.toHaveBeenCalledWith('referral_waitlist_joined');
  });

  it('persists the selected canonical plan interest in the existing waitlist request', async () => {
    (component as unknown as { desiredPlan: 'pro' }).desiredPlan = 'pro';
    const request = spyOn(globalThis, 'fetch').and.resolveTo(new Response(
      JSON.stringify({ success: true, alreadyJoined: false }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ));

    await component.joinWaitlist();

    const options = request.calls.mostRecent().args[1] as RequestInit;
    expect(JSON.parse(String(options.body)).plan_interest).toBe('pro');
    expect(analytics.trackEvent).toHaveBeenCalledOnceWith('waitlist_joined', {
      desired_plan: 'pro',
    });
  });
});
