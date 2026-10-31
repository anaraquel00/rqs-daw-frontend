import { Component, Input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { StudioShellComponent } from './studio-shell';
import { PITCH_ROUTES, STUDIO_ROUTES } from './studio.routes';
import { AuthService } from '../services/auth.service';
import { LanguageService } from '../services/language.service';
import { CookieConsentService } from '../services/cookie-consent.service';
import { UploadZoneComponent } from '../components/upload-zone/upload-zone';
import { MixPanelComponent } from '../mix-panel/mix-panel';
import { RqsUplinkEngineComponent } from '../rqs-uplink-engine/rqs-uplink-engine';
import { RqsUplinkDashboardComponent } from '../components/rqs-uplink-dashboard/rqs-uplink-dashboard';
import { AuthPromptComponent } from '../components/auth-prompt/auth-prompt';

@Component({ selector: 'app-upload-zone', template: '<input aria-label="Source marker" value="retained-audio">' }) class MasterStub { @Input() workspace: 'master' | 'pitch' = 'master'; }
@Component({ selector: 'app-mix-panel', template: 'BUILD existing entry' }) class BuildStub {}
@Component({ selector: 'app-rqs-uplink-engine', template: 'UPLINK existing entry' }) class UplinkStub {}
@Component({ selector: 'app-rqs-uplink-dashboard', template: 'UPLINK list' }) class DashboardStub {}
@Component({ selector: 'app-auth-prompt', template: '' }) class AuthStub {}

describe('Studio V2 shell integration', () => {
  let harness: RouterTestingHarness;
  const session = signal<any>(null);
  const premium = signal(false);
  const isLoggedIn = () => !!session()?.user;
  const requestSignIn = jasmine.createSpy('requestSignIn');
  const requestSignInForPath = jasmine.createSpy('requestSignInForPath');
  beforeEach(async () => {
    localStorage.removeItem('rqs_theme');
    session.set({ user: { id: 'owner-a', email: 'owner@example.invalid' } });
    premium.set(false);
    requestSignIn.calls.reset();
    requestSignInForPath.calls.reset();
    TestBed.configureTestingModule({ providers: [
      provideRouter([{ path: 'app', children: STUDIO_ROUTES }, { path: 'pitch', children: PITCH_ROUTES }]),
      { provide: AuthService, useValue: {
        session,
        isLoggedIn,
        isPremium: premium,
        remainingMasters: () => 2,
        requestSignIn,
        requestSignInForPath,
        loginWithProvider: jasmine.createSpy(),
        logout: jasmine.createSpy(),
        whenAuthStateResolved: () => Promise.resolve(),
      } },
      { provide: CookieConsentService, useValue: { openPreferences: jasmine.createSpy() } },
    ] });
    TestBed.overrideComponent(StudioShellComponent, {
      remove: { imports: [UploadZoneComponent, MixPanelComponent, RqsUplinkEngineComponent, RqsUplinkDashboardComponent, AuthPromptComponent] },
      add: { imports: [MasterStub, BuildStub, UplinkStub, DashboardStub, AuthStub] },
    });
    harness = await RouterTestingHarness.create('/app');
    document.body.appendChild(harness.fixture.nativeElement);
    harness.detectChanges();
  });
  afterEach(() => { localStorage.removeItem('rqs_theme'); harness.fixture.nativeElement.remove(); });

  it('defaults to DARK and persists explicit LIGHT and AUTO preferences', () => {
    const host = harness.routeNativeElement!.closest('app-studio-shell') as HTMLElement;
    expect(host.dataset['theme']).toBe('dark');

    const buttons = Array.from(harness.routeNativeElement!.querySelectorAll('.theme-selector button')) as HTMLButtonElement[];
    buttons.find(button => button.textContent?.trim() === 'LIGHT')!.click();
    harness.detectChanges();
    expect(host.dataset['theme']).toBe('light');
    expect(localStorage.getItem('rqs_theme')).toBe('light');

    buttons.find(button => button.textContent?.trim() === 'AUTO')!.click();
    harness.detectChanges();
    expect(host.dataset['theme']).toBe(window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    expect(localStorage.getItem('rqs_theme')).toBe('auto');
  });

  it('restores a persisted explicit theme in a new shell instance', () => {
    localStorage.setItem('rqs_theme', 'light');
    const fixture = TestBed.createComponent(StudioShellComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.dataset['theme']).toBe('light');
    fixture.destroy();
  });

  it('renders the exact four approved module gateways and shared shell', () => {
    const root = harness.routeNativeElement!;
    expect(Array.from(root.querySelectorAll('.module-card h2')).map(e => e.textContent)).toEqual(['MASTER', 'PITCH', 'BUILD', 'UPLINK']);
    expect(root.querySelector('#module-pitch [data-icon="square-pen"]')).not.toBeNull();
    expect(root.querySelector('#module-pitch .module-icon')?.textContent).not.toContain('✦');
    expect(root.querySelector('header')).not.toBeNull();
    expect(root.querySelector('footer')).not.toBeNull();
    expect(root.querySelector('app-upload-zone')).toBeNull();
  });
  it('uses canonical /app links plus the first-class /pitch route throughout the shell', () => {
    const links = Array.from(harness.routeNativeElement!.querySelectorAll('a[href]')) as HTMLAnchorElement[];
    const internalStudioLinks = links.map(link => link.getAttribute('href')).filter(path => path?.startsWith('/app'));
    expect(internalStudioLinks.length).toBeGreaterThan(0);
    expect(links.some(link => link.getAttribute('href') === '/pitch')).toBeTrue();
    expect(links.some(link => link.getAttribute('href')?.startsWith('/studio'))).toBeFalse();
  });
  it('opens each module through the selector and retains only one visible workspace', async () => {
    for (const name of ['master', 'pitch', 'build', 'uplink']) {
      await harness.navigateByUrl('/app');
      (harness.routeNativeElement!.querySelector(`#module-${name}`) as HTMLAnchorElement).click();
      await harness.fixture.whenStable(); harness.detectChanges();
      expect(TestBed.inject(Router).url).toBe(name === 'pitch' ? '/pitch' : `/app/${name}`);
      expect(harness.routeNativeElement!.querySelectorAll('section:not([hidden])').length).toBe(1);
      expect(harness.routeNativeElement!.querySelector(`section[aria-label="${name.toUpperCase()}"]`)).not.toBeNull();
    }
  });
  it('renders the first-class PITCH route with the dedicated upload workspace', async () => {
    await harness.navigateByUrl('/pitch?analysis=00000000-0000-4000-8000-000000000040');
    harness.detectChanges();

    const pitchSection = harness.routeNativeElement!.querySelector('section[aria-label="PITCH"]');
    const upload = harness.fixture.debugElement.queryAll(By.directive(MasterStub))
      .find(debug => debug.componentInstance.workspace === 'pitch')?.componentInstance as MasterStub | undefined;

    expect(pitchSection).not.toBeNull();
    expect(upload?.workspace).toBe('pitch');
    expect(TestBed.inject(Router).url).toContain('/pitch?analysis=');
  });
  it('preserves the MASTER instance and local input across selector and BUILD navigation', async () => {
    await harness.navigateByUrl('/app/master');
    const source = harness.routeNativeElement!.querySelector('input')!;
    source.value = 'user-selected-file';
    await harness.navigateByUrl('/app/build');
    expect(source.closest('section')!.hidden).toBeTrue();
    expect(source.closest('section')!.hasAttribute('inert')).toBeTrue();
    await harness.navigateByUrl('/app');
    await harness.navigateByUrl('/app/master');
    expect(harness.routeNativeElement!.querySelector('input')).toBe(source);
    expect(source.value).toBe('user-selected-file');
  });
  it('opens authentication when unauthenticated users request PITCH or MASTER', async () => {
    session.set(null);
    harness.detectChanges();

    await harness.navigateByUrl('/pitch');
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/app');
    expect(harness.routeNativeElement!.querySelector('section[aria-label="PITCH"]')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('input[type=file]')).toBeNull();
    expect(requestSignInForPath).toHaveBeenCalledWith('/pitch', 'providers');

    await harness.navigateByUrl('/app/master');
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/app');
    expect(harness.routeNativeElement!.querySelector('section[aria-label="MASTER"]')).toBeNull();
    expect(requestSignInForPath).toHaveBeenCalledWith('/app/master', 'providers');
  });
  it('removes PITCH immediately and redirects when the active session signs out', async () => {
    await harness.navigateByUrl('/pitch');
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('section[aria-label="PITCH"]')).not.toBeNull();

    session.set(null);
    harness.detectChanges();
    expect(harness.routeNativeElement!.querySelector('section[aria-label="PITCH"]')).toBeNull();
    expect(harness.routeNativeElement!.querySelector('input[type=file]')).toBeNull();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/app');
  });
  it('allows PITCH again after authentication is restored', async () => {
    session.set(null);
    await harness.navigateByUrl('/pitch');
    expect(TestBed.inject(Router).url).toBe('/app');

    session.set({ user: { id: 'owner-a', email: 'owner@example.invalid' } });
    harness.detectChanges();
    await harness.navigateByUrl('/pitch');
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/pitch');
    expect(harness.routeNativeElement!.querySelector('section[aria-label="PITCH"]')).not.toBeNull();
  });
  it('clears retained engine views at a user-to-user identity boundary', async () => {
    session.set({ user: { id: 'owner-a', email: 'first@example.invalid' } });
    harness.detectChanges(); await harness.fixture.whenStable();
    await harness.navigateByUrl('/app/master');
    const source = harness.routeNativeElement!.querySelector('input');
    session.set({ user: { id: 'owner-b', email: 'test@example.invalid' } });
    harness.detectChanges(); await harness.fixture.whenStable(); harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/app');
    expect(harness.routeNativeElement!.querySelector('input')).toBeNull();
    await harness.navigateByUrl('/app/master');
    expect(harness.routeNativeElement!.querySelector('input')).not.toBe(source);
  });
  it('uses existing sign-in and profile/quota state in Account', async () => {
    session.set(null);
    harness.detectChanges();
    await harness.navigateByUrl('/app/account');
    (harness.routeNativeElement!.querySelector('.simple-surface button') as HTMLButtonElement).click();
    expect(requestSignIn).toHaveBeenCalledWith('general', 'email');
    session.set({ user: { id: 'owner', email: 'test@example.invalid' } }); premium.set(true);
    harness.detectChanges(); await harness.fixture.whenStable();
    await harness.navigateByUrl('/app/account');
    expect(harness.routeNativeElement!.textContent).toContain('RQS PRO');
    expect(harness.routeNativeElement!.textContent).toContain('test@example.invalid');
  });
  it('exposes Learn and SPLIT without creating processing or billing controls', async () => {
    for (const path of ['learn', 'split']) {
      await harness.navigateByUrl(`/app/${path}`);
      const root = harness.routeNativeElement!;
      expect(root.querySelector('.simple-surface h1')).not.toBeNull();
      expect(root.querySelector('input[type=file]')).toBeNull();
      expect(root.querySelector('app-upload-zone')).toBeNull();
      expect(root.querySelector('app-mix-panel')).toBeNull();
    }
  });
  it('restores SEO metadata across home, operational and account navigation', async () => {
    TestBed.inject(LanguageService).setLanguage('en');
    await harness.navigateByUrl('/app');
    expect(document.title).toBe('RQS Studio Apps | Online Mastering, Editorial Pitch, Setlists & Music Links');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index, follow');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://studio.raquelsynths.com/app');

    await harness.navigateByUrl('/app/master');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, follow');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://studio.raquelsynths.com/app/master');

    await harness.navigateByUrl('/app/account');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');

    await harness.navigateByUrl('/app');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index, follow');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://studio.raquelsynths.com/app');
    expect(document.querySelectorAll('meta[name="robots"]').length).toBe(1);
    expect(document.querySelectorAll('link[rel="canonical"]').length).toBe(1);
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
