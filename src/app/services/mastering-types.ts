// daw-frontend/src/app/services/mastering-types.ts

export interface AudioMetrics {
  integrated_lufs: number;
  true_peak_dbtp: number;
  sample_peak_dbfs: number;
  loudness_range_lra: number;
  crest_factor_db: number;
  plr: number;
  dc_offset: number;
  stereo_correlation: number;
}

export interface CrossoverSettings {
  lowCutoffHz: number;
  highCutoffHz: number;
}
