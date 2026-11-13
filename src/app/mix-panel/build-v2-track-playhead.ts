const EPSILON = 0.000001;

export function buildV2TrackTimelineStartSeconds(
  effectiveDurations: readonly number[],
  transitionDurations: readonly number[],
  trackIndex: number,
): number {
  const index = Math.max(
    0,
    Math.min(
      Math.trunc(finiteOr(trackIndex, 0)),
      effectiveDurations.length,
    ),
  );

  let start = 0;

  for (
    let currentIndex = 0;
    currentIndex < index;
    currentIndex += 1
  ) {
    const currentDuration = Math.max(
      0,
      finiteOr(
        effectiveDurations[currentIndex],
        0,
      ),
    );

    start += currentDuration;

    const nextDuration = Math.max(
      0,
      finiteOr(
        effectiveDurations[
          currentIndex + 1
        ],
        0,
      ),
    );

    const transitionDuration = Math.max(
      0,
      finiteOr(
        transitionDurations[
          currentIndex
        ],
        0,
      ),
    );

    const overlap = Math.min(
      transitionDuration,
      currentDuration,
      nextDuration,
    );

    start -= overlap;
  }

  return Math.max(0, start);
}

export function buildV2SourceSecondsToGlobal(
  timelineStartSeconds: number,
  sourceSeconds: number,
  sourceStartSeconds: number,
  sourceEndSeconds: number,
): number {
  const start = Math.max(
    0,
    finiteOr(sourceStartSeconds, 0),
  );

  const end = Math.max(
    start,
    finiteOr(sourceEndSeconds, start),
  );

  const source = clamp(
    finiteOr(sourceSeconds, start),
    start,
    end,
  );

  return Math.max(
    0,
    finiteOr(timelineStartSeconds, 0)
      + source
      - start,
  );
}

export function buildV2GlobalSecondsToSource(
  globalSeconds: number,
  timelineStartSeconds: number,
  sourceStartSeconds: number,
  sourceEndSeconds: number,
): number | null {
  const timelineStart = Math.max(
    0,
    finiteOr(timelineStartSeconds, 0),
  );

  const sourceStart = Math.max(
    0,
    finiteOr(sourceStartSeconds, 0),
  );

  const sourceEnd = Math.max(
    sourceStart,
    finiteOr(
      sourceEndSeconds,
      sourceStart,
    ),
  );

  const duration =
    sourceEnd - sourceStart;

  const global =
    finiteOr(globalSeconds, 0);

  const timelineEnd =
    timelineStart + duration;

  if (
    global < timelineStart - EPSILON
    || global > timelineEnd + EPSILON
  ) {
    return null;
  }

  return clamp(
    sourceStart
      + global
      - timelineStart,
    sourceStart,
    sourceEnd,
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
