import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AnalyticsService } from '../../services/analytics.service';
import {
  EN_TRANSLATIONS,
  FR_TRANSLATIONS,
  LanguageService,
  PL_TRANSLATIONS,
  PT_TRANSLATIONS,
} from '../../services/language.service';
import { PlanUpgradeCtaComponent } from './plan-upgrade-cta';

describe('PlanUpgradeCtaComponent', () => {
  let fixture: ComponentFixture<PlanUpgradeCtaComponent>;
  let analytics: jasmine.SpyObj<AnalyticsService>;
  const currentLang = signal<'en' | 'pt' | 'pl' | 'fr'>('en');
  const translations = { en: EN_TRANSLATIONS, pt: PT_TRANSLATIONS, pl: PL_TRANSLATIONS, fr: FR_TRANSLATIONS };

  beforeEach(async () => {
    analytics = jasmine.createSpyObj<AnalyticsService>('AnalyticsService', ['trackEvent']);
    await TestBed.configureTestingModule({
      imports: [PlanUpgradeCtaComponent],
      providers: [
        provideRouter([]),
        { provide: AnalyticsService, useValue: analytics },
        {
          provide: LanguageService,
          useValue: { currentLang, tr: () => translations[currentLang()] },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlanUpgradeCtaComponent);
    fixture.componentRef.setInput('source', 'master');
    fixture.componentRef.setInput('intent', 'quota');
    fixture.detectChanges();
  });

  it('builds the canonical pricing route and emits only the approved analytics context', () => {
    const link = fixture.nativeElement.querySelector('[data-testid="plan-upgrade-link"]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/pricing?from=master&intent=quota');

    link.click();

    expect(analytics.trackEvent).toHaveBeenCalledOnceWith('pricing_upgrade_cta_clicked', {
      source_module: 'master',
      intent: 'quota',
    });
  });

  for (const language of ['en', 'pt', 'pl', 'fr'] as const) {
    it(`renders complete shared copy in ${language}`, () => {
      currentLang.set(language);
      fixture.detectChanges();
      const text = String(fixture.nativeElement.textContent).trim();
      expect(text).toContain(translations[language].PLAN_UPGRADE_QUOTA_TITLE);
      expect(text).toContain(translations[language].PLAN_UPGRADE_BODY);
      expect(text).toContain(translations[language].PLAN_UPGRADE_CTA);
    });
  }
});
