export interface BuildV2TrackState {
  trimStartSeconds: number;
  trimEndSeconds: number | null;
  gainDb: number;
  pan: number;
}

export interface BuildV2EffectiveRange {
  start: number;
  end: number;
  duration: number;
}

export const BUILD_V2_GAIN_MIN_DB = -24;
export const BUILD_V2_GAIN_MAX_DB = 6;
export const BUILD_V2_PAN_MIN = -1;
export const BUILD_V2_PAN_MAX = 1;
export const BUILD_V2_MIN_CLIP_SECONDS = 0.1;

const EPSILON = 0.001;

export function createBuildV2TrackState(): BuildV2TrackState {
  return {
    trimStartSeconds: 0,
    trimEndSeconds: null,
    gainDb: 0,
    pan: 0,
  };
}

export function normalizeBuildV2TrackState(
  state: BuildV2TrackState,
  sourceDurationSeconds: number,
): BuildV2TrackState {
  const duration = finiteOr(sourceDurationSeconds, 0);
  const gainDb = clamp(finiteOr(state.gainDb, 0), BUILD_V2_GAIN_MIN_DB, BUILD_V2_GAIN_MAX_DB);
  const pan = clamp(finiteOr(state.pan, 0), BUILD_V2_PAN_MIN, BUILD_V2_PAN_MAX);

  if (duration <= 0) {
    return {
      trimStartSeconds: 0,
      trimEndSeconds: null,
      gainDb,
      pan,
    };
  }

  const maxStart = Math.max(0, duration - BUILD_V2_MIN_CLIP_SECONDS);
  const trimStartSeconds = clamp(finiteOr(state.trimStartSeconds, 0), 0, maxStart);
  const rawEnd = state.trimEndSeconds === null
    ? duration
    : finiteOr(state.trimEndSeconds, duration);
  const end = clamp(rawEnd, trimStartSeconds + BUILD_V2_MIN_CLIP_SECONDS, duration);
  const trimEndSeconds = end >= duration - EPSILON ? null : end;

  return {
    trimStartSeconds,
    trimEndSeconds,
    gainDb,
    pan,
  };
}

export function buildV2EffectiveRange(
  state: BuildV2TrackState,
  sourceDurationSeconds: number,
): BuildV2EffectiveRange {
  const duration = Math.max(0, finiteOr(sourceDurationSeconds, 0));
  const normalized = normalizeBuildV2TrackState(state, duration);
  const start = normalized.trimStartSeconds;
  const end = normalized.trimEndSeconds ?? duration;
  return {
    start,
    end,
    duration: Math.max(0, end - start),
  };
}

export function dbToLinearGain(db: number): number {
  const normalizedDb = clamp(finiteOr(db, 0), BUILD_V2_GAIN_MIN_DB, BUILD_V2_GAIN_MAX_DB);
  return 10 ** (normalizedDb / 20);
}

export function hasBuildV2Adjustments(
  state: BuildV2TrackState,
  sourceDurationSeconds: number,
): boolean {
  const normalized = normalizeBuildV2TrackState(state, sourceDurationSeconds);
  return normalized.trimStartSeconds > EPSILON
    || normalized.trimEndSeconds !== null
    || Math.abs(normalized.gainDb) > EPSILON
    || Math.abs(normalized.pan) > EPSILON;
}

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
