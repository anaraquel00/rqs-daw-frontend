import type {
  SetlistCurve,
} from '../services/dsp';

export interface BuildV2FinalFadeState {
  enabled: boolean;
  duration: number;
  curve: SetlistCurve;
}

export const BUILD_V2_FINAL_FADE_MIN_SECONDS =
  0.5;

export const BUILD_V2_FINAL_FADE_MAX_SECONDS =
  30;

export const BUILD_V2_FINAL_FADE_STEP_SECONDS =
  0.5;

export const BUILD_V2_FINAL_FADE_DEFAULT_SECONDS =
  8;

const VALID_CURVES:
  readonly SetlistCurve[] = [
    'equal-power',
    'linear',
    'fast-cut',
  ];

export function createBuildV2FinalFadeState():
  BuildV2FinalFadeState {
  return {
    enabled: false,
    duration:
      BUILD_V2_FINAL_FADE_DEFAULT_SECONDS,
    curve: 'equal-power',
  };
}

export function buildV2FinalFadeMaxDuration(
  lastTrackEffectiveSeconds: number,
  incomingTransitionSeconds: number,
): number {
  const trackDuration = Math.max(
    0,
    finiteOr(
      lastTrackEffectiveSeconds,
      0,
    ),
  );

  const incoming = Math.max(
    0,
    finiteOr(
      incomingTransitionSeconds,
      0,
    ),
  );

  const available = Math.min(
    BUILD_V2_FINAL_FADE_MAX_SECONDS,
    trackDuration - incoming,
  );

  if (
    available
    < BUILD_V2_FINAL_FADE_MIN_SECONDS
  ) {
    return Math.max(
      0,
      available,
    );
  }

  return (
    Math.floor(
      (
        available + 0.000001
      )
      / BUILD_V2_FINAL_FADE_STEP_SECONDS,
    )
    * BUILD_V2_FINAL_FADE_STEP_SECONDS
  );
}

export function normalizeBuildV2FinalFadeState(
  state: BuildV2FinalFadeState,
  maximumDurationSeconds: number,
): BuildV2FinalFadeState {
  const maximum = Math.min(
    BUILD_V2_FINAL_FADE_MAX_SECONDS,
    Math.max(
      0,
      finiteOr(
        maximumDurationSeconds,
        0,
      ),
    ),
  );

  const curve =
    VALID_CURVES.includes(state.curve)
      ? state.curve
      : 'equal-power';

  if (
    maximum
    < BUILD_V2_FINAL_FADE_MIN_SECONDS
  ) {
    return {
      enabled: false,
      duration:
        BUILD_V2_FINAL_FADE_MIN_SECONDS,
      curve,
    };
  }

  const rawDuration =
    finiteOr(
      state.duration,
      BUILD_V2_FINAL_FADE_DEFAULT_SECONDS,
    );

  const stepped =
    Math.round(
      rawDuration
      / BUILD_V2_FINAL_FADE_STEP_SECONDS,
    )
    * BUILD_V2_FINAL_FADE_STEP_SECONDS;

  return {
    enabled: Boolean(state.enabled),
    duration: clamp(
      stepped,
      BUILD_V2_FINAL_FADE_MIN_SECONDS,
      maximum,
    ),
    curve,
  };
}

function finiteOr(
  value: number,
  fallback: number,
): number {
  return Number.isFinite(Number(value))
    ? Number(value)
    : fallback;
}

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(
    max,
    Math.max(min, value),
  );
}
