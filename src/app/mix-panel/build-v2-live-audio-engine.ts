import type { SetlistCurve } from '../services/dsp';
import {
  BuildV2EnginePlan,
  BuildV2EngineTrack,
  BuildV2EngineTransition,
  BuildV2PlannedTrack,
  planBuildV2Mix,
} from './build-v2-audio-engine';

interface BuildV2LiveTrackNodes {
  source: AudioBufferSourceNode;
  mixGain: GainNode;
  fadeGain: GainNode;
  pan: StereoPannerNode;
}

const EPSILON = 0.000001;
const CURVE_POINTS = 64;

export class BuildV2LiveAudioEngine {
  private plan: BuildV2EnginePlan | null = null;

  private readonly active =
    new Map<string, BuildV2LiveTrackNodes>();

  constructor(
    private readonly context: AudioContext,
  ) {}

  prepare(
    tracks: BuildV2EngineTrack[],
    transitions: BuildV2EngineTransition[],
    sampleRate = this.context.sampleRate,
  ): BuildV2EnginePlan {
    this.stop();

    this.plan = planBuildV2Mix(
      tracks,
      transitions,
      sampleRate,
    );

    return this.plan;
  }

  durationSeconds(): number {
    return this.plan?.outputDurationSeconds ?? 0;
  }

  start(positionSeconds: number): void {
    const plan = this.plan;

    if (!plan || plan.tracks.length === 0) {
      throw new Error(
        'BUILD_V2_LIVE_ENGINE_NOT_PREPARED',
      );
    }

    this.stop();

    const position = clamp(
      finiteOr(positionSeconds, 0),
      0,
      plan.outputDurationSeconds,
    );

    const now = this.context.currentTime;

    for (const track of plan.tracks) {
      this.scheduleTrack(
        track,
        position,
        now,
      );
    }
  }

  updateGain(
    trackId: string,
    gainLinear: number,
  ): boolean {
    const track =
      this.plan?.tracks.find(
        candidate => candidate.id === trackId,
      );

    if (!track) return false;

    const value = Math.max(
      0,
      finiteOr(
        gainLinear,
        track.gainLinear,
      ),
    );

    track.gainLinear = value;

    const nodes = this.active.get(trackId);

    if (nodes) {
      const now = this.context.currentTime;

      nodes.mixGain.gain.cancelScheduledValues(
        now,
      );

      nodes.mixGain.gain.setValueAtTime(
        value,
        now,
      );
    }

    return true;
  }

  updatePan(
    trackId: string,
    pan: number,
  ): boolean {
    const track =
      this.plan?.tracks.find(
        candidate => candidate.id === trackId,
      );

    if (!track) return false;

    const value = clamp(
      finiteOr(pan, track.pan),
      -1,
      1,
    );

    track.pan = value;

    const nodes = this.active.get(trackId);

    if (nodes) {
      const now = this.context.currentTime;

      nodes.pan.pan.cancelScheduledValues(
        now,
      );

      nodes.pan.pan.setValueAtTime(
        value,
        now,
      );
    }

    return true;
  }

  stop(): void {
    for (const nodes of this.active.values()) {
      nodes.source.onended = null;

      try {
        nodes.source.stop();
      } catch {
        // Source may already have ended.
      }

      nodes.source.disconnect();
      nodes.mixGain.disconnect();
      nodes.fadeGain.disconnect();
      nodes.pan.disconnect();
    }

    this.active.clear();
  }

  clear(): void {
    this.stop();
    this.plan = null;
  }

  private scheduleTrack(
    track: BuildV2PlannedTrack,
    positionSeconds: number,
    audioNow: number,
  ): void {
    const trackStart =
      track.timelineStartSeconds;

    const trackEnd =
      trackStart + track.durationSeconds;

    if (positionSeconds >= trackEnd) {
      return;
    }

    const elapsedInsideTrack = Math.max(
      0,
      positionSeconds - trackStart,
    );

    const remainingDuration =
      track.durationSeconds
      - elapsedInsideTrack;

    if (remainingDuration <= EPSILON) {
      return;
    }

    const startDelay = Math.max(
      0,
      trackStart - positionSeconds,
    );

    const contextStart =
      audioNow + startDelay;

    const source =
      this.context.createBufferSource();

    const mixGain =
      this.context.createGain();

    const fadeGain =
      this.context.createGain();

    const pan =
      this.context.createStereoPanner();

    source.buffer = track.buffer;

    source
      .connect(mixGain)
      .connect(fadeGain)
      .connect(pan)
      .connect(this.context.destination);

    mixGain.gain.setValueAtTime(
      track.gainLinear,
      audioNow,
    );

    pan.pan.setValueAtTime(
      track.pan,
      audioNow,
    );

    this.scheduleFadeEnvelope(
      fadeGain.gain,
      track,
      positionSeconds,
      audioNow,
    );

    const nodes: BuildV2LiveTrackNodes = {
      source,
      mixGain,
      fadeGain,
      pan,
    };

    this.active.set(
      track.id,
      nodes,
    );

    source.onended = () => {
      if (
        this.active.get(track.id)
        !== nodes
      ) {
        return;
      }

      this.active.delete(track.id);

      source.disconnect();
      mixGain.disconnect();
      fadeGain.disconnect();
      pan.disconnect();
    };

    source.start(
      contextStart,
      track.sourceOffsetSeconds
        + elapsedInsideTrack,
      remainingDuration,
    );
  }

