import {
  BUILD_V2_TRANSITION_MAX_SECONDS,
  buildV2SharedTransitionMaxDuration,
  buildV2TransitionMaxDuration,
  normalizeBuildV2TransitionCurve,
  normalizeBuildV2TransitionDuration,
} from './build-v2-transition-state';

describe(
  'BUILD V2 transition state',
  () => {
    it(
      'limits a crossfade below both adjacent clips',
      () => {
        expect(
          buildV2TransitionMaxDuration(
            10,
            20,
          ),
        ).toBe(9.5);
      },
    );

    it(
      'reserves room for the fade on the other side of a middle track',
      () => {
        expect(
          buildV2TransitionMaxDuration(
            16,
            30,
            8,
            0,
          ),
        ).toBe(8);
      },
    );

    it(
      'limits a shared default to half of a middle track when both fades change together',
      () => {
        expect(
          buildV2SharedTransitionMaxDuration(
            [
              30,
              16,
              30,
            ],
            [
              8,
              8,
            ],
            [
              true,
              true,
            ] as unknown as boolean[],
          ),
        ).toBe(8);
      },
    );

    it(
      'keeps custom neighboring fade duration in the shared budget',
      () => {
        expect(
          buildV2SharedTransitionMaxDuration(
            [
              30,
              16,
              30,
            ],
            [
              8,
              6,
            ],
            [
              true,
              false,
            ],
          ),
        ).toBe(10);
      },
    );

    it(
      'normalizes duration to the supported half-second grid',
      () => {
        expect(
          normalizeBuildV2TransitionDuration(
            12.3,
            8,
            10,
          ),
        ).toBe(10);

        expect(
          normalizeBuildV2TransitionDuration(
            6.26,
            8,
            BUILD_V2_TRANSITION_MAX_SECONDS,
          ),
        ).toBe(6.5);
      },
    );

    it(
      'rejects a transition when no valid half-second range remains',
      () => {
        expect(
          normalizeBuildV2TransitionDuration(
            8,
            8,
            0.4,
          ),
        ).toBeNull();
      },
    );

    it(
      'keeps only supported curve names',
      () => {
        expect(
          normalizeBuildV2TransitionCurve(
            'linear',
            'equal-power',
          ),
        ).toBe('linear');

        expect(
          normalizeBuildV2TransitionCurve(
            'invalid' as never,
            'equal-power',
          ),
        ).toBe('equal-power');
      },
    );
  },
);
