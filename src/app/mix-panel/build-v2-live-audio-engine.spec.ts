import type {
  BuildV2EngineTrack,
  BuildV2EngineTransition,
} from './build-v2-audio-engine';
import {
  BuildV2LiveAudioEngine,
} from './build-v2-live-audio-engine';

class FakeAudioParam {
  readonly sets: Array<{
    value: number;
    time: number;
  }> = [];

  readonly curves: Array<{
    values: Float32Array;
    start: number;
    duration: number;
  }> = [];

  readonly cancels: number[] = [];

  cancelScheduledValues(time: number): void {
    this.cancels.push(time);
  }

  setValueAtTime(
    value: number,
    time: number,
  ): FakeAudioParam {
    this.sets.push({
      value,
      time,
    });

    return this;
  }

  setValueCurveAtTime(
    values: Float32Array,
    start: number,
    duration: number,
  ): FakeAudioParam {
    this.curves.push({
      values,
      start,
      duration,
    });

    return this;
  }
}

class FakeNode {
  readonly connections: unknown[] = [];
  disconnected = false;

  connect(node: unknown): unknown {
    this.connections.push(node);
    return node;
  }

  disconnect(): void {
    this.disconnected = true;
  }
}

class FakeSource extends FakeNode {
  buffer: AudioBuffer | null = null;
  onended: (() => void) | null = null;

  readonly starts: Array<{
    when: number;
    offset: number;
    duration: number | undefined;
  }> = [];

  stopCount = 0;

  start(
    when = 0,
    offset = 0,
    duration?: number,
  ): void {
    this.starts.push({
      when,
      offset,
      duration,
    });
  }

  stop(): void {
    this.stopCount += 1;
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeAudioParam();
}

class FakePan extends FakeNode {
  readonly pan = new FakeAudioParam();
}

class FakeContext {
  currentTime = 10;
  sampleRate = 48_000;

  readonly destination = new FakeNode();

  readonly sources: FakeSource[] = [];
  readonly gains: FakeGain[] = [];
  readonly pans: FakePan[] = [];

  createBufferSource(): FakeSource {
    const node = new FakeSource();
    this.sources.push(node);
    return node;
  }

  createGain(): FakeGain {
    const node = new FakeGain();
    this.gains.push(node);
    return node;
  }

