import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LanguageService, UiLanguage } from '../../services/language.service';
import { MasteringDeliveryTargetCapabilities, MasteringV2Analysis } from '../../services/mastering-types';
import { AnalyzerSimpleComponent } from './analyzer-simple';

describe('AnalyzerSimpleComponent delivery summary', () => {
  const currentLang = signal<UiLanguage>('en');
  const target: MasteringDeliveryTargetCapabilities = {
    target_lufs: -14,
    min_lufs: -14.5,
    max_lufs: -13.5,
    true_peak_ceiling_dbtp: -1.2,
    min_plr_lu: 9,
    min_lra_retention: .85,
    max_crest_loss_db: 1.5,
    policy_source: 'test-delivery-policy',
  };
  const metrics: MasteringV2Analysis = {
    integrated_lufs: -14,
    true_peak_dbtp: -1.3,
    rms_dbfs: -18.4,
    crest_factor_db: 8.1,
    loudness_range_lu: 5.2,
    duration_seconds: 185,
  };

  beforeEach(() => {
    currentLang.set('en');
    TestBed.configureTestingModule({
      imports: [AnalyzerSimpleComponent],
      providers: [{ provide: LanguageService, useValue: { currentLang } }],
    });
  });

  function render(
    state: AnalyzerSimpleComponent['state'],
    nextMetrics: MasteringV2Analysis | null = null,
    nextTarget: MasteringDeliveryTargetCapabilities | null = target,
  ) {
    const fixture = TestBed.createComponent(AnalyzerSimpleComponent);
    fixture.componentInstance.state = state;
    fixture.componentInstance.metrics = nextMetrics;
    fixture.componentInstance.target = nextTarget;
    fixture.detectChanges();
    return fixture;
  }

  it('renders EMPTY state', () => {
    expect(render('empty').nativeElement.querySelector('[data-testid=analysis-empty]')).not.toBeNull();
  });

  it('renders LOADING state', () => {
    expect(render('loading').nativeElement.querySelector('[data-testid=analysis-loading]')).not.toBeNull();
  });

  it('maps all successful metrics and keeps dynamics informational', () => {
    const element = render('success', metrics).nativeElement as HTMLElement;
    expect(element.textContent).toContain('-14.0 LUFS');
    expect(element.textContent).toContain('-1.3 dBTP');
    expect(element.textContent).toContain('5.2 LU');
    expect(element.textContent).toContain('8.1 dB');
    expect(element.textContent).toContain('-18.4 dBFS');
    expect(element.textContent).toContain('3:05');
    expect(element.querySelector('.dynamics')?.getAttribute('data-policy-status')).toBe('info');
  });

  it('classifies LUFS inside the existing delivery range without artistic judgment', () => {
    const component = render('success', metrics).componentInstance;
    expect(component.lufsStatus()).toBe('within');
    expect(component.statusLabel(component.lufsStatus())).toBe('WITHIN DELIVERY RANGE');
  });

  it('classifies LUFS outside the existing delivery range as needs attention', () => {
    const component = render('success', { ...metrics, integrated_lufs: -10 }).componentInstance;
    expect(component.lufsStatus()).toBe('attention');
    expect(component.statusLabel(component.lufsStatus())).toBe('NEEDS ATTENTION');
  });

  it('classifies True Peak inside the existing ceiling', () => {
    expect(render('success', metrics).componentInstance.truePeakStatus()).toBe('within');
  });

  it('classifies True Peak above the existing ceiling as needs attention', () => {
    expect(render('success', { ...metrics, true_peak_dbtp: -.5 }).componentInstance.truePeakStatus()).toBe('attention');
  });

  it('uses INFO when no objective delivery policy is available', () => {
    const fixture = render('success', metrics, null);
    expect(fixture.componentInstance.overallStatus()).toBe('info');
    expect(fixture.nativeElement.querySelector('[data-testid=overall-status]').textContent).toContain('INFO');
  });

  it('renders analysis and authentication error states safely', () => {
    expect(render('error').nativeElement.querySelector('[data-testid=analysis-error]')).not.toBeNull();
    expect(render('auth_required').nativeElement.querySelector('[data-testid=analysis-auth]')).not.toBeNull();
  });

  it('provides EN, PT-BR, PL and FR localized state language', () => {
    const expected: Array<[UiLanguage, string]> = [
      ['en', 'Delivery readiness'],
      ['pt', 'Prontidão para delivery'],
      ['pl', 'Gotowość do dystrybucji'],
      ['fr', 'Préparation à la diffusion'],
    ];
    for (const [language, title] of expected) {
      currentLang.set(language);
      const fixture = render('success', metrics);
      expect(fixture.nativeElement.textContent).toContain(title);
      fixture.destroy();
    }
  });
});
