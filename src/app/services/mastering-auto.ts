import {
  MasteringAutoRecommendation,
  MasteringAutoRecommendationRequest,
  MasteringV2Analysis,
  MasteringV2Request,
} from './mastering-types';

function sameMetrics(left: MasteringV2Analysis | null, right: MasteringV2Analysis | null): boolean {
  if (left === null || right === null) return left === right;
  return left.integrated_lufs === right.integrated_lufs
    && left.true_peak_dbtp === right.true_peak_dbtp
    && left.rms_dbfs === right.rms_dbfs
    && left.crest_factor_db === right.crest_factor_db
    && left.loudness_range_lu === right.loudness_range_lu
    && left.duration_seconds === right.duration_seconds;
}

function sameContext(left: MasteringV2Request, right: MasteringV2Request): boolean {
  return left.destination === right.destination
    && left.platform === right.platform
    && left.soundcloudMode === right.soundcloudMode
    && left.atmosphere === right.atmosphere
    && left.intensityPercent === right.intensityPercent
    && left.requestedLufs === right.requestedLufs;
}

export function isMasteringAutoRecommendationStale(
  recommendation: MasteringAutoRecommendation,
  current: MasteringAutoRecommendationRequest,
): boolean {
  const snapshot = recommendation.current_snapshot;
  return !recommendation.stale_key
    || recommendation.snapshot_digest !== recommendation.stale_key
    || recommendation.policy_version !== current.expected_policy_version
    || current.source_generation !== current.analyzer_generation
    || snapshot.source_generation !== current.source_generation
    || snapshot.analyzer_generation !== current.analyzer_generation
    || recommendation.analyzer_generation !== current.analyzer_generation
    || !sameMetrics(snapshot.metrics, current.metrics)
    || !sameContext(snapshot.context, current.context);
}

export function confirmedMasteringAutoPatch(
  recommendation: MasteringAutoRecommendation,
  current: MasteringAutoRecommendationRequest,
  confirmation: { confirmed: boolean },
): { requestedLufs: number } | null {
  if (!confirmation.confirmed
    || recommendation.status !== 'RECOMMENDATION_AVAILABLE'
    || !recommendation.requires_confirmation
    || isMasteringAutoRecommendationStale(recommendation, current)
  ) return null;

  const requestedLufs = recommendation.proposed_patch.requestedLufs;
  return typeof requestedLufs === 'number' && Number.isFinite(requestedLufs)
    ? { requestedLufs }
    : null;
}