  createStereoPanner(): FakePan {
    const node = new FakePan();
    this.pans.push(node);
    return node;
  }
}

function makeTrack(
  id: string,
  duration: number,
  gainDb = 0,
  pan = 0,
  trimStartSeconds = 0,
  trimEndSeconds: number | null = null,
): BuildV2EngineTrack {
  return {
    id,
    buffer: {
      duration,
    } as AudioBuffer,
    state: {
      trimStartSeconds,
      trimEndSeconds,
      gainDb,
      pan,
    },
  };
}

function transition(
  duration = 2,
): BuildV2EngineTransition {
  return {
    duration,
    curve: 'equal-power',
  };
}

describe('BUILD V2 live audio engine', () => {
  it('schedules individual sources on the shared timeline', () => {
    const context = new FakeContext();

    const engine =
      new BuildV2LiveAudioEngine(
        context as unknown as AudioContext,
      );

    const plan = engine.prepare(
      [
        makeTrack('a', 10),
        makeTrack('b', 10),
      ],
      [
        transition(2),
      ],
    );

    expect(
      plan.outputDurationSeconds,
    ).toBeCloseTo(18, 8);

    engine.start(0);

    expect(context.sources.length).toBe(2);

    expect(
      context.sources[0].starts[0],
    ).toEqual({
      when: 10,
      offset: 0,
      duration: 10,
    });

    expect(
      context.sources[1].starts[0],
    ).toEqual({
      when: 18,
      offset: 0,
      duration: 10,
    });
  });

  it('resumes inside overlapping tracks from the transport position', () => {
    const context = new FakeContext();

    const engine =
      new BuildV2LiveAudioEngine(
        context as unknown as AudioContext,
      );

    engine.prepare(
      [
        makeTrack('a', 10),
        makeTrack('b', 10),
      ],
      [
        transition(2),
      ],
    );

    engine.start(9);

    expect(context.sources.length).toBe(2);

    expect(
      context.sources[0].starts[0],
    ).toEqual({
      when: 10,
      offset: 9,
      duration: 1,
    });

    expect(
      context.sources[1].starts[0],
    ).toEqual({
      when: 10,
      offset: 1,
      duration: 9,
    });
  });

  it(
    'schedules the effective trimmed source range',
    () => {
      const context = new FakeContext();

      const engine =
        new BuildV2LiveAudioEngine(
          context as unknown as AudioContext,
        );

      const plan = engine.prepare(
        [
          makeTrack(
            'a',
            10,
            0,
            0,
            2,
            8,
          ),
        ],
        [],
      );

      expect(
        plan.outputDurationSeconds,
      ).toBeCloseTo(6, 8);

      engine.start(0);

      expect(
        context.sources[0].starts[0],
      ).toEqual({
        when: 10,
        offset: 2,
        duration: 6,
      });
    },
  );

  it(
    'reschedules from the same global position after Trim changes',
    () => {
      const context = new FakeContext();

      const engine =
        new BuildV2LiveAudioEngine(
          context as unknown as AudioContext,
        );

      engine.prepare(
        [
          makeTrack('a', 10),
        ],
        [],
      );

      engine.start(4);

      const oldSource =
        context.sources[0];

      engine.prepare(
        [
          makeTrack(
            'a',
            10,
            0,
            0,
            2,
            8,
          ),
        ],
        [],
      );

      engine.start(4);

      expect(oldSource.stopCount).toBe(1);

      expect(
        context.sources.at(-1)?.starts[0],
      ).toEqual({
        when: 10,
        offset: 6,
        duration: 2,
      });
    },
  );

  it(
    'moves later tracks when an earlier effective range changes',
    () => {
      const context = new FakeContext();

      const engine =
        new BuildV2LiveAudioEngine(
          context as unknown as AudioContext,
        );

      const original = engine.prepare(
        [
          makeTrack('a', 10),
          makeTrack('b', 10),
        ],
        [
          transition(2),
        ],
      );

      expect(
        original.tracks[1]
          .timelineStartSeconds,
      ).toBe(8);

      const trimmed = engine.prepare(
        [
          makeTrack(
            'a',
            10,
            0,
            0,
            0,
            8,
          ),
          makeTrack('b', 10),
        ],
        [
          transition(2),
        ],
      );

      expect(
        trimmed.tracks[1]
          .timelineStartSeconds,
      ).toBe(6);
    },
  );

  it(
    'keeps current playback alive if a replan is invalid',
    () => {
      const context = new FakeContext();

      const engine =
        new BuildV2LiveAudioEngine(
          context as unknown as AudioContext,
        );

      engine.prepare(
        [
          makeTrack('a', 10),
          makeTrack('b', 10),
        ],
        [
          transition(2),
        ],
      );

      engine.start(0);

      const currentSource =
        context.sources[0];

      expect(() =>
        engine.prepare(
          [
            makeTrack('a', 1),
            makeTrack('b', 10),
          ],
          [
            transition(2),
          ],
        ),
      ).toThrow();

      expect(
        currentSource.stopCount,
      ).toBe(0);
    },
  );

  it('updates gain immediately without rebuilding the source', () => {
    const context = new FakeContext();

    const engine =
      new BuildV2LiveAudioEngine(
        context as unknown as AudioContext,
      );

    engine.prepare(
      [makeTrack('a', 10)],
      [],
    );

    engine.start(0);

    const sourceCount =
      context.sources.length;

    expect(
      engine.updateGain('a', 0.5),
    ).toBeTrue();

    expect(context.sources.length).toBe(
      sourceCount,
    );

    const liveGain =
      context.gains[0].gain;

    expect(
      liveGain.sets.at(-1),
    ).toEqual({
      value: 0.5,
      time: 10,
    });
  });

  it('updates pan immediately without rebuilding the source', () => {
    const context = new FakeContext();

    const engine =
      new BuildV2LiveAudioEngine(
        context as unknown as AudioContext,
      );

    engine.prepare(
      [makeTrack('a', 10)],
      [],
    );

    engine.start(0);

    const sourceCount =
      context.sources.length;

    expect(
      engine.updatePan('a', -0.4),
    ).toBeTrue();

    expect(context.sources.length).toBe(
      sourceCount,
    );

    expect(
      context.pans[0].pan.sets.at(-1),
    ).toEqual({
      value: -0.4,
      time: 10,
    });
  });

  it('keeps transition automation on a separate gain node', () => {
    const context = new FakeContext();

    const engine =
      new BuildV2LiveAudioEngine(
        context as unknown as AudioContext,
      );

    engine.prepare(
      [
        makeTrack('a', 10),
        makeTrack('b', 10),
      ],
      [
        transition(2),
      ],
    );

    engine.start(0);

    const liveGain =
      context.gains[0].gain;

    const fadeGain =
      context.gains[1].gain;

    expect(
      fadeGain.curves.length,
    ).toBeGreaterThan(0);

    const fadeCurveCount =
      fadeGain.curves.length;

    engine.updateGain('a', 0.25);

    expect(
      fadeGain.curves.length,
    ).toBe(fadeCurveCount);

    expect(
      liveGain.sets.at(-1)?.value,
    ).toBe(0.25);
  });

  it('stops all active sources', () => {
    const context = new FakeContext();

    const engine =
      new BuildV2LiveAudioEngine(
        context as unknown as AudioContext,
      );

    engine.prepare(
      [
        makeTrack('a', 10),
        makeTrack('b', 10),
      ],
      [
        transition(2),
      ],
    );

    engine.start(0);
    engine.stop();

    expect(
      context.sources.every(
        source => source.stopCount === 1,
      ),
    ).toBeTrue();
  });
});
