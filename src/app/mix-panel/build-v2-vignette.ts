export const BUILD_V2_VIGNETTE_DELAY_SECONDS =
  2;

export const BUILD_V2_VIGNETTE_DUCK_START_SECONDS =
  1.5;

export const BUILD_V2_VIGNETTE_DUCK_GAIN =
  0.35;

export const BUILD_V2_VIGNETTE_RECOVERY_SECONDS =
  1.5;

export const BUILD_V2_VIGNETTE_MAX_SECONDS =
  60;

const EPSILON = 0.000001;

export interface BuildV2EngineVignette {
  id: string;
  buffer: AudioBuffer;
}

export interface BuildV2PlannedVignette {
  id: string;
  buffer: AudioBuffer;
  startSeconds: number;
  durationSeconds: number;
  duckStartSeconds: number;
  duckEndSeconds: number;
  recoverEndSeconds: number;
}

export function planBuildV2Vignette(
  vignette: BuildV2EngineVignette,
): BuildV2PlannedVignette {
  const duration =
    Number(vignette.buffer.duration);

  if (
    !Number.isFinite(duration)
    || duration <= 0
    || duration
      > BUILD_V2_VIGNETTE_MAX_SECONDS
  ) {
    throw new Error(
      'BUILD_V2_INVALID_VIGNETTE',
    );
  }

  const duckEnd =
    BUILD_V2_VIGNETTE_DELAY_SECONDS
    + duration;

  return {
    id: vignette.id,
    buffer: vignette.buffer,
    startSeconds:
      BUILD_V2_VIGNETTE_DELAY_SECONDS,
    durationSeconds: duration,
    duckStartSeconds:
      BUILD_V2_VIGNETTE_DUCK_START_SECONDS,
    duckEndSeconds: duckEnd,
    recoverEndSeconds:
      duckEnd
      + BUILD_V2_VIGNETTE_RECOVERY_SECONDS,
  };
}

export function buildV2VignetteDuckValueAt(
  timelineSeconds: number,
  vignetteDurationSeconds: number,
): number {
  const time = Math.max(
    0,
    finiteOr(
      timelineSeconds,
      0,
    ),
  );

  const duration = Math.max(
    0,
    finiteOr(
      vignetteDurationSeconds,
      0,
    ),
  );

  const attackStart =
    BUILD_V2_VIGNETTE_DUCK_START_SECONDS;

  const vignetteStart =
    BUILD_V2_VIGNETTE_DELAY_SECONDS;

  const duckEnd =
    vignetteStart + duration;

  const recoverEnd =
    duckEnd
    + BUILD_V2_VIGNETTE_RECOVERY_SECONDS;

  if (time < attackStart) {
    return 1;
  }

  if (time < vignetteStart) {
    const ratio =
      (
        time - attackStart
      )
      / (
        vignetteStart
        - attackStart
      );

    return (
      1
      - ratio
        * (
          1
          - BUILD_V2_VIGNETTE_DUCK_GAIN
        )
    );
  }

  if (time < duckEnd) {
    return BUILD_V2_VIGNETTE_DUCK_GAIN;
  }

  if (time < recoverEnd) {
    const ratio =
      (
        time - duckEnd
      )
      / BUILD_V2_VIGNETTE_RECOVERY_SECONDS;

    return (
      BUILD_V2_VIGNETTE_DUCK_GAIN
      + ratio
        * (
          1
          - BUILD_V2_VIGNETTE_DUCK_GAIN
        )
    );
  }

  return 1;
}

export function scheduleBuildV2VignetteDuck(
  param: AudioParam,
  positionSeconds: number,
  audioNow: number,
  vignetteDurationSeconds: number,
): void {
  const position = Math.max(
    0,
    finiteOr(
      positionSeconds,
      0,
    ),
  );

  const duration = Math.max(
    0,
    finiteOr(
      vignetteDurationSeconds,
      0,
    ),
  );

  const attackStart =
    BUILD_V2_VIGNETTE_DUCK_START_SECONDS;

  const vignetteStart =
    BUILD_V2_VIGNETTE_DELAY_SECONDS;

  const duckEnd =
    vignetteStart + duration;

  const recoverEnd =
    duckEnd
    + BUILD_V2_VIGNETTE_RECOVERY_SECONDS;

  const audioTimeFor = (
    timelineTime: number,
  ) =>
    audioNow
    + Math.max(
      0,
      timelineTime - position,
    );

  param.cancelScheduledValues(
    audioNow,
  );

  param.setValueAtTime(
    buildV2VignetteDuckValueAt(
      position,
      duration,
    ),
    audioNow,
  );

  if (
    position
    < attackStart - EPSILON
  ) {
    param.setValueAtTime(
      1,
      audioTimeFor(
        attackStart,
      ),
    );
  }

  if (
    position
    < vignetteStart - EPSILON
  ) {
    param.linearRampToValueAtTime(
      BUILD_V2_VIGNETTE_DUCK_GAIN,
      audioTimeFor(
        vignetteStart,
      ),
    );
  }

  if (
    position
    < duckEnd - EPSILON
  ) {
    param.setValueAtTime(
      BUILD_V2_VIGNETTE_DUCK_GAIN,
      audioTimeFor(
        duckEnd,
      ),
    );
  }

  if (
    position
    < recoverEnd - EPSILON
  ) {
    param.linearRampToValueAtTime(
      1,
      audioTimeFor(
        recoverEnd,
      ),
    );
  }
}

function finiteOr(
  value: number,
  fallback: number,
): number {
  return Number.isFinite(Number(value))
    ? Number(value)
    : fallback;
}
