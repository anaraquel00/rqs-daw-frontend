import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { StudioShellComponent } from './studio-shell';
import { STUDIO_ROUTES } from './studio.routes';
import { AuthService } from '../services/auth.service';
import { LanguageService } from '../services/language.service';
import { CookieConsentService } from '../services/cookie-consent.service';
import { UploadZoneComponent } from '../components/upload-zone/upload-zone';
import { MixPanelComponent } from '../mix-panel/mix-panel';
import { RqsUplinkEngineComponent } from '../rqs-uplink-engine/rqs-uplink-engine';
import { RqsUplinkDashboardComponent } from '../components/rqs-uplink-dashboard/rqs-uplink-dashboard';
import { AuthPromptComponent } from '../components/auth-prompt/auth-prompt';

@Component({ selector: 'app-upload-zone', template: '<input aria-label="Source marker" value="retained-audio">' }) class MasterStub {}
@Component({ selector: 'app-mix-panel', template: 'BUILD existing entry' }) class BuildStub {}
@Component({ selector: 'app-rqs-uplink-engine', template: 'UPLINK existing entry' }) class UplinkStub {}
@Component({ selector: 'app-rqs-uplink-dashboard', template: 'UPLINK list' }) class DashboardStub {}
@Component({ selector: 'app-auth-prompt', template: '' }) class AuthStub {}

describe('Studio V2 shell integration', () => {
  let harness: RouterTestingHarness;
  const session = signal<any>(null);
  const premium = signal(false);
  const requestSignIn = jasmine.createSpy('requestSignIn');
  beforeEach(async () => {
    session.set(null); premium.set(false); requestSignIn.calls.reset();
    TestBed.configureTestingModule({ providers: [
      provideRouter([{ path: 'studio', children: STUDIO_ROUTES }]),
      { provide: AuthService, useValue: { session, isPremium: premium, remainingMasters: () => 2, requestSignIn, loginWithProvider: jasmine.createSpy(), logout: jasmine.createSpy() } },
      { provide: CookieConsentService, useValue: { openPreferences: jasmine.createSpy() } },
    ] });
    TestBed.overrideComponent(StudioShellComponent, {
      remove: { imports: [UploadZoneComponent, MixPanelComponent, RqsUplinkEngineComponent, RqsUplinkDashboardComponent, AuthPromptComponent] },
      add: { imports: [MasterStub, BuildStub, UplinkStub, DashboardStub, AuthStub] },
    });
    harness = await RouterTestingHarness.create('/studio');
    document.body.appendChild(harness.fixture.nativeElement);
    harness.detectChanges();
  });
  afterEach(() => harness.fixture.nativeElement.remove());

  it('renders the exact four approved module gateways and shared shell', () => {
    const root = harness.routeNativeElement!;
    expect(Array.from(root.querySelectorAll('.module-card h2')).map(e => e.textContent)).toEqual(['MASTER', 'SPLIT', 'BUILD', 'UPLINK']);
    expect(root.querySelector('header')).not.toBeNull();
    expect(root.querySelector('footer')).not.toBeNull();
    expect(root.querySelector('app-upload-zone')).toBeNull();
  });
  it('opens each module through the selector and retains only one visible workspace', async () => {
    for (const name of ['master', 'build', 'uplink']) {
      await harness.navigateByUrl('/studio');
      (harness.routeNativeElement!.querySelector(`#module-${name}`) as HTMLAnchorElement).click();
      await harness.fixture.whenStable(); harness.detectChanges();
      expect(TestBed.inject(Router).url).toBe(`/studio/${name}`);
      expect(harness.routeNativeElement!.querySelectorAll('section:not([hidden])').length).toBe(1);
      expect(harness.routeNativeElement!.querySelector(`section[aria-label="${name.toUpperCase()}"]`)).not.toBeNull();
    }
  });
  it('preserves the MASTER instance and local input across selector and BUILD navigation', async () => {
    await harness.navigateByUrl('/studio/master');
    const source = harness.routeNativeElement!.querySelector('input')!;
    source.value = 'user-selected-file';
    await harness.navigateByUrl('/studio/build');
    expect(source.closest('section')!.hidden).toBeTrue();
    expect(source.closest('section')!.hasAttribute('inert')).toBeTrue();
    await harness.navigateByUrl('/studio');
    await harness.navigateByUrl('/studio/master');
    expect(harness.routeNativeElement!.querySelector('input')).toBe(source);
    expect(source.value).toBe('user-selected-file');
  });
  it('clears retained engine views at a user identity boundary', async () => {
    await harness.navigateByUrl('/studio/master');
    const source = harness.routeNativeElement!.querySelector('input');
    session.set({ user: { id: 'owner-b', email: 'test@example.invalid' } });
    harness.detectChanges(); await harness.fixture.whenStable(); harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/studio');
    expect(harness.routeNativeElement!.querySelector('input')).toBeNull();
    await harness.navigateByUrl('/studio/master');
    expect(harness.routeNativeElement!.querySelector('input')).not.toBe(source);
  });
  it('uses existing sign-in and profile/quota state in Account', async () => {
    await harness.navigateByUrl('/studio/account');
    (harness.routeNativeElement!.querySelector('.simple-surface button') as HTMLButtonElement).click();
    expect(requestSignIn).toHaveBeenCalledWith('general', 'email');
    session.set({ user: { id: 'owner', email: 'test@example.invalid' } }); premium.set(true);
    harness.detectChanges(); await harness.fixture.whenStable();
    await harness.navigateByUrl('/studio/account');
    expect(harness.routeNativeElement!.textContent).toContain('RQS PRO');
    expect(harness.routeNativeElement!.textContent).toContain('test@example.invalid');
  });
  it('exposes Learn and SPLIT without creating processing or billing controls', async () => {
    for (const path of ['learn', 'split']) {
      await harness.navigateByUrl(`/studio/${path}`);
      const root = harness.routeNativeElement!;
      expect(root.querySelector('.simple-surface h1')).not.toBeNull();
      expect(root.querySelector('input[type=file]')).toBeNull();
      expect(root.querySelector('app-upload-zone')).toBeNull();
      expect(root.querySelector('app-mix-panel')).toBeNull();
    }
  });
  it('keeps navigation localized for all four supported languages', () => {
    for (const code of ['en', 'pt', 'pl', 'fr'] as const) {
      TestBed.inject(LanguageService).setLanguage(code); harness.detectChanges();
      expect(harness.routeNativeElement!.querySelectorAll('.module-card').length).toBe(4);
      expect(harness.routeNativeElement!.querySelector(`.languages [aria-pressed=true]`)!.textContent?.trim()).toBe(code === 'pt' ? 'PT-BR' : code.toUpperCase());
    }
  });
  it('fits the viewport and switches the grid at the approved mobile breakpoint', () => {
    const root = harness.routeNativeElement!;
    const grid = root.querySelector('.module-grid')!;
    const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
    expect(columns).toBe(window.innerWidth < 768 ? 1 : 2);
    for (const element of Array.from(root.querySelectorAll('header, footer, .module-card, .studio-navigation'))) {
      expect(element.getBoundingClientRect().right).toBeLessThanOrEqual(window.innerWidth + 1);
      expect(element.getBoundingClientRect().left).toBeGreaterThanOrEqual(0);
    }
  });
});
