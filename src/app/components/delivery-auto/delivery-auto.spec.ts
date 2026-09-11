import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LanguageService, UiLanguage } from '../../services/language.service';
import { MasteringAutoRecommendation } from '../../services/mastering-types';
import { DeliveryAutoComponent, DeliveryAutoUiState } from './delivery-auto';

describe('DeliveryAutoComponent', () => {
  const currentLang = signal<UiLanguage>('en');

  beforeEach(() => {
    currentLang.set('en');
    TestBed.configureTestingModule({
      imports: [DeliveryAutoComponent],
      providers: [{ provide: LanguageService, useValue: { currentLang } }],
    });
  });

  function recommendation(
    status: MasteringAutoRecommendation['status'] = 'RECOMMENDATION_AVAILABLE',
    withPatch = true,
  ): MasteringAutoRecommendation {
    return {
      recommendation_id: 'auto-component-test',
      policy_version: 'mastering-v2-v1:delivery-auto-v1',
      status,
      current_snapshot: {
        source_generation: 'source-1',
        analyzer_generation: 'source-1',
        metrics: {
          integrated_lufs: -14,
          true_peak_dbtp: -1.3,
          rms_dbfs: -18,
          crest_factor_db: 8,
          loudness_range_lu: 5,
          duration_seconds: 180,
        },
        context: {
          destination: 'streaming',
          platform: 'spotify',
          soundcloudMode: 'standard',
          atmosphere: 'clear_sky',
          intensityPercent: 50,
          requestedLufs: -12,
        },
      },
      proposed_patch: withPatch ? { requestedLufs: -14 } : {},
      reason_codes: withPatch
        ? ['CUSTOM_LUFS_DIFFERS_FROM_POLICY']
        : ['DELIVERY_LUFS_WITHIN_RANGE', 'TRUE_PEAK_WITHIN_CEILING'],
      explanations: [],
      confidence: status === 'ABSTAIN' ? 'INSUFFICIENT_EVIDENCE' : 'OBJECTIVE_POLICY',
      requires_confirmation: withPatch,
      separate_delivery_intent_confirmation_required: false,
      stale_key: 'snapshot-digest',
      snapshot_digest: 'snapshot-digest',
      delivery_policy_source: 'test-policy',
      delivery_policy_id: 'streaming:spotify:standard',
      analyzer_generation: 'source-1',
      analyzer_version: 'analyzer-simple-v1',
      created_at: '2026-09-11T00:00:00.000Z',
    };
  }

  function render(
    state: DeliveryAutoUiState,
    nextRecommendation: MasteringAutoRecommendation | null = null,
  ) {
    const fixture = TestBed.createComponent(DeliveryAutoComponent);
    Object.assign(fixture.componentInstance, {
      state,
      recommendation: nextRecommendation,
      currentRequestedLufs: -12,
      policyTargetLufs: -14,
      canRequest: true,
      authenticated: true,
    });
    fixture.detectChanges();
    return fixture;
  }

  it('renders EMPTY and LOADING states', () => {
    expect(render('empty').nativeElement.querySelector('[data-testid=auto-empty]')).not.toBeNull();
    expect(render('loading').nativeElement.querySelector('[data-testid=auto-loading]')).not.toBeNull();
  });

  it('renders recommendation review with current, proposed, reason and policy context', () => {
    const element = render('recommendation', recommendation()).nativeElement as HTMLElement;
    expect(element.querySelector('[data-testid=auto-recommendation]')).not.toBeNull();
    expect(element.textContent).toContain('-12.0 LUFS');
    expect(element.textContent).toContain('-14.0 LUFS');
    expect(element.textContent).toContain('The custom Requested LUFS differs');
    expect(element.textContent).toContain('streaming · spotify · standard');
    expect(element.querySelector('[data-testid=auto-apply]')).not.toBeNull();
  });

  it('renders NO_CHANGE and ABSTAIN without a fake Apply action', () => {
    for (const [state, status] of [
      ['no_change', 'NO_CHANGE_RECOMMENDED'],
      ['abstain', 'ABSTAIN'],
    ] as const) {
      const element = render(state, recommendation(status, false)).nativeElement as HTMLElement;
      expect(element.querySelector(`[data-testid=auto-${state}]`)).not.toBeNull();
      expect(element.querySelector('[data-testid=auto-apply]')).toBeNull();
    }
  });

  it('renders STALE and ERROR and blocks stale Apply', () => {
    const stale = render('stale', recommendation()).nativeElement as HTMLElement;
    expect(stale.querySelector('[data-testid=auto-stale]')).not.toBeNull();
    expect(stale.querySelector('[data-testid=auto-apply]')).toBeNull();
    expect(render('error').nativeElement.querySelector('[data-testid=auto-error]')).not.toBeNull();
  });

  it('requires an explicit click before emitting Apply', () => {
    const fixture = render('recommendation', recommendation());
    const apply = jasmine.createSpy('apply');
    fixture.componentInstance.applyRequestedLufs.subscribe(apply);
    expect(apply).not.toHaveBeenCalled();

    (fixture.nativeElement.querySelector('[data-testid=auto-apply]') as HTMLButtonElement).click();

    expect(apply).toHaveBeenCalledTimes(1);
  });

  it('provides user-readable EN, PT-BR, PL and FR copy without raw reason-only output', () => {
    const expected: Array<[UiLanguage, string]> = [
      ['en', 'Delivery recommendation'],
      ['pt', 'Recomendação de delivery'],
      ['pl', 'Rekomendacja dystrybucji'],
      ['fr', 'Recommandation de diffusion'],
    ];
    for (const [language, title] of expected) {
      currentLang.set(language);
      const fixture = render('recommendation', recommendation());
      const text = fixture.nativeElement.textContent as string;
      expect(text).toContain(title);
      expect(text).not.toContain('CUSTOM_LUFS_DIFFERS_FROM_POLICY');
      fixture.destroy();
    }
  });

  it('uses a single-column mobile layout without a fixed minimum width', () => {
    const styles = getComputedStyle(render('recommendation', recommendation()).nativeElement.querySelector('.delivery-auto'));
    expect(styles.minWidth).not.toMatch(/^\d{3,}px$/);
  });
});
