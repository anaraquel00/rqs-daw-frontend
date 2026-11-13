import {
  BuildV2EngineTrack,
  planBuildV2Mix,
  renderBuildV2Offline,
} from './build-v2-audio-engine';
import {
  createBuildV2TrackState,
} from './build-v2-track-state';
import type {
  BuildV2EngineVignette,
} from './build-v2-vignette';

describe('BUILD V2 audio engine POC', () => {
  function buffer(
    durationSeconds: number,
    value = 1,
    sampleRate = 8_000,
  ): AudioBuffer {
    const audio = new AudioBuffer({
      length: Math.round(
        durationSeconds * sampleRate,
      ),
      numberOfChannels: 2,
      sampleRate,
    });

    for (
      let channel = 0;
      channel < audio.numberOfChannels;
      channel += 1
    ) {
      audio.getChannelData(channel).fill(value);
    }

    return audio;
  }

  function track(
    id: string,
    duration: number,
  ): BuildV2EngineTrack {
    return {
      id,
      buffer: buffer(duration),
      state: createBuildV2TrackState(),
    };
  }

  it('builds one continuous timeline with crossfade overlap', () => {
    const tracks = [
      track('a', 10),
      track('b', 8),
      track('c', 6),
    ];

    const plan = planBuildV2Mix(
      tracks,
      [
        { duration: 2, curve: 'linear' },
        { duration: 1, curve: 'equal-power' },
      ],
      8_000,
    );

    expect(
      plan.tracks.map(
        item => item.timelineStartSeconds,
      ),
    ).toEqual([0, 8, 15]);

    expect(
      plan.outputDurationSeconds,
    ).toBe(21);
  });

  it('uses effective trimmed ranges as engine source ranges', () => {
    const source = track('a', 10);

    source.state = {
      trimStartSeconds: 2,
      trimEndSeconds: 8,
      gainDb: -6,
      pan: 0.25,
    };

    const plan = planBuildV2Mix(
      [source],
      [],
      8_000,
    );

    expect(
      plan.tracks[0].sourceOffsetSeconds,
    ).toBe(2);

    expect(
      plan.tracks[0].durationSeconds,
    ).toBe(6);

    expect(
      plan.tracks[0].gainLinear,
    ).toBeCloseTo(
      10 ** (-6 / 20),
      6,
    );

    expect(plan.tracks[0].pan).toBe(0.25);
    expect(plan.outputDurationSeconds).toBe(6);
  });

  it('rejects a transition longer than an adjacent effective clip', () => {
    const a = track('a', 10);
    const b = track('b', 10);

    b.state.trimStartSeconds = 8;

    expect(() =>
      planBuildV2Mix(
        [a, b],
        [
          {
            duration: 3,
            curve: 'linear',
          },
        ],
        8_000,
      ),
    ).toThrowError(
      'BUILD_V2_INVALID_TRANSITION_0',
    );
  });

  it('rejects overlapping incoming and outgoing fades in the POC', () => {
    const tracks = [
      track('a', 10),
      track('b', 5),
      track('c', 10),
    ];

    expect(() =>
      planBuildV2Mix(
        tracks,
        [
          {
            duration: 3,
            curve: 'linear',
          },
          {
            duration: 3,
            curve: 'linear',
          },
        ],
        8_000,
      ),
    ).toThrowError(
      'BUILD_V2_OVERLAPPING_FADES_UNSUPPORTED_1',
    );
  });

  it(
    'assigns final fade only to the final planned track',
    () => {
      const plan = planBuildV2Mix(
        [
          track('a', 10),
          track('b', 10),
        ],
        [
          {
            duration: 2,
            curve: 'equal-power',
          },
        ],
        8_000,
        {
          duration: 4,
          curve: 'linear',
        },
      );

      expect(
        plan.tracks[0].finalFade,
      ).toBeNull();

      expect(
        plan.tracks[1].finalFade,
      ).toEqual({
        duration: 4,
        curve: 'linear',
      });

      expect(
        plan.outputDurationSeconds,
      ).toBe(18);
    },
  );

  it(
    'rejects a final fade that overlaps the incoming transition',
    () => {
      expect(() =>
        planBuildV2Mix(
          [
            track('a', 10),
            track('b', 10),
          ],
          [
            {
              duration: 6,
              curve: 'linear',
            },
          ],
          8_000,
          {
            duration: 5,
            curve: 'linear',
          },
        ),
      ).toThrowError(
        'BUILD_V2_INVALID_FINAL_FADE',
      );
    },
  );

  it(
    'plans a vignette without extending the music timeline',
    () => {
      const vignette:
        BuildV2EngineVignette = {
          id: 'id-drop',
          buffer: buffer(
            4,
          ),
        };

      const plan = planBuildV2Mix(
        [
          track('a', 10),
        ],
        [],
        8_000,
        null,
        vignette,
      );

      expect(
        plan.outputDurationSeconds,
      ).toBe(10);

      expect(
        plan.vignette?.startSeconds,
      ).toBe(2);

      expect(
        plan.vignette?.durationSeconds,
      ).toBe(4);
    },
  );

  it(
    'applies V1-compatible music ducking in the offline render',
    async () => {
      const silentVignette:
        BuildV2EngineVignette = {
          id: 'id-drop',
          buffer: buffer(
            1,
            0,
          ),
        };

      const rendered =
        await renderBuildV2Offline(
          [
            track('a', 6),
          ],
          [],
          8_000,
          null,
          silentVignette,
        );

      const left =
        rendered.getChannelData(0);

      expect(
        left[8_000],
      ).toBeCloseTo(
        1,
        1,
      );

      expect(
        left[20_000],
      ).toBeCloseTo(
        0.35,
        1,
      );

      expect(
        left[40_000],
      ).toBeCloseTo(
        1,
        1,
      );
    },
  );

  it('renders an offline stereo buffer with the planned duration', async () => {
    const rendered = await renderBuildV2Offline(
      [
        track('a', 1),
        track('b', 1),
      ],
      [
        {
          duration: 0.5,
          curve: 'linear',
        },
      ],
      8_000,
    );

    expect(rendered.numberOfChannels).toBe(2);
    expect(rendered.sampleRate).toBe(8_000);
    expect(rendered.duration).toBeCloseTo(
      1.5,
      3,
    );
  });

  it(
    'applies a final fade to the offline render',
    async () => {
      const rendered =
        await renderBuildV2Offline(
          [
            track('a', 1),
          ],
          [],
          8_000,
          {
            duration: 0.5,
            curve: 'linear',
          },
        );

      const left =
        rendered.getChannelData(0);

      expect(
        left[2_000],
      ).toBeGreaterThan(0.9);

      expect(
        left[6_000],
      ).toBeCloseTo(
        0.5,
        1,
      );

      expect(
        Math.abs(
          left[7_900],
        ),
      ).toBeLessThan(0.1);
    },
  );

  it('applies track gain to the offline render', async () => {
    const source = track('a', 1);

    source.state.gainDb =
      20 * Math.log10(0.5);

    const rendered = await renderBuildV2Offline(
      [source],
      [],
      8_000,
    );

    const left = rendered.getChannelData(0);

    expect(left[4_000]).toBeCloseTo(
      0.5,
      1,
    );
  });
});
