export type MasteringDestination = 'streaming' | 'club' | 'festival';
export type MasteringPlatform = 'spotify' | 'apple_music' | 'youtube' | 'soundcloud' | 'generic';
export type MasteringAtmosphere = 'clear_sky' | 'thunder' | 'sunroof' | 'aurora';
export type SoundCloudMode = 'standard' | 'loud';

export interface MasteringV2Request {
  destination: MasteringDestination;
  platform: MasteringPlatform | null;
  atmosphere: MasteringAtmosphere;
  intensityPercent: number;
  requestedLufs: number | null;
  soundcloudMode: SoundCloudMode;
}

export interface MasteringProcessCommand {
  request: MasteringV2Request;
  preview: boolean;
  previewStartSeconds?: number;
}

export interface MasteringDeliveryTargetCapabilities {
  target_lufs: number;
  min_lufs: number;
  max_lufs: number;
  true_peak_ceiling_dbtp: number;
  min_plr_lu: number;
  min_lra_retention: number;
  max_crest_loss_db: number;
  policy_source: string;
}

export interface MasteringAtmosphereCapability {
  id: MasteringAtmosphere;
  label: string;
  subtitle: string;
}

export interface MasteringV2Capabilities {
  engine: string;
  release: string;
  auto: {
    delivery_recommendation_policy_version: string;
  };
  preview_seconds: number;
  intensity: {
    min: number;
    max: number;
    step: number;
    default: number;
  };
  atmospheres: MasteringAtmosphereCapability[];
  destinations: {
    streaming: {
      platform_required: true;
      platforms: Record<MasteringPlatform, Partial<Record<SoundCloudMode, MasteringDeliveryTargetCapabilities>>>;
    };
    club: {
      platform_required: false;
      target: MasteringDeliveryTargetCapabilities;
    };
    festival: {
      platform_required: false;
      target: MasteringDeliveryTargetCapabilities;
    };
  };
}

export interface MasteringV2FinalResponse {
  success: boolean;
  engine: string;
  downloadUrl: string;
  fileName: string;
}

export interface MasteringV2Analysis {
  integrated_lufs: number;
  true_peak_dbtp: number;
  rms_dbfs: number;
  crest_factor_db: number;
  loudness_range_lu: number;
  duration_seconds: number;
}

export type MasteringAnalysisState = 'empty' | 'loading' | 'success' | 'error' | 'auth_required';

export type MasteringAutoRecommendationStatus =
  | 'RECOMMENDATION_AVAILABLE'
  | 'NO_CHANGE_RECOMMENDED'
  | 'ABSTAIN';

export type MasteringAutoReasonCode =
  | 'DELIVERY_LUFS_WITHIN_RANGE'
  | 'DELIVERY_LUFS_BELOW_RANGE'
  | 'DELIVERY_LUFS_ABOVE_RANGE'
  | 'TRUE_PEAK_WITHIN_CEILING'
  | 'TRUE_PEAK_ABOVE_CEILING'
  | 'CUSTOM_LUFS_DIFFERS_FROM_POLICY'
  | 'DELIVERY_INTENT_REVIEW_SUGGESTED'
  | 'INSUFFICIENT_CREATIVE_EVIDENCE'
  | 'KEEP_CURRENT_ATMOSPHERE'
  | 'KEEP_CURRENT_INTENSITY'
  | 'ANALYZER_DATA_UNAVAILABLE'
  | 'ANALYZER_DATA_STALE'
  | 'POLICY_UNAVAILABLE';

export interface MasteringAutoRecommendationRequest {
  source_generation: string;
  analyzer_generation: string;
  metrics: MasteringV2Analysis | null;
  context: MasteringV2Request;
  expected_policy_version: string;
}

export interface MasteringAutoReasonExplanation {
  code: MasteringAutoReasonCode;
  technical_meaning: string;
  user_explanation: string;
  required_data: string[];
  may_propose_patch: boolean;
}

export interface MasteringAutoRecommendation {
  recommendation_id: string;
  policy_version: string;
  status: MasteringAutoRecommendationStatus;
  current_snapshot: {
    source_generation: string;
    analyzer_generation: string;
    metrics: MasteringV2Analysis | null;
    context: MasteringV2Request;
  };
  proposed_patch: { requestedLufs?: number };
  reason_codes: MasteringAutoReasonCode[];
  explanations: MasteringAutoReasonExplanation[];
  confidence: 'OBJECTIVE_POLICY' | 'INSUFFICIENT_EVIDENCE';
  requires_confirmation: boolean;
  separate_delivery_intent_confirmation_required: boolean;
  stale_key: string;
  snapshot_digest: string;
  delivery_policy_source: string | null;
  delivery_policy_id: string | null;
  analyzer_generation: string;
  analyzer_version: string;
  created_at: string;
}
