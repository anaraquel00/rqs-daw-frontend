import {
  BUILD_V2_GAIN_MAX_DB,
  BUILD_V2_GAIN_MIN_DB,
  buildV2EffectiveRange,
  buildV2MinimumEffectiveDuration,
  createBuildV2TrackState,
  dbToLinearGain,
  hasBuildV2Adjustments,
  normalizeBuildV2TrackState,
  normalizeBuildV2TrimForTransitions,
} from './build-v2-track-state';

describe('BUILD V2 track state', () => {
  it('starts neutral so the current V1 render contract remains valid', () => {
    const state = createBuildV2TrackState();
    expect(state).toEqual({
      trimStartSeconds: 0,
      trimEndSeconds: null,
      gainDb: 0,
      pan: 0,
    });
    expect(buildV2EffectiveRange(state, 240)).toEqual({ start: 0, end: 240, duration: 240 });
    expect(hasBuildV2Adjustments(state, 240)).toBeFalse();
  });

  it('normalizes trim, gain and pan to the supported safe envelope', () => {
    const state = normalizeBuildV2TrackState({
      trimStartSeconds: 12,
      trimEndSeconds: 90,
      gainDb: 99,
      pan: -4,
    }, 120);

    expect(state.trimStartSeconds).toBe(12);
    expect(state.trimEndSeconds).toBe(90);
    expect(state.gainDb).toBe(BUILD_V2_GAIN_MAX_DB);
    expect(state.pan).toBe(-1);
    expect(buildV2EffectiveRange(state, 120)).toEqual({ start: 12, end: 90, duration: 78 });
    expect(hasBuildV2Adjustments(state, 120)).toBeTrue();
  });

  it('collapses an end trim at the source boundary back to the neutral null representation', () => {
    const state = normalizeBuildV2TrackState({
      trimStartSeconds: 0,
      trimEndSeconds: 60,
      gainDb: 0,
      pan: 0,
    }, 60);

    expect(state.trimEndSeconds).toBeNull();
    expect(hasBuildV2Adjustments(state, 60)).toBeFalse();
  });

  it('never permits an inverted or zero-length clip', () => {
    const state = normalizeBuildV2TrackState({
      trimStartSeconds: 99,
      trimEndSeconds: 2,
      gainDb: BUILD_V2_GAIN_MIN_DB - 20,
      pan: 2,
    }, 100);
    const range = buildV2EffectiveRange(state, 100);

    expect(range.duration).toBeGreaterThan(0);
    expect(range.duration).toBeCloseTo(0.1, 8);
    expect(range.start).toBeLessThan(range.end);
    expect(state.gainDb).toBe(BUILD_V2_GAIN_MIN_DB);
    expect(state.pan).toBe(1);
  });

  it(
    'keeps an edge track longer than its crossfade',
    () => {
      expect(
        buildV2MinimumEffectiveDuration(
          8,
          0,
        ),
      ).toBeGreaterThan(8);
    },
  );

  it(
    'keeps a middle track long enough for both fades',
    () => {
      expect(
        buildV2MinimumEffectiveDuration(
          8,
          8,
        ),
      ).toBeCloseTo(16, 8);
    },
  );

  it(
    'clamps Trim In so a transition remains valid',
    () => {
      const state =
        normalizeBuildV2TrimForTransitions(
          {
            trimStartSeconds: 95,
            trimEndSeconds: null,
            gainDb: 0,
            pan: 0,
          },
          100,
          8,
          0,
          'start',
        );

      const range =
        buildV2EffectiveRange(
          state,
          100,
        );

      expect(
        range.duration,
      ).toBeGreaterThan(8);
    },
  );

  it(
    'clamps Trim Out so two adjacent fades still fit',
    () => {
      const state =
        normalizeBuildV2TrimForTransitions(
          {
            trimStartSeconds: 10,
            trimEndSeconds: 20,
            gainDb: 0,
            pan: 0,
          },
          100,
          8,
          8,
          'end',
        );

      const range =
        buildV2EffectiveRange(
          state,
          100,
        );

      expect(
        range.duration,
      ).toBeCloseTo(16, 8);
    },
  );

  it('converts dB to deterministic linear preview gain', () => {
    expect(dbToLinearGain(0)).toBeCloseTo(1, 8);
    expect(dbToLinearGain(-6)).toBeCloseTo(0.501187, 5);
    expect(dbToLinearGain(6)).toBeCloseTo(1.995262, 5);
  });
});
