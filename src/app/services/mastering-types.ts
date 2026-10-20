export type MasteringDestination = 'streaming' | 'club' | 'festival';
export type MasteringPlatform = 'spotify' | 'apple_music' | 'youtube' | 'soundcloud' | 'generic';
export type MasteringAtmosphere = 'clear_sky' | 'thunder' | 'sunroof' | 'aurora';
export type SoundCloudMode = 'standard' | 'loud';
export type MasterProfileSource = 'AUDIO_DNA' | 'MANUAL';
export type AudioDnaStatus = 'available' | 'unavailable';
export type AudioDnaConfidenceLevel = 'high' | 'medium' | 'low';
export type AudioDnaTempoRelation = 'half_time' | 'double_time' | 'competing_periodicity';

export interface AudioDnaReason {
  code: string;
  weight: number;
}

export interface AudioDnaMasterProfile {
  atmosphere: MasteringAtmosphere;
  character_intensity: number;
  confidence: number;
  confidence_level: AudioDnaConfidenceLevel;
  auto_configure: boolean;
  input_domain: 'technical_audio_dna_only';
  reasons: AudioDnaReason[];
  atmosphere_dsp_behavior: 'profile_label_only_v2_compatibility_path';
}

export interface AudioDnaTechnical {
  lufs_integrated: number;
  true_peak_dbtp: number;
  lra_lu: number;
  rms_dbfs: number;
  crest_factor_db: number;
  duration_seconds: number;
  brightness?: number;
  warmth?: number;
  spectral_balance?: number;
  transient_strength?: number;
  stereo_width?: number;
  low_end_density?: number;
  harshness?: number;
  dynamic_density?: number;
  overall_energy?: number;
  analysis_seconds?: number;
}

export interface AudioDnaMusic {
  status: 'experimental';
  method: string;
  bpm: {
    value: number | null;
    confidence: number;
    alternatives: Array<{
      value: number;
      confidence: number;
      relation: AudioDnaTempoRelation;
    }>;
    ambiguous: boolean;
    method: string;
  };
  key: { value: string | null; confidence: number; status: 'experimental' };
  genres: Array<{ label: string; confidence: number }>;
  genre_status: 'inconclusive';
  moods: Array<{ label: string; confidence: number }>;
  mood_status: 'inconclusive';
  instruments: Array<{ label: string; confidence: number }>;
  instrument_status: 'inconclusive';
  vocal: {
    status: 'inconclusive';
    presence: null;
    processed: null;
    method: string;
  };
  energy: number;
  energy_status: 'technical_composite';
  danceability: number;
  danceability_status: 'experimental';
}

export interface AudioDnaReleaseAssistant {
  status: 'experimental';
  auto_populate: false;
  review_required: true;
  primary_genre: string | null;
  secondary_genres: string[];
  moods: string[];
  instruments: string[];
  bpm: number | null;
  bpm_ambiguous: boolean;
  key: string | null;
  vocal_or_instrumental: string;
  energy: number;
  danceability: number;
  disclaimer: 'experimental_review_manually_not_for_automatic_publication';
}

export interface AudioDnaPayload {
  version: 'rqs-audio-dna-v1.1';
  status: AudioDnaStatus;
  source_sha256: string;
  analysis_method?: string;
  analysis_segments?: number;
  error_code?: string;
  technical: AudioDnaTechnical;
  music: AudioDnaMusic | null;
  master_profile: AudioDnaMasterProfile | null;
  release_assistant: AudioDnaReleaseAssistant | null;
}

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

export interface MasteringAnalysisResponse extends MasteringV2Analysis {
  audio_dna?: AudioDnaPayload;
  cache?: { hit: boolean };
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
