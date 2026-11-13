import type {
  BuildV2ProjectDocumentV1,
} from './build-v2-project-schema';

import {
  buildBuildV2ProjectRestorePlan,
} from './build-v2-project-restore';


describe(
  'BUILD V2 canonical project restore plan',
  () => {
    function wav(
      name: string,
      bytes: number[],
    ): File {
      return new File(
        [
          new Uint8Array(
            bytes,
          ),
        ],
        name,
        {
          type:
            'audio/wav',
        },
      );
    }


    function fixture() {
      const a =
        wav(
          'a.wav',
          [1, 2, 3],
        );

      const b =
        wav(
          'b.wav',
          [4, 5, 6, 7],
        );

      const id =
        wav(
          'id.wav',
          [8, 9],
        );

      const project:
        BuildV2ProjectDocumentV1 = {
        kind:
          'rqs-build-project',

        schemaVersion:
          1,

        projectId:
          'project-001',

        name:
          'RESTORE TEST',

        createdAt:
          '2026-11-13T18:00:00.000Z',

        updatedAt:
          '2026-11-13T19:00:00.000Z',

        assets: [
          {
            assetId:
              'asset-a',

            originalFileName:
              a.name,

            format:
              'wav',

            sizeBytes:
              a.size,

            durationSeconds:
              60,
          },
          {
            assetId:
              'asset-b',

            originalFileName:
              b.name,

            format:
              'wav',

            sizeBytes:
              b.size,

            durationSeconds:
              70,
          },
          {
            assetId:
              'asset-id',

            originalFileName:
              id.name,

            format:
              'wav',

            sizeBytes:
              id.size,

            durationSeconds:
              3,
          },
        ],

        tracks: [
          {
            trackId:
              'track-a',

            assetId:
              'asset-a',

            state: {
              trimStartSeconds:
                2,

              trimEndSeconds:
                55,

              gainDb:
                -3,

              pan:
                -0.25,
            },
          },
          {
            trackId:
              'track-b',

            assetId:
              'asset-b',

            state: {
              trimStartSeconds:
                1,

              trimEndSeconds:
                65,

              gainDb:
                1,

              pan:
                0.4,
            },
          },
        ],

        transitions: [
          {
            fromTrackId:
              'track-a',

            toTrackId:
              'track-b',

            durationSeconds:
              4,

            curve:
              'fast-cut',

            usesDefault:
              false,
          },
        ],

        transitionDefaults: {
          durationSeconds:
            8,

          curve:
            'equal-power',
        },

        finalFade: {
          enabled:
            true,

          durationSeconds:
            6,

          curve:
            'linear',
        },

        vignette: {
          enabled:
            true,

          assetId:
            'asset-id',

          mode:
            'duck-overlay-v1',
        },

        render: {
          exportName:
            'RESTORE_TEST',

          loudnessMode:
            'off',

          outputFormat:
            'wav',

          sampleRate:
            48_000,

          channels:
            2,
        },
      };

      return {
        project,

        files:
          new Map<string, File>([
            [
              'asset-a',
              a,
            ],
            [
              'asset-b',
              b,
            ],
            [
              'asset-id',
              id,
            ],
          ]),
      };
    }


    it(
      'reconstructs ordered tracks with stable IDs and assets',
      () => {
        const data =
          fixture();

        const plan =
          buildBuildV2ProjectRestorePlan(
            data.project,
            data.files,
          );

        expect(
          plan.tracks.map(
            track =>
              track.trackId,
          ),
        ).toEqual([
          'track-a',
          'track-b',
        ]);

        expect(
          plan.tracks.map(
            track =>
              track.assetId,
          ),
        ).toEqual([
          'asset-a',
          'asset-b',
        ]);

        expect(
          plan.tracks[0]
            .durationSeconds,
        ).toBe(60);
      },
    );


    it(
      'restores Gain Pan and Trim',
      () => {
        const data =
          fixture();

        const plan =
          buildBuildV2ProjectRestorePlan(
            data.project,
            data.files,
          );

        expect(
          plan.tracks[0].state,
        ).toEqual({
          trimStartSeconds:
            2,

          trimEndSeconds:
            55,

          gainDb:
            -3,

          pan:
            -0.25,
        });
      },
    );


    it(
      'restores transitions defaults Final Fade and vignette',
      () => {
        const data =
          fixture();

        const plan =
          buildBuildV2ProjectRestorePlan(
            data.project,
            data.files,
          );

        expect(
          plan.transitions[0],
        ).toEqual({
          fromTrackId:
            'track-a',

          toTrackId:
            'track-b',

          durationSeconds:
            4,

          curve:
            'fast-cut',

          usesDefault:
            false,
        });

        expect(
          plan.transitionDefaults,
        ).toEqual({
          durationSeconds:
            8,

          curve:
            'equal-power',
        });

        expect(
          plan.finalFade,
        ).toEqual({
          enabled:
            true,

          duration:
            6,

          curve:
            'linear',
        });

        expect(
          plan.vignette.assetId,
        ).toBe(
          'asset-id',
        );

        expect(
          plan.vignette.file?.name,
        ).toBe(
          'id.wav',
        );
      },
    );


    it(
      'rejects a missing file',
      () => {
        const data =
          fixture();

        data.files.delete(
          'asset-b',
        );

        expect(() =>
          buildBuildV2ProjectRestorePlan(
            data.project,
            data.files,
          ),
        ).toThrow();
      },
    );


    it(
      'rejects an extra file',
      () => {
        const data =
          fixture();

        data.files.set(
          'extra',
          wav(
            'extra.wav',
            [10],
          ),
        );

        expect(() =>
          buildBuildV2ProjectRestorePlan(
            data.project,
            data.files,
          ),
        ).toThrow();
      },
    );


    it(
      'rejects a mismatched file',
      () => {
        const data =
          fixture();

        data.files.set(
          'asset-a',
          wav(
            'wrong.wav',
            [1, 2, 3],
          ),
        );

        expect(() =>
          buildBuildV2ProjectRestorePlan(
            data.project,
            data.files,
          ),
        ).toThrow();
      },
    );
  },
);
