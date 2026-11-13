import {
  BUILD_V2_PROJECT_KIND,
  BUILD_V2_PROJECT_SCHEMA_VERSION,
  BuildV2ProjectDocumentV1,
  BuildV2ProjectSchemaError,
  createEmptyBuildV2ProjectDocument,
  isBuildV2ProjectDocument,
  parseBuildV2ProjectDocument,
  parseBuildV2ProjectJson,
  serializeBuildV2ProjectDocument,
} from './build-v2-project-schema';


describe(
  'BUILD V2 canonical project schema',
  () => {
    const timestamp =
      '2026-11-13T18:30:00.000Z';

    function validProject():
      BuildV2ProjectDocumentV1 {
      return {
        kind:
          BUILD_V2_PROJECT_KIND,

        schemaVersion:
          BUILD_V2_PROJECT_SCHEMA_VERSION,

        projectId:
          'project-001',

        name:
          'RQS TEST SET',

        createdAt:
          timestamp,

        updatedAt:
          timestamp,

        assets: [
          {
            assetId:
              'asset-a',

            originalFileName:
              'track-a.wav',

            format:
              'wav',

            sizeBytes:
              1_000_000,

            durationSeconds:
              20,
          },
          {
            assetId:
              'asset-b',

            originalFileName:
              'track-b.mp3',

            format:
              'mp3',

            sizeBytes:
              900_000,

            durationSeconds:
              20,
          },
          {
            assetId:
              'asset-id',

            originalFileName:
              'rqs-id.wav',

            format:
              'wav',

            sizeBytes:
              80_000,

            durationSeconds:
              4,
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
                0,

              trimEndSeconds:
                null,

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
                19,

              gainDb:
                0,

              pan:
                0.25,
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
              'equal-power',

            usesDefault:
              true,
          },
        ],

        transitionDefaults: {
          durationSeconds:
            4,

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
            'RQS_TEST_SET',

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
    }


    it(
      'creates an empty canonical project',
      () => {
        const project =
          createEmptyBuildV2ProjectDocument(
            'project-empty',
            'EMPTY PROJECT',
            timestamp,
          );

        expect(
          project.schemaVersion,
        ).toBe(1);

        expect(
          project.tracks,
        ).toEqual([]);

        expect(
          project.transitions,
        ).toEqual([]);

        expect(
          project.finalFade.enabled,
        ).toBeFalse();

        expect(
          project.vignette,
        ).toEqual({
          enabled: false,
          assetId: null,
          mode:
            'duck-overlay-v1',
        });
      },
    );


    it(
      'accepts a complete canonical BUILD V2 project',
      () => {
        const project =
          validProject();

        expect(
          parseBuildV2ProjectDocument(
            project,
          ),
        ).toEqual(
          project,
        );

        expect(
          isBuildV2ProjectDocument(
            project,
          ),
        ).toBeTrue();
      },
    );


    it(
      'round-trips through canonical JSON',
      () => {
        const original =
          validProject();

        const json =
          serializeBuildV2ProjectDocument(
            original,
          );

        const restored =
          parseBuildV2ProjectJson(
            json,
          );

        expect(
          restored,
        ).toEqual(
          original,
        );
      },
    );


    it(
      'rejects runtime-only fields such as rawUrl',
      () => {
        const project =
          validProject() as unknown as {
            tracks: Array<
              Record<string, unknown>
            >;
          };

        project.tracks[0][
          'rawUrl'
        ] =
          'blob:https://example.test/abc';

        expect(() =>
          parseBuildV2ProjectDocument(
            project,
          ),
        ).toThrowError(
          BuildV2ProjectSchemaError,
        );
      },
    );


    it(
      'rejects an unsupported schema version',
      () => {
        const project =
          validProject() as unknown as
            Record<string, unknown>;

        project[
          'schemaVersion'
        ] = 2;

        try {
          parseBuildV2ProjectDocument(
            project,
          );

          fail(
            'Expected schema validation failure.',
          );
        } catch (error) {
          expect(
            error instanceof
              BuildV2ProjectSchemaError,
          ).toBeTrue();

          expect(
            (
              error as
                BuildV2ProjectSchemaError
            ).code,
          ).toBe(
            'UNSUPPORTED_VERSION',
          );
        }
      },
    );


    it(
      'rejects a missing audio asset reference',
      () => {
        const project =
          validProject();

        project.tracks[0].assetId =
          'asset-missing';

        try {
          parseBuildV2ProjectDocument(
            project,
          );

          fail(
            'Expected missing asset rejection.',
          );
        } catch (error) {
          expect(
            (
              error as
                BuildV2ProjectSchemaError
            ).code,
          ).toBe(
            'INVALID_REFERENCE',
          );
        }
      },
    );


    it(
      'rejects transitions that do not follow track order',
      () => {
        const project =
          validProject();

        project.transitions[0]
          .fromTrackId =
          'track-b';

        expect(() =>
          parseBuildV2ProjectDocument(
            project,
          ),
        ).toThrowError(
          BuildV2ProjectSchemaError,
        );
      },
    );


    it(
      'rejects crossfades incompatible with trimmed geometry',
      () => {
        const project =
          validProject();

        project.tracks[1].state = {
          trimStartSeconds:
            16,

          trimEndSeconds:
            null,

          gainDb:
            0,

          pan:
            0,
        };

        project.transitions[0]
          .durationSeconds =
          4;

        project
          .transitionDefaults
          .durationSeconds =
          4;

        try {
          parseBuildV2ProjectDocument(
            project,
          );

          fail(
            'Expected geometry rejection.',
          );
        } catch (error) {
          expect(
            (
              error as
                BuildV2ProjectSchemaError
            ).code,
          ).toBe(
            'INVALID_GEOMETRY',
          );
        }
      },
    );


    it(
      'rejects a Final Fade incompatible with the last-track geometry',
      () => {
        const project =
          validProject();

        /*
         * Track B effective duration = 18 s.
         * Incoming transition = 14 s.
         * Final Fade 6 s therefore does not fit.
         */
        project.transitions[0]
          .durationSeconds =
          14;

        project.transitions[0]
          .usesDefault =
          false;

        project.finalFade
          .durationSeconds =
          6;

        try {
          parseBuildV2ProjectDocument(
            project,
          );

          fail(
            'Expected Final Fade rejection.',
          );
        } catch (error) {
          expect(
            (
              error as
                BuildV2ProjectSchemaError
            ).code,
          ).toBe(
            'INVALID_FINAL_FADE',
          );
        }
      },
    );


    it(
      'rejects vignette assets longer than sixty seconds',
      () => {
        const project =
          validProject();

        const vignette =
          project.assets.find(
            asset =>
              asset.assetId
              === 'asset-id',
          );

        expect(
          vignette,
        ).toBeDefined();

        vignette!.durationSeconds =
          60.1;

        try {
          parseBuildV2ProjectDocument(
            project,
          );

          fail(
            'Expected vignette rejection.',
          );
        } catch (error) {
          expect(
            (
              error as
                BuildV2ProjectSchemaError
            ).code,
          ).toBe(
            'INVALID_VIGNETTE',
          );
        }
      },
    );


    it(
      'does not allow the vignette to reuse a music asset',
      () => {
        const project =
          validProject();

        project.vignette.assetId =
          'asset-a';

        expect(() =>
          parseBuildV2ProjectDocument(
            project,
          ),
        ).toThrowError(
          BuildV2ProjectSchemaError,
        );
      },
    );
  },
);
