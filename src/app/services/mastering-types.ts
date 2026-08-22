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
