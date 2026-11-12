import { signal, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { routes } from '../app.routes';
import { AdminApiService } from '../core/admin-api.service';
import { AdminAuthService } from '../core/admin-auth.service';
import { AdminSeoService } from '../core/admin-seo.service';
import { ForbiddenComponent } from './forbidden.component';
import { OverviewComponent } from './overview.component';
import { ReferralsComponent } from './referrals.component';
import { WaitlistComponent } from './waitlist.component';

describe('admin pages', () => {
  const api = {
    overview: jasmine.createSpy('overview'),
    waitlistSummary: jasmine.createSpy('waitlistSummary'),
    waitlistRecords: jasmine.createSpy('waitlistRecords'),
    referralSummary: jasmine.createSpy('referralSummary'),
    referralRecords: jasmine.createSpy('referralRecords'),
    actionsConfig: jasmine.createSpy('actionsConfig'),
    requestReviewFlag: jasmine.createSpy('requestReviewFlag'),
    confirmAction: jasmine.createSpy('confirmAction'),
    cancelAction: jasmine.createSpy('cancelAction'),
  };
  const seo = { setCanonical: jasmine.createSpy('setCanonical') };

  beforeEach(() => {
    api.overview.calls.reset();
    api.waitlistSummary.calls.reset();
    api.waitlistRecords.calls.reset();
    api.referralSummary.calls.reset();
    api.referralRecords.calls.reset();
    api.actionsConfig.calls.reset();
    api.requestReviewFlag.calls.reset();
    api.confirmAction.calls.reset();
    api.cancelAction.calls.reset();

    api.actionsConfig.and.resolveTo({
      enabled: false,
      mode: 'disabled',
      dataEnvironment: 'production',
    });

    seo.setCanonical.calls.reset();
  });

  it('renders expanded Phase 2 overview without PII', async () => {
    api.overview.and.resolveTo({
      waitlistTotal: 123,
      foundingReferralParticipants: 17,
      activeFoundingReferralParticipants: 11,
      referralAttributedWaitlist: 29,
      byPlanInterest: { master: 20, plus: 18, pro: 40, undecided: 15, unknown: 30 },
      byLanguage: { pt: 60, en: 34, pl: 10, fr: 9, unknown: 10 },
      systemStatus: 'operational',
      generatedAt: '2026-11-09T12:00:00.000Z',
    });

    const fixture = await create(OverviewComponent);
    const text = fixture.nativeElement.textContent;

    for (const value of ['123', '17', '11', '29', 'MASTER', 'UNKNOWN / LEGACY']) {
      expect(text).toContain(value);
    }
    expect(text).not.toContain('@');
    expect(seo.setCanonical).toHaveBeenCalledWith('/');
  });

  it('renders an explicit overview API failure state', async () => {
    api.overview.and.rejectWith(new Error('unavailable'));
    const fixture = await create(OverviewComponent);
    expect(fixture.nativeElement.textContent).toContain('ADMIN API UNAVAILABLE');
  });

  it('renders waitlist summary and masked records with explicit legacy values', async () => {
    api.waitlistSummary.and.resolveTo({
      total: 100,
      byPlanInterest: { master: 22, plus: 14, pro: 31, undecided: 8, unknown: 25 },
      generatedAt: '2026-11-09T12:00:00.000Z',
    });
    api.waitlistRecords.and.resolveTo({
      records: [{
        id: 'record-1',
        maskedEmail: 'an***@example.com',
        planInterest: 'unknown',
        status: 'waiting',
        language: 'unknown',
        source: 'studio.raquelsynths.com',
        createdAt: '2026-11-09T12:00:00.000Z',
        planInterestUpdatedAt: null,
        referralAttributed: true,
        referralStatus: 'waitlisted',
        referralCapturedAt: '2026-11-09T12:00:00.000Z',
      }],
      nextCursor: 'opaque-next',
      limit: 25,
      filters: {},
      generatedAt: '2026-11-09T12:00:00.000Z',
    });

    const fixture = await create(WaitlistComponent);
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('an***@example.com');
    expect(text).toContain('MASKED');
    expect(text).toContain('UNKNOWN / LEGACY');
    expect(text).toContain('WAITLISTED');
    expect(text).not.toContain('ana@example.com');
    expect(api.waitlistRecords).toHaveBeenCalledWith(jasmine.objectContaining({ limit: 25 }));
    expect(seo.setCanonical).toHaveBeenCalledWith('/waitlist');
  });

  it('renders waitlist API unavailable state without mutation controls', async () => {
    api.waitlistSummary.and.resolveTo({
      total: 0,
      byPlanInterest: { master: 0, plus: 0, pro: 0, undecided: 0, unknown: 0 },
      generatedAt: '2026-11-09T12:00:00.000Z',
    });
    api.waitlistRecords.and.rejectWith(new Error('unavailable'));

    const fixture = await create(WaitlistComponent);
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('WAITLIST RECORDS API UNAVAILABLE');
    expect(text).not.toContain('DELETE');
    expect(text).not.toContain('EDIT');
    expect(text).not.toContain('QUALIFY');
  });

  it('applies waitlist filters server-side and resets pagination state', async () => {
    api.waitlistSummary.and.resolveTo({
      total: 1,
      byPlanInterest: { master: 1, plus: 0, pro: 0, undecided: 0, unknown: 0 },
      generatedAt: '2026-11-09T12:00:00.000Z',
    });
    api.waitlistRecords.and.resolveTo({
      records: [],
      nextCursor: null,
      limit: 25,
      filters: {},
      generatedAt: '2026-11-09T12:00:00.000Z',
    });

    const fixture = await create(WaitlistComponent);
    api.waitlistRecords.calls.reset();

    fixture.componentInstance.planInterest.set('master');
    fixture.componentInstance.language.set('pt');
    fixture.componentInstance.referralAttributed.set('true');
    await fixture.componentInstance.applyFilters();

    expect(api.waitlistRecords).toHaveBeenCalledWith(jasmine.objectContaining({
      limit: 25,
      cursor: null,
      planInterest: 'master',
      language: 'pt',
      referralAttributed: 'true',
    }));
    expect(fixture.componentInstance.cursorHistory()).toEqual([]);
  });

  it('renders referral summary and masked operational records only', async () => {
    api.referralSummary.and.resolveTo({
      total: 7,
      active: 5,
      attributedWaitlist: 16,
      generatedAt: '2026-11-09T12:00:00.000Z',
    });
    api.referralRecords.and.resolveTo({
      records: [{
        id: 'a'.repeat(64),
        campaignId: 'founding-2026',
        status: 'active',
        termsVersion: '2026-10-31',
        termsAcceptedAt: '2026-11-01T00:00:00.000Z',
        eligibleFrom: '2026-10-31T00:00:00.000Z',
        captureEndsAt: null,
        createdAt: '2026-11-01T00:00:00.000Z',
        maskedReferralCode: 'RQS***H2',
        referredCount: 5,
        pendingCount: 2,
        qualifiedCount: 2,
        discountPercent: 20,
      }],
      nextCursor: null,
      limit: 25,
      filters: {},
      generatedAt: '2026-11-09T12:00:00.000Z',
    });

    const fixture = await create(ReferralsComponent);
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('RQS***H2');
    expect(text).toContain('MASKED');
    expect(text).toContain('20%');
    expect(text).not.toContain('referrerUserId');
    expect(text).not.toContain('emailFingerprint');
    expect(text).not.toContain('DELETE');
    expect(text).not.toContain('QUALIFY');
    expect(seo.setCanonical).toHaveBeenCalledWith('/referrals');
  });

  it('renders referral empty and API failure states', async () => {
    api.referralSummary.and.resolveTo({
      total: 0,
      active: 0,
      attributedWaitlist: 0,
      generatedAt: '2026-11-09T12:00:00.000Z',
    });
    api.referralRecords.and.resolveTo({
      records: [],
      nextCursor: null,
      limit: 25,
      filters: {},
      generatedAt: '2026-11-09T12:00:00.000Z',
    });

    let fixture = await create(ReferralsComponent);
    expect(fixture.nativeElement.textContent).toContain('EMPTY DATASET FOR CURRENT FILTERS');

    TestBed.resetTestingModule();
    api.referralSummary.and.rejectWith(new Error('unavailable'));
    api.referralRecords.and.rejectWith(new Error('unavailable'));

    fixture = await create(ReferralsComponent);
    expect(fixture.nativeElement.textContent).toContain('REFERRAL SUMMARY API UNAVAILABLE');
    expect(fixture.nativeElement.textContent).toContain('REFERRAL RECORDS API UNAVAILABLE');
  });

  it('keeps referrals inside the existing owner-guarded admin route', () => {
    const protectedRoot = routes.find(route => route.path === '');
    expect(protectedRoot?.canActivate?.length).toBeGreaterThan(0);
    expect(protectedRoot?.children?.some(route => route.path === 'referrals')).toBeTrue();
  });

  it('keeps review mutation controls hidden when actions are disabled', async () => {
    api.waitlistSummary.and.resolveTo({
      total: 1,
      byPlanInterest: {
        master: 1,
        plus: 0,
        pro: 0,
        undecided: 0,
        unknown: 0,
      },
      generatedAt: '2026-11-11T20:00:00.000Z',
    });

    api.waitlistRecords.and.resolveTo({
      records: [{
        id: 'record-1',
        maskedEmail: 'an***@example.com',
        planInterest: 'master',
        status: 'waiting',
        language: 'pt',
        source: 'studio.raquelsynths.com',
        createdAt: '2026-11-11T20:00:00.000Z',
        planInterestUpdatedAt: null,
        referralAttributed: false,
        referralStatus: 'unknown',
        referralCapturedAt: null,
      }],
      nextCursor: null,
      limit: 25,
      filters: {},
      generatedAt: '2026-11-11T20:00:00.000Z',
    });

    const fixture =
      await create(WaitlistComponent);

    expect(
      fixture.nativeElement.textContent,
    ).not.toContain(
      'FLAG FOR REVIEW',
    );
  });

  it('shows controlled review entry point only when staging capability is enabled', async () => {
    api.actionsConfig.and.resolveTo({
      enabled: true,
      mode: 'internal-review',
      dataEnvironment: 'staging',
    });

    api.waitlistSummary.and.resolveTo({
      total: 1,
      byPlanInterest: {
        master: 1,
        plus: 0,
        pro: 0,
        undecided: 0,
        unknown: 0,
      },
      generatedAt: '2026-11-11T20:00:00.000Z',
    });

    api.waitlistRecords.and.resolveTo({
      records: [{
        id: 'record-1',
        maskedEmail: 'an***@example.com',
        planInterest: 'master',
        status: 'waiting',
        language: 'pt',
        source: 'studio.raquelsynths.com',
        createdAt: '2026-11-11T20:00:00.000Z',
        planInterestUpdatedAt: null,
        referralAttributed: false,
        referralStatus: 'unknown',
        referralCapturedAt: null,
      }],
      nextCursor: null,
      limit: 25,
      filters: {},
      generatedAt: '2026-11-11T20:00:00.000Z',
    });

    const fixture =
      await create(WaitlistComponent);

    expect(
      fixture.nativeElement.textContent,
    ).toContain(
      'FLAG FOR REVIEW',
    );
  });

  it('renders forbidden copy without exposing RBAC internals', async () => {
    await TestBed.configureTestingModule({
      imports: [ForbiddenComponent],
      providers: [
        provideRouter([]),
        { provide: AdminSeoService, useValue: seo },
        { provide: AdminAuthService, useValue: { session: signal(null), signOut: () => Promise.resolve() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ForbiddenComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('ACCESS DENIED');
    expect(fixture.nativeElement.textContent).not.toContain('studio_admin_memberships');
    expect(TestBed.inject(Router)).toBeTruthy();
  });

  async function create<T>(component: Type<T>): Promise<ComponentFixture<T>> {
    await TestBed.configureTestingModule({
      imports: [component],
      providers: [
        { provide: AdminApiService, useValue: api },
        { provide: AdminSeoService, useValue: seo },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
});
