import type { SetlistCurve } from '../services/dsp';
import {
  BuildV2TrackState,
  buildV2EffectiveRange,
  dbToLinearGain,
  normalizeBuildV2TrackState,
} from './build-v2-track-state';
import {
  BuildV2EngineVignette,
  BuildV2PlannedVignette,
  planBuildV2Vignette,
  scheduleBuildV2VignetteDuck,
} from './build-v2-vignette';

export interface BuildV2EngineTrack {
  id: string;
  buffer: AudioBuffer;
  state: BuildV2TrackState;
}

export interface BuildV2EngineTransition {
  duration: number;
  curve: SetlistCurve;
}

export interface BuildV2EngineFinalFade {
  duration: number;
  curve: SetlistCurve;
}

export interface BuildV2PlannedTrack {
  id: string;
  buffer: AudioBuffer;
  sourceOffsetSeconds: number;
  durationSeconds: number;
  timelineStartSeconds: number;
  gainLinear: number;
  pan: number;
  incomingTransition: BuildV2EngineTransition | null;
  outgoingTransition: BuildV2EngineTransition | null;
  finalFade: BuildV2EngineFinalFade | null;
}

export interface BuildV2EnginePlan {
  tracks: BuildV2PlannedTrack[];
  outputDurationSeconds: number;
  sampleRate: number;
  vignette:
    BuildV2PlannedVignette | null;
}

const EPSILON = 0.000001;

export function planBuildV2Mix(
  tracks: BuildV2EngineTrack[],
  transitions: BuildV2EngineTransition[],
  sampleRate = 48_000,
  finalFade:
    BuildV2EngineFinalFade | null = null,
  vignette:
    BuildV2EngineVignette | null = null,
): BuildV2EnginePlan {
  if (tracks.length === 0) {
    return {
      tracks: [],
      outputDurationSeconds: 0,
      sampleRate,
      vignette: null,
    };
  }

  if (transitions.length !== tracks.length - 1) {
    throw new Error(
      'BUILD_V2_TRANSITION_COUNT_MISMATCH',
    );
  }

  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error('BUILD_V2_INVALID_SAMPLE_RATE');
  }

  const ranges = tracks.map((track) =>
    buildV2EffectiveRange(
      track.state,
      track.buffer.duration,
    ),
  );

  transitions.forEach((transition, index) => {
    const left = ranges[index];
    const right = ranges[index + 1];

    if (
      !Number.isFinite(transition.duration)
      || transition.duration < 0.5
      || transition.duration > 15
      || transition.duration >= left.duration
      || transition.duration >= right.duration
    ) {
      throw new Error(
        `BUILD_V2_INVALID_TRANSITION_${index}`,
      );
    }
  });

  if (finalFade) {
    const lastRange =
      ranges.at(-1);

    const incoming =
      transitions.at(-1)?.duration
      ?? 0;

    const validCurve =
      [
        'equal-power',
        'linear',
        'fast-cut',
      ].includes(finalFade.curve);

    if (
      !lastRange
      || !Number.isFinite(
        finalFade.duration,
      )
      || finalFade.duration < 0.5
      || finalFade.duration > 30
      || !validCurve
      || finalFade.duration
        > lastRange.duration + EPSILON
      || incoming
        + finalFade.duration
        > lastRange.duration + EPSILON
    ) {
      throw new Error(
        'BUILD_V2_INVALID_FINAL_FADE',
      );
    }
  }

  const planned: BuildV2PlannedTrack[] = [];
  let timelineStart = 0;

  tracks.forEach((track, index) => {
    const state = normalizeBuildV2TrackState(
      track.state,
      track.buffer.duration,
    );

    const range = buildV2EffectiveRange(
      state,
      track.buffer.duration,
    );

    const incoming =
      index > 0
        ? transitions[index - 1]
        : null;

    const outgoing =
      index < transitions.length
        ? transitions[index]
        : null;

    if (incoming && outgoing) {
      if (
        incoming.duration
        + outgoing.duration
        > range.duration + EPSILON
      ) {
        throw new Error(
          `BUILD_V2_OVERLAPPING_FADES_UNSUPPORTED_${index}`,
        );
      }
    }

    if (index > 0 && incoming) {
      timelineStart -= incoming.duration;
    }

    planned.push({
      id: track.id,
      buffer: track.buffer,
      sourceOffsetSeconds: range.start,
      durationSeconds: range.duration,
      timelineStartSeconds: timelineStart,
      gainLinear: dbToLinearGain(state.gainDb),
      pan: state.pan,
      incomingTransition: incoming,
      outgoingTransition: outgoing,
      finalFade:
        index === tracks.length - 1
          ? finalFade
          : null,
    });

    timelineStart += range.duration;
  });

  const last = planned.at(-1);

  const outputDurationSeconds =
    last
      ? (
        last.timelineStartSeconds
        + last.durationSeconds
      )
      : 0;

  const plannedVignette =
    vignette
      ? planBuildV2Vignette(
          vignette,
        )
      : null;

  return {
    tracks: planned,
    outputDurationSeconds,
    sampleRate,
    vignette:
      plannedVignette,
  };
}

