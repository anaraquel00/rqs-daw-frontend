import {
  buildV2GlobalSecondsToSource,
  buildV2SourceSecondsToGlobal,
  buildV2TimelineDurationSeconds,
  buildV2TrackTimelineStartSeconds,
} from './build-v2-track-playhead';

describe(
  'BUILD V2 track playhead mapping',
  () => {
    it(
      'calculates track starts with transition overlaps',
      () => {
        const durations = [
          10,
          8,
          12,
        ];

        const transitions = [
          2,
          3,
        ];

        expect(
          buildV2TrackTimelineStartSeconds(
            durations,
            transitions,
            0,
          ),
        ).toBe(0);

        expect(
          buildV2TrackTimelineStartSeconds(
            durations,
            transitions,
            1,
          ),
        ).toBe(8);

        expect(
          buildV2TrackTimelineStartSeconds(
            durations,
            transitions,
            2,
          ),
        ).toBe(13);
      },
    );

    it(
      'calculates one unified effective timeline duration',
      () => {
        expect(
          buildV2TimelineDurationSeconds(
            [
              10,
              8,
              12,
            ],
            [
              2,
              3,
            ],
          ),
        ).toBe(25);
      },
    );

    it(
      'maps source-local seconds to the setlist timeline',
      () => {
        expect(
          buildV2SourceSecondsToGlobal(
            20,
            15,
            5,
            25,
          ),
        ).toBe(30);
      },
    );

    it(
      'clamps seek before the effective source range',
      () => {
        expect(
          buildV2SourceSecondsToGlobal(
            20,
            1,
            5,
            25,
          ),
        ).toBe(20);
      },
    );

    it(
      'clamps seek after the effective source range',
      () => {
        expect(
          buildV2SourceSecondsToGlobal(
            20,
            40,
            5,
            25,
          ),
        ).toBe(40);
      },
    );

    it(
      'maps a global transport position into source time',
      () => {
        expect(
          buildV2GlobalSecondsToSource(
            30,
            20,
            5,
            25,
          ),
        ).toBe(15);
      },
    );

    it(
      'returns null when a track is not active',
      () => {
        expect(
          buildV2GlobalSecondsToSource(
            50,
            20,
            5,
            25,
          ),
        ).toBeNull();
      },
    );

    it(
      'allows two local playheads during an overlap',
      () => {
        const global = 9;

        const trackA =
          buildV2GlobalSecondsToSource(
            global,
            0,
            0,
            10,
          );

        const trackB =
          buildV2GlobalSecondsToSource(
            global,
            8,
            0,
            10,
          );

        expect(trackA).toBe(9);
        expect(trackB).toBe(1);
      },
    );
  },
);
