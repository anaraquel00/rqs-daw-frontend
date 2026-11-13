import type {
  SetlistCurve,
} from '../services/dsp';

export const BUILD_V2_TRANSITION_MIN_SECONDS =
  0.5;

export const BUILD_V2_TRANSITION_MAX_SECONDS =
  15;

export const BUILD_V2_TRANSITION_STEP_SECONDS =
  0.5;

export const BUILD_V2_TRANSITION_GUARD_SECONDS =
  0.01;

const VALID_CURVES:
  readonly SetlistCurve[] = [
    'equal-power',
    'linear',
    'fast-cut',
  ];

export function buildV2TransitionMaxDuration(
  leftEffectiveSeconds: number,
  rightEffectiveSeconds: number,
  leftIncomingSeconds = 0,
  rightOutgoingSeconds = 0,
): number {
  const left = Math.max(
    0,
    finiteOr(
      leftEffectiveSeconds,
      0,
    ),
  );

  const right = Math.max(
    0,
    finiteOr(
      rightEffectiveSeconds,
      0,
    ),
  );

  const leftIncoming = Math.max(
    0,
    finiteOr(
      leftIncomingSeconds,
      0,
    ),
  );

  const rightOutgoing = Math.max(
    0,
    finiteOr(
      rightOutgoingSeconds,
      0,
    ),
  );

  const rawMax = Math.min(
    BUILD_V2_TRANSITION_MAX_SECONDS,

    /*
     * planBuildV2Mix requires:
     *
     * transition.duration < left.duration
     * transition.duration < right.duration
     */
    left
      - BUILD_V2_TRANSITION_GUARD_SECONDS,

    right
      - BUILD_V2_TRANSITION_GUARD_SECONDS,

    /*
     * A middle track must also have enough room for
     * incoming + outgoing fades.
     */
    left - leftIncoming,
    right - rightOutgoing,
  );

  return quantizeMax(
    rawMax,
  );
}

export function buildV2SharedTransitionMaxDuration(
  effectiveDurations:
    readonly number[],
  transitionDurations:
    readonly number[],
  affectedTransitions:
    readonly boolean[],
): number {
  let maximum =
    BUILD_V2_TRANSITION_MAX_SECONDS;

  let hasAffected = false;

  for (
    let index = 0;
    index < transitionDurations.length;
    index += 1
  ) {
    if (!affectedTransitions[index]) {
      continue;
    }

    hasAffected = true;

    const left = Math.max(
      0,
      finiteOr(
        effectiveDurations[index],
        0,
      ),
    );

    const right = Math.max(
      0,
      finiteOr(
        effectiveDurations[index + 1],
        0,
      ),
    );

    maximum = Math.min(
      maximum,
      left
        - BUILD_V2_TRANSITION_GUARD_SECONDS,
      right
        - BUILD_V2_TRANSITION_GUARD_SECONDS,
    );
  }

  /*
   * For each track, solve:
   *
   * affectedCount * duration
   * + fixedFadeDuration
   * <= effectiveTrackDuration
   */
  for (
    let trackIndex = 0;
    trackIndex < effectiveDurations.length;
    trackIndex += 1
  ) {
    let affectedCount = 0;
    let fixedDuration = 0;

    const incomingIndex =
      trackIndex - 1;

    const outgoingIndex =
      trackIndex;

    if (incomingIndex >= 0) {
      if (
        affectedTransitions[
          incomingIndex
        ]
      ) {
        affectedCount += 1;
      } else {
        fixedDuration += Math.max(
          0,
          finiteOr(
            transitionDurations[
              incomingIndex
            ],
            0,
          ),
        );
      }
    }

    if (
      outgoingIndex
      < transitionDurations.length
    ) {
      if (
        affectedTransitions[
          outgoingIndex
        ]
      ) {
        affectedCount += 1;
      } else {
        fixedDuration += Math.max(
          0,
          finiteOr(
            transitionDurations[
              outgoingIndex
            ],
            0,
          ),
        );
      }
    }

    if (affectedCount === 0) {
      continue;
    }

    const trackDuration = Math.max(
      0,
      finiteOr(
        effectiveDurations[
          trackIndex
        ],
        0,
      ),
    );

    maximum = Math.min(
      maximum,
      (
        trackDuration
        - fixedDuration
      ) / affectedCount,
    );
  }

  if (!hasAffected) {
    return (
      BUILD_V2_TRANSITION_MAX_SECONDS
    );
  }

  return quantizeMax(
    maximum,
  );
}

export function normalizeBuildV2TransitionDuration(
  value: number,
  fallback: number,
  maximum: number,
): number | null {
  const max = Math.min(
    BUILD_V2_TRANSITION_MAX_SECONDS,
    finiteOr(
      maximum,
      BUILD_V2_TRANSITION_MAX_SECONDS,
    ),
  );

  if (
    max
    < BUILD_V2_TRANSITION_MIN_SECONDS
  ) {
    return null;
  }

  const raw = finiteOr(
    value,
    fallback,
  );

  const stepped =
    Math.round(
      raw
      / BUILD_V2_TRANSITION_STEP_SECONDS,
    )
    * BUILD_V2_TRANSITION_STEP_SECONDS;

  return clamp(
    stepped,
    BUILD_V2_TRANSITION_MIN_SECONDS,
    max,
  );
}

export function normalizeBuildV2TransitionCurve(
  value: SetlistCurve,
  fallback: SetlistCurve,
): SetlistCurve {
  return VALID_CURVES.includes(value)
    ? value
    : fallback;
}

function quantizeMax(
  value: number,
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (
    value
    < BUILD_V2_TRANSITION_MIN_SECONDS
  ) {
    return Math.max(
      0,
      value,
    );
  }

  return Math.max(
    BUILD_V2_TRANSITION_MIN_SECONDS,
    Math.floor(
      (
        value + 0.000001
      )
      / BUILD_V2_TRANSITION_STEP_SECONDS,
    )
    * BUILD_V2_TRANSITION_STEP_SECONDS,
  );
}

function finiteOr(
  value: number | undefined,
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