export async function renderBuildV2Offline(
  tracks: BuildV2EngineTrack[],
  transitions: BuildV2EngineTransition[],
  sampleRate = 48_000,
  finalFade:
    BuildV2EngineFinalFade | null = null,
  vignette:
    BuildV2EngineVignette | null = null,
): Promise<AudioBuffer> {
  const plan = planBuildV2Mix(
    tracks,
    transitions,
    sampleRate,
    finalFade,
    vignette,
  );

  if (plan.tracks.length === 0) {
    throw new Error('BUILD_V2_EMPTY_SETLIST');
  }

  const frameCount = Math.max(
    1,
    Math.ceil(
      plan.outputDurationSeconds * sampleRate,
    ),
  );

  const context = new OfflineAudioContext(
    2,
    frameCount,
    sampleRate,
  );

  let musicDestination:
    AudioNode = context.destination;

  if (plan.vignette) {
    const musicBus =
      context.createGain();

    musicBus.connect(
      context.destination,
    );

    scheduleBuildV2VignetteDuck(
      musicBus.gain,
      0,
      0,
      plan.vignette.durationSeconds,
    );

    musicDestination =
      musicBus;
  }

  for (const track of plan.tracks) {
    scheduleTrack(
      context,
      track,
      musicDestination,
    );
  }

  if (plan.vignette) {
    scheduleOfflineVignette(
      context,
      plan.vignette,
      plan.outputDurationSeconds,
    );
  }

  return context.startRendering();
}

function scheduleTrack(
  context: OfflineAudioContext,
  track: BuildV2PlannedTrack,
  destination: AudioNode,
): void {
  const source = context.createBufferSource();
  source.buffer = track.buffer;

  const gain = context.createGain();
  const pan = context.createStereoPanner();

  source
    .connect(gain)
    .connect(pan)
    .connect(destination);

  pan.pan.setValueAtTime(
    track.pan,
    track.timelineStartSeconds,
  );

  scheduleTrackGain(
    gain.gain,
    track,
  );

  source.start(
    track.timelineStartSeconds,
    track.sourceOffsetSeconds,
    track.durationSeconds,
  );
}

function scheduleOfflineVignette(
  context: OfflineAudioContext,
  vignette: BuildV2PlannedVignette,
  outputDurationSeconds: number,
): void {
  const available =
    outputDurationSeconds
    - vignette.startSeconds;

  const duration = Math.min(
    vignette.durationSeconds,
    Math.max(
      0,
      available,
    ),
  );

  if (duration <= EPSILON) {
    return;
  }

  const source =
    context.createBufferSource();

  source.buffer =
    vignette.buffer;

  source.connect(
    context.destination,
  );

  source.start(
    vignette.startSeconds,
    0,
    duration,
  );
}

function scheduleTrackGain(
  gain: AudioParam,
  track: BuildV2PlannedTrack,
): void {
  const start = track.timelineStartSeconds;
  const end = start + track.durationSeconds;
  const base = track.gainLinear;

  gain.cancelScheduledValues(start);

  if (track.incomingTransition) {
    scheduleFadeIn(
      gain,
      start,
      track.incomingTransition.duration,
      track.incomingTransition.curve,
      base,
    );
  } else {
    gain.setValueAtTime(base, start);
  }

  if (track.outgoingTransition) {
    const fadeStart =
      end - track.outgoingTransition.duration;

    gain.setValueAtTime(base, fadeStart);

    scheduleFadeOut(
      gain,
      fadeStart,
      track.outgoingTransition.duration,
      track.outgoingTransition.curve,
      base,
    );

    return;
  }

  if (track.finalFade) {
    const fadeStart =
      end - track.finalFade.duration;

    gain.setValueAtTime(
      base,
      fadeStart,
    );

    scheduleFadeOut(
      gain,
      fadeStart,
      track.finalFade.duration,
      track.finalFade.curve,
      base,
    );

    return;
  }

  gain.setValueAtTime(base, end);
}

function scheduleFadeIn(
  gain: AudioParam,
  start: number,
  duration: number,
  curve: SetlistCurve,
  base: number,
): void {
  if (curve === 'linear') {
    gain.setValueAtTime(0, start);
    gain.linearRampToValueAtTime(
      base,
      start + duration,
    );
    return;
  }

  if (curve === 'equal-power') {
    gain.setValueCurveAtTime(
      equalPowerCurve('in', base),
      start,
      duration,
    );
    return;
  }

  gain.setValueAtTime(
    Math.max(base * 0.001, EPSILON),
    start,
  );

  gain.exponentialRampToValueAtTime(
    Math.max(base, EPSILON),
    start + duration,
  );
}

function scheduleFadeOut(
  gain: AudioParam,
  start: number,
  duration: number,
  curve: SetlistCurve,
  base: number,
): void {
  if (curve === 'linear') {
    gain.setValueAtTime(base, start);
    gain.linearRampToValueAtTime(
      0,
      start + duration,
    );
    return;
  }

  if (curve === 'equal-power') {
    gain.setValueCurveAtTime(
      equalPowerCurve('out', base),
      start,
      duration,
    );
    return;
  }

  gain.setValueAtTime(base, start);

  gain.exponentialRampToValueAtTime(
    Math.max(base * 0.001, EPSILON),
    start + duration * 0.3,
  );

  gain.setValueAtTime(
    Math.max(base * 0.001, EPSILON),
    start + duration,
  );
}

function equalPowerCurve(
  direction: 'in' | 'out',
  base: number,
): Float32Array {
  const points = 128;
  const curve = new Float32Array(points);

  for (let index = 0; index < points; index += 1) {
    const ratio = index / (points - 1);

    curve[index] =
      direction === 'in'
        ? Math.sin(ratio * Math.PI / 2) * base
        : Math.cos(ratio * Math.PI / 2) * base;
  }

  return curve;
}
