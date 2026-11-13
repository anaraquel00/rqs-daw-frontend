import {
  BUILD_V2_VIGNETTE_DUCK_GAIN,
  buildV2VignetteDuckValueAt,
  planBuildV2Vignette,
  scheduleBuildV2VignetteDuck,
} from './build-v2-vignette';

class FakeAudioParam {
  readonly sets: Array<{
    value: number;
    time: number;
  }> = [];

  readonly ramps: Array<{
    value: number;
    time: number;
  }> = [];

  readonly cancels: number[] = [];

  cancelScheduledValues(
    time: number,
  ): void {
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

  linearRampToValueAtTime(
    value: number,
    time: number,
  ): FakeAudioParam {
    this.ramps.push({
      value,
      time,
    });

    return this;
  }
}

describe(
  'BUILD V2 vignette / ID drop',
  () => {
    it(
      'matches the V1 vignette timing contract',
      () => {
        const plan =
          planBuildV2Vignette({
            id: 'id-drop',
            buffer: {
              duration: 4,
            } as AudioBuffer,
          });

        expect(
          plan.startSeconds,
        ).toBe(2);

        expect(
          plan.duckStartSeconds,
        ).toBe(1.5);

        expect(
          plan.duckEndSeconds,
        ).toBe(6);

        expect(
          plan.recoverEndSeconds,
        ).toBe(7.5);
      },
    );

    it(
      'rejects vignette audio longer than sixty seconds',
      () => {
        expect(() =>
          planBuildV2Vignette({
            id: 'too-long',
            buffer: {
              duration: 60.1,
            } as AudioBuffer,
          }),
        ).toThrowError(
          'BUILD_V2_INVALID_VIGNETTE',
        );
      },
    );

    it(
      'matches the V1 100%-35%-100% duck envelope',
      () => {
        expect(
          buildV2VignetteDuckValueAt(
            1,
            4,
          ),
        ).toBe(1);

        expect(
          buildV2VignetteDuckValueAt(
            1.75,
            4,
          ),
        ).toBeCloseTo(
          0.675,
          6,
        );

        expect(
          buildV2VignetteDuckValueAt(
            3,
            4,
          ),
        ).toBe(
          BUILD_V2_VIGNETTE_DUCK_GAIN,
        );

        expect(
          buildV2VignetteDuckValueAt(
            6.75,
            4,
          ),
        ).toBeCloseTo(
          0.675,
          6,
        );

        expect(
          buildV2VignetteDuckValueAt(
            8,
            4,
          ),
        ).toBe(1);
      },
    );

    it(
      'can resume from the middle of the duck attack',
      () => {
        const param =
          new FakeAudioParam();

        scheduleBuildV2VignetteDuck(
          param as unknown as AudioParam,
          1.75,
          10,
          4,
        );

        expect(
          param.sets[0],
        ).toEqual({
          value: 0.675,
          time: 10,
        });

        expect(
          param.ramps[0],
        ).toEqual({
          value: 0.35,
          time: 10.25,
        });
      },
    );

    it(
      'can resume from the recovery envelope',
      () => {
        const param =
          new FakeAudioParam();

        scheduleBuildV2VignetteDuck(
          param as unknown as AudioParam,
          6.75,
          10,
          4,
        );

        expect(
          param.sets[0].value,
        ).toBeCloseTo(
          0.675,
          6,
        );

        expect(
          param.ramps.at(-1),
        ).toEqual({
          value: 1,
          time: 10.75,
        });
      },
    );
  },
);
