export type MasteringDestination = 'streaming' | 'club' | 'festival';
export type MasteringPlatform = 'spotify' | 'apple_music' | 'youtube' | 'soundcloud' | 'generic';
export type MasteringAtmosphere = 'clear_sky' | 'thunder' | 'sunroof' | 'aurora';
export type SoundCloudMode = 'standard' | 'loud';
export type MasterProfileSource = 'AUDIO_DNA' | 'MANUAL';
export type AudioDnaStatus = 'available' | 'unavailable';
export type AudioDnaConfidenceLevel = 'high' | 'medium' | 'low';
export type AudioDnaEvidenceStatus = 'experimental' | 'inconclusive' | 'technical_composite';
export type AudioDnaTempoRelation = 'half_time' | 'double_time' | 'competing_periodicity';

export interface AudioDnaLabel {
  label: string;
  confidence: number;
}

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
  spectral_calibration?: {
    brightness: {
      spectral_centroid_hz: number;
      centroid_nyquist_ratio: number;
      spectral_rolloff_85_hz: number;
      rolloff_nyquist_ratio: number;
      high_band_ratio: number;
      high_band_energy: number;
      total_energy: number;
      high_band_db: number;
      centroid_component: number;
      rolloff_component: number;
      high_band_component: number;
      brightness_raw: number;
      normalized: number;
    };
    low_end: {
      sub_band_ratio: number;
      bass_band_ratio: number;
      broadband_ratio: number;
      low_band_energy: number;
      total_energy: number;
      normalized: number;
    };
    warmth_band_ratio: number;
    harsh_band_ratio: number;
    spectral_tilt_db: number;
  };
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
  genres: AudioDnaLabel[];
  genre_status: 'inconclusive';
  moods: AudioDnaLabel[];
  mood_status: 'inconclusive';
  instruments: AudioDnaLabel[];
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

export interface MasteringAnalysisResponse {
  integrated_lufs: number;
  true_peak_dbtp: number;
  rms_dbfs: number;
  crest_factor_db: number;
  loudness_range_lu: number;
  duration_seconds: number;
  audio_dna: AudioDnaPayload;
  cache: { hit: boolean };
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
