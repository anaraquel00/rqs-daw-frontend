import {
  buildBuildV2ProjectSnapshot,
  type BuildV2ProjectSessionInput,
} from './build-v2-project-session';


describe(
  'BUILD V2 session to canonical project',
  () => {
    const createdAt =
      '2026-11-13T18:00:00.000Z';

    const updatedAt =
      '2026-11-13T19:00:00.000Z';


    function file(
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
            name.endsWith('.mp3')
              ? 'audio/mpeg'
              : 'audio/wav',
        },
      );
    }


    function session(
      vignetteEnabled =
        true,
    ): BuildV2ProjectSessionInput {
      return {
        projectId:
          'project-001',

        projectName:
          'RQS SESSION TEST',

        createdAt,
        updatedAt,

        tracks: [
          {
            trackId:
              'track-a',

            assetId:
              'asset-a',

            file:
              file(
                'a.wav',
                [1, 2, 3],
              ),

            durationSeconds:
              20,

            state: {
              trimStartSeconds:
                1,

              trimEndSeconds:
                19,

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

            file:
              file(
                'b.mp3',
                [4, 5, 6, 7],
              ),

            durationSeconds:
              20,

            state: {
              trimStartSeconds:
                0,

              trimEndSeconds:
                null,

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

          duration:
            6,

          curve:
            'linear',
        },

        vignette:
          vignetteEnabled
            ? {
                enabled:
                  true,

                assetId:
                  'asset-id',

                file:
                  file(
                    'rqs-id.wav',
                    [9, 8],
                  ),

                durationSeconds:
                  3,
              }
            : {
                enabled:
                  false,

                assetId:
                  null,

                file:
                  null,

                durationSeconds:
                  0,
              },

        render: {
          exportName:
            'RQS_SESSION_TEST',

          loudnessMode:
            'off',
        },
      };
    }


    it(
      'serializes the complete BUILD V2 session',
      () => {
        const snapshot =
          buildBuildV2ProjectSnapshot(
            session(),
          );

        expect(
          snapshot.project
            .tracks.map(
              track =>
                track.trackId,
            ),
        ).toEqual([
          'track-a',
          'track-b',
        ]);

        expect(
          snapshot.project
            .tracks.map(
              track =>
                track.assetId,
            ),
        ).toEqual([
          'asset-a',
          'asset-b',
        ]);

        expect(
          snapshot.project
            .tracks[0]
            .state,
        ).toEqual({
          trimStartSeconds:
            1,

          trimEndSeconds:
            19,

          gainDb:
            -3,

          pan:
            -0.25,
        });
      },
    );


    it(
      'serializes transition defaults and custom state',
      () => {
        const snapshot =
          buildBuildV2ProjectSnapshot(
            session(),
          );

        expect(
          snapshot.project
            .transitionDefaults,
        ).toEqual({
          durationSeconds:
            4,

          curve:
            'equal-power',
        });

        expect(
          snapshot.project
            .transitions[0],
        ).toEqual({
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
        });
      },
    );


    it(
      'serializes Final Fade state',
      () => {
        const snapshot =
          buildBuildV2ProjectSnapshot(
            session(),
          );

        expect(
          snapshot.project
            .finalFade,
        ).toEqual({
          enabled:
            true,

          durationSeconds:
            6,

          curve:
            'linear',
        });
      },
    );


    it(
      'includes enabled vignette as a separate asset',
      () => {
        const snapshot =
          buildBuildV2ProjectSnapshot(
            session(),
          );

        expect(
          snapshot.project
            .vignette,
        ).toEqual({
          enabled:
            true,

          assetId:
            'asset-id',

          mode:
            'duck-overlay-v1',
        });

        expect(
          snapshot.assets.map(
            asset =>
              asset.assetId,
          ),
        ).toEqual([
          'asset-a',
          'asset-b',
          'asset-id',
        ]);
      },
    );


    it(
      'omits the vignette asset when it is disabled',
      () => {
        const snapshot =
          buildBuildV2ProjectSnapshot(
            session(false),
          );

        expect(
          snapshot.project
            .vignette,
        ).toEqual({
          enabled:
            false,

          assetId:
            null,

          mode:
            'duck-overlay-v1',
        });

        expect(
          snapshot.assets.map(
            asset =>
              asset.assetId,
          ),
        ).toEqual([
          'asset-a',
          'asset-b',
        ]);
      },
    );


    it(
      'preserves WAV and MP3 asset formats',
      () => {
        const snapshot =
          buildBuildV2ProjectSnapshot(
            session(),
          );

        expect(
          snapshot.project
            .assets.map(
              asset =>
                asset.format,
            ),
        ).toEqual([
          'wav',
          'mp3',
          'wav',
        ]);
      },
    );


    it(
      'rejects an enabled vignette without its persisted file identity',
      () => {
        const input =
          session();

        input.vignette.file =
          null;

        expect(() =>
          buildBuildV2ProjectSnapshot(
            input,
          ),
        ).toThrowError(
          'BUILD_V2_PROJECT_VIGNETTE_ASSET_MISSING',
        );
      },
    );


    it(
      'passes the result through the canonical Gate 4A validator',
      () => {
        const input =
          session();

        input.tracks[0]
          .state.gainDb =
          100;

        expect(() =>
          buildBuildV2ProjectSnapshot(
            input,
          ),
        ).toThrow();
      },
    );
  },
);
