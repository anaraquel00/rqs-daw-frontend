import { signal, Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AdminApiService } from '../core/admin-api.service';
import { AdminAuthService } from '../core/admin-auth.service';
import { AdminSeoService } from '../core/admin-seo.service';
import { ForbiddenComponent } from './forbidden.component';
import { OverviewComponent } from './overview.component';
import { WaitlistComponent } from './waitlist.component';

describe('admin pages', () => {
  const api = {
    overview: jasmine.createSpy('overview'),
    waitlistSummary: jasmine.createSpy('waitlistSummary'),
  };
  const seo = { setCanonical: jasmine.createSpy('setCanonical') };

  beforeEach(() => {
    api.overview.calls.reset();
    api.waitlistSummary.calls.reset();
    seo.setCanonical.calls.reset();
  });

  it('renders overview aggregate success without PII', async () => {
    api.overview.and.resolveTo({
      waitlistTotal: 123,
      foundingReferralParticipants: 17,
      systemStatus: 'operational',
      generatedAt: '2026-11-09T12:00:00.000Z',
    });
    const fixture = await create(OverviewComponent);
    expect(fixture.nativeElement.textContent).toContain('123');
    expect(fixture.nativeElement.textContent).toContain('17');
    expect(fixture.nativeElement.textContent).not.toContain('@');
    expect(seo.setCanonical).toHaveBeenCalledWith('/');
  });

  it('renders an explicit overview API failure state', async () => {
    api.overview.and.rejectWith(new Error('unavailable'));
    const fixture = await create(OverviewComponent);
    expect(fixture.nativeElement.textContent).toContain('ADMIN API UNAVAILABLE');
  });

  it('renders waitlist aggregate success and legacy unknown', async () => {
    api.waitlistSummary.and.resolveTo({
      total: 100,
      byPlanInterest: { master: 22, plus: 14, pro: 31, undecided: 8, unknown: 25 },
      generatedAt: '2026-11-09T12:00:00.000Z',
    });
    const fixture = await create(WaitlistComponent);
    const text = fixture.nativeElement.textContent;
    for (const value of ['100', '22', '14', '31', '8', '25']) expect(text).toContain(value);
    expect(text).not.toContain('@');
    expect(seo.setCanonical).toHaveBeenCalledWith('/waitlist');
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