  private scheduleFadeEnvelope(
    param: AudioParam,
    track: BuildV2PlannedTrack,
    positionSeconds: number,
    audioNow: number,
  ): void {
    const trackStart =
      track.timelineStartSeconds;

    const trackEnd =
      trackStart + track.durationSeconds;

    const audibleStart = Math.max(
      positionSeconds,
      trackStart,
    );

    const contextStart =
      audioNow
      + Math.max(
        0,
        audibleStart - positionSeconds,
      );

    param.cancelScheduledValues(audioNow);

    param.setValueAtTime(
      this.envelopeAt(
        track,
        audibleStart,
      ),
      contextStart,
    );

    const incoming =
      track.incomingTransition;

    if (incoming) {
      this.scheduleTransitionCurve(
        param,
        'in',
        incoming.curve,
        trackStart,
        incoming.duration,
        positionSeconds,
        audioNow,
      );
    }

    const outgoing =
      track.outgoingTransition;

    if (outgoing) {
      this.scheduleTransitionCurve(
        param,
        'out',
        outgoing.curve,
        trackEnd - outgoing.duration,
        outgoing.duration,
        positionSeconds,
        audioNow,
      );
    }
  }

  private scheduleTransitionCurve(
    param: AudioParam,
    direction: 'in' | 'out',
    curve: SetlistCurve,
    timelineStart: number,
    durationSeconds: number,
    positionSeconds: number,
    audioNow: number,
  ): void {
    const timelineEnd =
      timelineStart + durationSeconds;

    const effectiveStart = Math.max(
      timelineStart,
      positionSeconds,
    );

    if (
      effectiveStart
      >= timelineEnd - EPSILON
    ) {
      return;
    }

    const ratioStart = clamp(
      (
        effectiveStart
        - timelineStart
      ) / durationSeconds,
      0,
      1,
    );

    const remaining =
      timelineEnd - effectiveStart;

    if (remaining <= EPSILON) {
      return;
    }

    const values =
      buildTransitionCurve(
        direction,
        curve,
        ratioStart,
      );

    const contextStart =
      audioNow
      + Math.max(
        0,
        effectiveStart - positionSeconds,
      );

    param.setValueCurveAtTime(
      values,
      contextStart,
      remaining,
    );
  }

  private envelopeAt(
    track: BuildV2PlannedTrack,
    timelineSeconds: number,
  ): number {
    const start =
      track.timelineStartSeconds;

    const end =
      start + track.durationSeconds;

    const incoming =
      track.incomingTransition;

    if (incoming) {
      const incomingEnd =
        start + incoming.duration;

      if (timelineSeconds < incomingEnd) {
        const ratio = clamp(
          (
            timelineSeconds - start
          ) / incoming.duration,
          0,
          1,
        );

        return transitionValue(
          'in',
          incoming.curve,
          ratio,
        );
      }
    }

    const outgoing =
      track.outgoingTransition;

    if (outgoing) {
      const outgoingStart =
        end - outgoing.duration;

      if (
        timelineSeconds
        >= outgoingStart
      ) {
        const ratio = clamp(
          (
            timelineSeconds
            - outgoingStart
          ) / outgoing.duration,
          0,
          1,
        );

        return transitionValue(
          'out',
          outgoing.curve,
          ratio,
        );
      }
    }

    return 1;
  }
}

function buildTransitionCurve(
  direction: 'in' | 'out',
  curve: SetlistCurve,
  ratioStart: number,
): Float32Array {
  const values =
    new Float32Array(CURVE_POINTS);

  for (
    let index = 0;
    index < CURVE_POINTS;
    index += 1
  ) {
    const localRatio =
      index / (CURVE_POINTS - 1);

    const ratio =
      ratioStart
      + (1 - ratioStart) * localRatio;

    values[index] = transitionValue(
      direction,
      curve,
      ratio,
    );
  }

  return values;
}

function transitionValue(
  direction: 'in' | 'out',
  curve: SetlistCurve,
  ratio: number,
): number {
  const safeRatio =
    clamp(ratio, 0, 1);

  if (curve === 'linear') {
    return direction === 'in'
      ? safeRatio
      : 1 - safeRatio;
  }

  if (curve === 'equal-power') {
    return direction === 'in'
      ? Math.sin(
          safeRatio * Math.PI / 2,
        )
      : Math.cos(
          safeRatio * Math.PI / 2,
        );
  }

  if (direction === 'in') {
    return (
      0.001
      * (1000 ** safeRatio)
    );
  }

  if (safeRatio >= 0.3) {
    return 0.001;
  }

  return (
    0.001
    ** (safeRatio / 0.3)
  );
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
