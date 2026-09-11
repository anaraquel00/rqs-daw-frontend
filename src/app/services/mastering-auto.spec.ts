import {
  confirmedMasteringAutoPatch,
  isMasteringAutoRecommendationStale,
} from './mastering-auto';
import {
  MasteringAutoRecommendation,
  MasteringAutoRecommendationRequest,
} from './mastering-types';

describe('Mastering delivery AUTO stale and confirmation contract', () => {
  const current: MasteringAutoRecommendationRequest = {
    source_generation: 'source-7',
    analyzer_generation: 'source-7',
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
    expected_policy_version: 'mastering-v2-v1:delivery-auto-v1',
  };

  function recommendation(): MasteringAutoRecommendation {
    return {
      recommendation_id: 'auto_snapshot',
      policy_version: current.expected_policy_version,
      status: 'RECOMMENDATION_AVAILABLE',
      current_snapshot: {
        source_generation: current.source_generation,
        analyzer_generation: current.analyzer_generation,
        metrics: { ...current.metrics! },
        context: { ...current.context },
      },
      proposed_patch: { requestedLufs: -14 },
      reason_codes: ['CUSTOM_LUFS_DIFFERS_FROM_POLICY'],
      explanations: [],
      confidence: 'OBJECTIVE_POLICY',
      requires_confirmation: true,
      separate_delivery_intent_confirmation_required: false,
      stale_key: 'snapshot-digest',
      snapshot_digest: 'snapshot-digest',
      delivery_policy_source: 'test-policy',
      delivery_policy_id: 'streaming:spotify:standard',
      analyzer_generation: current.analyzer_generation,
      analyzer_version: 'analyzer-simple-v1',
      created_at: '2026-09-11T00:00:00.000Z',
    };
  }

  it('accepts an unchanged current snapshot', () => {
    expect(isMasteringAutoRecommendationStale(recommendation(), current)).toBeFalse();
  });

  it('invalidates source, Analyzer, metrics and policy changes', () => {
    expect(isMasteringAutoRecommendationStale(recommendation(), { ...current, source_generation: 'source-8' })).toBeTrue();
    expect(isMasteringAutoRecommendationStale(recommendation(), { ...current, analyzer_generation: 'source-6' })).toBeTrue();
    expect(isMasteringAutoRecommendationStale(recommendation(), {
      ...current,
      metrics: { ...current.metrics!, integrated_lufs: -13 },
    })).toBeTrue();
    expect(isMasteringAutoRecommendationStale(recommendation(), {
      ...current,
      expected_policy_version: 'next-policy',
    })).toBeTrue();
  });

  it('invalidates delivery and relevant Manual setting changes', () => {
    for (const context of [
      { ...current.context, platform: 'youtube' as const },
      { ...current.context, soundcloudMode: 'loud' as const },
      { ...current.context, atmosphere: 'aurora' as const },
      { ...current.context, intensityPercent: 70 },
      { ...current.context, requestedLufs: -14 },
    ]) {
      expect(isMasteringAutoRecommendationStale(recommendation(), { ...current, context })).toBeTrue();
    }
  });

  it('never exposes the proposed patch without explicit confirmation', () => {
    expect(confirmedMasteringAutoPatch(recommendation(), current, { confirmed: false })).toBeNull();
    expect(confirmedMasteringAutoPatch(recommendation(), current, { confirmed: true })).toEqual({ requestedLufs: -14 });
  });

  it('rejects confirmation for stale, abstained, or malformed recommendations', () => {
    expect(confirmedMasteringAutoPatch(recommendation(), { ...current, source_generation: 'source-8' }, { confirmed: true })).toBeNull();
    expect(confirmedMasteringAutoPatch({ ...recommendation(), status: 'ABSTAIN' }, current, { confirmed: true })).toBeNull();
    expect(confirmedMasteringAutoPatch({ ...recommendation(), proposed_patch: {} }, current, { confirmed: true })).toBeNull();
  });
});
