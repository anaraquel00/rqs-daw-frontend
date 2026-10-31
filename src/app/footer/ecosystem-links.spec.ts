import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CookieConsentService } from '../services/cookie-consent.service';
import { StudioFooterComponent } from '../studio/studio-footer';
import { Footer } from './footer';

describe('Footer ecosystem links', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Footer, StudioFooterComponent],
      providers: [
        provideRouter([]),
        {
          provide: CookieConsentService,
          useValue: { openPreferences: jasmine.createSpy('openPreferences') },
        },
      ],
    }).compileComponents();
  });

  function expectCanonicalEcosystemLinks<T>(fixture: ComponentFixture<T>): void {
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const links = Array.from(
      root.querySelectorAll<HTMLAnchorElement>('.footer-col.links a'),
    );

    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      'https://raquelsynths.com/play/rqs-cyberpunk-radio?service=youtube',
      'https://raquelsynths.com',
    ]);
    expect(links.map((link) => link.textContent?.trim())).toEqual([
      'Cyberpunk Rádio',
      'RAQUEL SYNTHS',
    ]);
    expect(root.querySelector('a[href="https://raquelsynths.com/bio"]')).toBeNull();
  }

  it('uses canonical ecosystem destinations in the public footer', () => {
    expectCanonicalEcosystemLinks(TestBed.createComponent(Footer));
  });

  it('uses canonical ecosystem destinations in the Studio footer', () => {
    expectCanonicalEcosystemLinks(TestBed.createComponent(StudioFooterComponent));
  });
});
