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
});
