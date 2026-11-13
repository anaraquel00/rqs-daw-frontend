import {
  BUILD_V2_FINAL_FADE_MAX_SECONDS,
  createBuildV2FinalFadeState,
  buildV2FinalFadeMaxDuration,
  normalizeBuildV2FinalFadeState,
} from './build-v2-final-fade';

describe(
  'BUILD V2 final fade state',
  () => {
    it(
      'starts disabled with an eight-second equal-power fade',
      () => {
        expect(
          createBuildV2FinalFadeState(),
        ).toEqual({
          enabled: false,
          duration: 8,
          curve: 'equal-power',
        });
      },
    );

    it(
      'reserves room for the incoming transition on the last track',
      () => {
        expect(
          buildV2FinalFadeMaxDuration(
            20,
            8,
          ),
        ).toBe(12);
      },
    );

    it(
      'caps the final fade at its supported maximum',
      () => {
        expect(
          buildV2FinalFadeMaxDuration(
            120,
            8,
          ),
        ).toBe(
          BUILD_V2_FINAL_FADE_MAX_SECONDS,
        );
      },
    );

    it(
      'quantizes and clamps duration to the live-safe range',
      () => {
        expect(
          normalizeBuildV2FinalFadeState(
            {
              enabled: true,
              duration: 12.3,
              curve: 'linear',
            },
            10,
          ),
        ).toEqual({
          enabled: true,
          duration: 10,
          curve: 'linear',
        });
      },
    );

    it(
      'disables the fade when no valid duration remains',
      () => {
        expect(
          normalizeBuildV2FinalFadeState(
            {
              enabled: true,
              duration: 8,
              curve: 'fast-cut',
            },
            0.3,
          ),
        ).toEqual({
          enabled: false,
          duration: 0.5,
          curve: 'fast-cut',
        });
      },
    );
  },
);
