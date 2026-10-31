import { DOCUMENT } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { LanguageService, UiLanguage } from '../services/language.service';
import { SeoService } from '../services/seo.service';
import { LandingPageComponent } from './landing-page';

describe('LandingPageComponent', () => {
  let fixture: ComponentFixture<LandingPageComponent>;
  let language: LanguageService;

  beforeEach(async () => {
    window.localStorage.removeItem('rqs_language');
    spyOn(window, 'matchMedia').and.returnValue({
      matches: true,
      media: '(max-width: 720px)',
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    });

    await TestBed.configureTestingModule({
      imports: [LandingPageComponent],
      providers: [
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        { provide: SeoService, useValue: { update: jasmine.createSpy('update') } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingPageComponent);
    language = TestBed.inject(LanguageService);
    fixture.detectChanges();
  });

  afterEach(() => {
    window.localStorage.removeItem('rqs_language');
  });

  it('renders the four hero modules in canonical order', () => {
    const root = fixture.nativeElement as HTMLElement;
    const modules = Array.from(
      root.querySelectorAll<HTMLElement>('.console-module'),
    );

    expect(modules.map((module) => module.querySelector('small')?.textContent?.trim())).toEqual([
      'MODULE_01',
      'MODULE_02',
      'MODULE_03',
      'MODULE_04',
    ]);
    expect(modules.map((module) => module.querySelector('strong')?.textContent?.trim())).toEqual([
      'MASTER',
      'PITCH',
      'BUILD',
      'UPLINK',
    ]);
  });

  it('keeps the public module navigation ordered and anchored to existing sections', () => {
    const root = fixture.nativeElement as HTMLElement;
    const links = Array.from(
      root.querySelectorAll<HTMLAnchorElement>('.capabilities__inner a'),
    );

    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'MASTERING',
      'AI PITCH',
      'SETLIST ENGINE',
      'RQS UPLINK',
    ]);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '#master',
      '#pitch',
      '#build',
      '#uplink',
    ]);
  });

  it('places PITCH immediately after MASTER and before BUILD', () => {
    const root = fixture.nativeElement as HTMLElement;
    const master = root.querySelector<HTMLElement>('#master');
    const pitch = root.querySelector<HTMLElement>('#pitch');

    expect(master?.nextElementSibling).toBe(pitch);
    expect(pitch?.nextElementSibling?.id).toBe('build');
    expect(pitch?.querySelector('.module-label')?.textContent).toContain('MODULE_02');
  });

  it('exposes the complete human-confirmed PITCH workflow and CTA', () => {
    const root = fixture.nativeElement as HTMLElement;
    const pitch = root.querySelector<HTMLElement>('#pitch');
    const workflow = pitch?.querySelector('.pitch-flow')?.textContent ?? '';
    const cta = pitch?.querySelector<HTMLAnchorElement>('a.btn--pitch');

    expect(workflow).toContain('AUDIO');
    expect(workflow).toContain('AUDIO INTELLIGENCE / MUSIC DNA');
    expect(workflow).toContain('ARTIST CONFIRMATION');
    expect(workflow).toContain('AI PITCH');
    expect(pitch?.textContent).toContain('AI analyzes. You confirm.');
    expect(cta?.getAttribute('href')).toBe('/pitch');
  });

  it('updates the hero and PITCH editorial copy in PT, EN, PL and FR', () => {
    const expected: Record<UiLanguage, [string, string]> = {
      pt: ['Prepare seu pitch', 'A IA analisa. Você confirma.'],
      en: ['Prepare your pitch', 'AI analyzes. You confirm.'],
      pl: ['Przygotuj pitch', 'AI analizuje. Ty potwierdzasz.'],
      fr: ['Préparez votre pitch', 'L’IA analyse. Vous confirmez.'],
    };

    for (const [locale, copy] of Object.entries(expected) as [UiLanguage, [string, string]][]) {
      language.setLanguage(locale);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.hero__lead')?.textContent).toContain(copy[0]);
      expect(fixture.nativeElement.querySelector('#pitch')?.textContent).toContain(copy[1]);
    }
  });

  it('keeps the Public Beta module limits canonical in PT, EN, PL and FR', () => {
    const expected: Record<UiLanguage, string> = {
      pt: 'Limites planejados de MASTER, PITCH, BUILD e UPLINK',
      en: 'Planned limits across MASTER, PITCH, BUILD and UPLINK',
      pl: 'Planowane limity dla MASTER, PITCH, BUILD i UPLINK',
      fr: 'Limites prévues pour MASTER, PITCH, BUILD et UPLINK',
    };

    for (const [locale, copy] of Object.entries(expected) as [UiLanguage, string][]) {
      language.setLanguage(locale);
      fixture.detectChanges();

      const publicBeta = fixture.nativeElement.querySelector('.plan--pro')?.textContent ?? '';
      const moduleOrder = ['MASTER', 'PITCH', 'BUILD', 'UPLINK'].map((module) =>
        publicBeta.indexOf(module),
      );

      expect(publicBeta).toContain(copy);
      expect(publicBeta).not.toContain('MASTER, BUILD e DEPLOY');
      expect(moduleOrder.every((index) => index >= 0)).toBeTrue();
      expect(moduleOrder).toEqual([...moduleOrder].sort((a, b) => a - b));
    }
  });

  it('localizes the real-project origin story with all four modules and canonical CTA', () => {
    const expected: Record<UiLanguage, [string, string, string]> = {
      pt: ['CONSTRUÍDO DENTRO DE UM PROJETO MUSICAL REAL.', 'bastidores desse processo', 'CONHECER A RAQUEL SYNTHS →'],
      en: ['BUILT INSIDE A REAL MUSIC PROJECT.', 'story behind that process', 'DISCOVER RAQUEL SYNTHS →'],
      pl: ['STWORZONE W RAMACH PRAWDZIWEGO PROJEKTU MUZYCZNEGO.', 'kulisy tego procesu', 'POZNAJ RAQUEL SYNTHS →'],
      fr: ['CONÇU AU SEIN D’UN VÉRITABLE PROJET MUSICAL.', 'coulisses de ce processus', 'DÉCOUVRIR RAQUEL SYNTHS →'],
    };

    for (const [locale, copy] of Object.entries(expected) as [UiLanguage, [string, string, string]][]) {
      language.setLanguage(locale);
      fixture.detectChanges();

      const root = fixture.nativeElement as HTMLElement;
      const origin = root.querySelector<HTMLElement>('.origin');
      const originText = origin?.textContent ?? '';
      const cta = origin?.querySelector<HTMLAnchorElement>('.origin__copy a');
      const moduleOrder = ['MASTER', 'PITCH', 'BUILD', 'UPLINK'].map((module) =>
        originText.indexOf(module),
      );

      expect(origin?.querySelector('h2')?.textContent).toContain(copy[0]);
      expect(originText).toContain(copy[1]);
      expect(origin?.querySelectorAll('.origin__copy p').length).toBe(2);
      expect(moduleOrder.every((index) => index >= 0)).toBeTrue();
      expect(moduleOrder).toEqual([...moduleOrder].sort((a, b) => a - b));
      expect(cta?.textContent?.replace(/\s+/g, ' ').trim()).toBe(copy[2]);
      expect(cta?.getAttribute('href')).toBe('https://raquelsynths.com');
    }
  });

  it('keeps every landing motion video natively and programmatically muted', () => {
    const root = fixture.nativeElement as HTMLElement;
    const videos = Array.from(
      root.querySelectorAll<HTMLVideoElement>('video.section-motion'),
    );

    expect(videos.length).toBeGreaterThan(0);
    for (const video of videos) {
      expect(video.hasAttribute('muted')).toBeTrue();
      expect(video.hasAttribute('autoplay')).toBeTrue();
      expect(video.hasAttribute('loop')).toBeTrue();
      expect(video.hasAttribute('playsinline')).toBeTrue();
      expect(video.defaultMuted).toBeTrue();
      expect(video.muted).toBeTrue();
    }
  });

  it('keeps horizontal overflow clipped on the responsive landing shell', () => {
    const document = TestBed.inject(DOCUMENT);
    const root = fixture.nativeElement as HTMLElement;
    const landing = root.querySelector<HTMLElement>('.rqs-landing');

    expect(document.defaultView?.getComputedStyle(landing!).overflowX).toBe('hidden');
  });

  it('uses accessible light CTA text and canonical active video opacity without changing dark mode', () => {
    const document = TestBed.inject(DOCUMENT);
    const host = fixture.nativeElement as HTMLElement;
    const originalParent = host.parentNode;
    const appRoot = document.createElement('app-root');
    const primary = host.querySelector<HTMLElement>('.btn--primary');
    const master = host.querySelector<HTMLVideoElement>('.section-motion-layer--master .section-motion');
    const build = host.querySelector<HTMLVideoElement>('.section-motion-layer--build .section-motion');
    const origin = host.querySelector<HTMLVideoElement>('.section-motion-layer--origin .section-motion');
    const pricing = host.querySelector<HTMLVideoElement>('.section-motion-layer--pricing .section-motion');
    const videos = [master, build, origin, pricing] as HTMLVideoElement[];

    appRoot.setAttribute('data-theme', 'light');
    appRoot.appendChild(host);
    document.body.appendChild(appRoot);

    expect(document.defaultView?.getComputedStyle(master!).opacity).toBe('0');
    videos.forEach((video) => {
      video.style.transition = 'none';
      video.classList.add('is-active');
    });

    expect(document.defaultView?.getComputedStyle(primary!).color).toBe('rgb(255, 255, 255)');
    expect(document.defaultView?.getComputedStyle(master!).opacity).toBe('0.6');
    expect(document.defaultView?.getComputedStyle(build!).opacity).toBe('0.6');
    expect(document.defaultView?.getComputedStyle(origin!).opacity).toBe('0.56');
    expect(document.defaultView?.getComputedStyle(pricing!).opacity).toBe('0.5');

    appRoot.setAttribute('data-theme', 'dark');

    expect(document.defaultView?.getComputedStyle(primary!).color).toBe('rgb(3, 16, 20)');
    expect(document.defaultView?.getComputedStyle(master!).opacity).toBe('0.6');
    expect(document.defaultView?.getComputedStyle(build!).opacity).toBe('0.6');
    expect(document.defaultView?.getComputedStyle(origin!).opacity).toBe('0.56');
    expect(document.defaultView?.getComputedStyle(pricing!).opacity).toBe('0.5');

    originalParent?.appendChild(host);
    appRoot.remove();
  });
});
