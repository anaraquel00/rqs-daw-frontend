import {
  type BuildV2ProjectDocumentV1,
} from './build-v2-project-schema';

import {
  BuildV2ProjectStorage,
  BuildV2ProjectStorageError,
} from './build-v2-project-storage';


describe(
  'BUILD V2 local project storage',
  () => {
    let dbName: string;
    let storage:
      BuildV2ProjectStorage;

    beforeEach(
      () => {
        dbName =
          `rqs-build-v2-test-${crypto.randomUUID()}`;

        storage =
          new BuildV2ProjectStorage(
            indexedDB,
            dbName,
          );
      },
    );

    afterEach(
      async () => {
        await deleteDatabase(
          dbName,
        );
      },
    );


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

          lastModified:
            123456789,
        },
      );
    }


    function project(
      updatedAt =
        '2026-11-13T18:00:00.000Z',
      includeVignette =
        true,
    ): {
      document:
        BuildV2ProjectDocumentV1;

      music:
        File;

      vignette:
        File | null;
    } {
      const music =
        wav(
          'track.wav',
          [
            1,
            2,
            3,
            4,
          ],
        );

      const vignette =
        includeVignette
          ? wav(
              'id.wav',
              [
                9,
                8,
                7,
              ],
            )
          : null;

      const assets:
        BuildV2ProjectDocumentV1[
          'assets'
        ] = [
          {
            assetId:
              'asset-track',

            originalFileName:
              music.name,

            format:
              'wav',

            sizeBytes:
              music.size,

            durationSeconds:
              10,
          },
        ];

      if (vignette) {
        assets.push({
          assetId:
            'asset-id',

          originalFileName:
            vignette.name,

          format:
            'wav',

          sizeBytes:
            vignette.size,

          durationSeconds:
            2,
        });
      }

      return {
        music,
        vignette,

        document: {
          kind:
            'rqs-build-project',

          schemaVersion:
            1,

          projectId:
            'project-001',

          name:
            'RQS LOCAL TEST',

          createdAt:
            '2026-11-13T17:00:00.000Z',

          updatedAt,

          assets,

          tracks: [
            {
              trackId:
                'track-001',

              assetId:
                'asset-track',

              state: {
                trimStartSeconds:
                  0,

                trimEndSeconds:
                  null,

                gainDb:
                  -3,

                pan:
                  0.25,
              },
            },
          ],

          transitions:
            [],

          transitionDefaults: {
            durationSeconds:
              8,

            curve:
              'equal-power',
          },

          finalFade: {
            enabled:
              false,

            durationSeconds:
              8,

            curve:
              'equal-power',
          },

          vignette: {
            enabled:
              Boolean(
                vignette,
              ),

            assetId:
              vignette
                ? 'asset-id'
                : null,

            mode:
              'duck-overlay-v1',
          },

          render: {
            exportName:
              'RQS_LOCAL_TEST',

            loudnessMode:
              'off',

            outputFormat:
              'wav',

            sampleRate:
              48_000,

            channels:
              2,
          },
        },
      };
    }


    it(
      'round-trips canonical project metadata and audio files',
      async () => {
        const data =
          project();

        await storage.save(
          data.document,
          [
            {
              assetId:
                'asset-track',

              file:
                data.music,
            },
            {
              assetId:
                'asset-id',

              file:
                data.vignette!,
            },
          ],
        );

        const loaded =
          await storage.load(
            'project-001',
          );

        expect(
          loaded,
        ).not.toBeNull();

        expect(
          loaded!.project,
        ).toEqual(
          data.document,
        );

        expect(
          loaded!.files.size,
        ).toBe(2);

        const loadedMusic =
          loaded!.files.get(
            'asset-track',
          );

        expect(
          loadedMusic?.name,
        ).toBe(
          'track.wav',
        );

        expect(
          loadedMusic?.size,
        ).toBe(
          data.music.size,
        );

        expect(
          loadedMusic
            ?.lastModified,
        ).toBe(
          123456789,
        );
      },
    );


    it(
      'replaces previous project assets atomically',
      async () => {
        const original =
          project();

        await storage.save(
          original.document,
          [
            {
              assetId:
                'asset-track',

              file:
                original.music,
            },
            {
              assetId:
                'asset-id',

              file:
                original.vignette!,
            },
          ],
        );

        const updated =
          project(
            '2026-11-13T19:00:00.000Z',
            false,
          );

        await storage.save(
          updated.document,
          [
            {
              assetId:
                'asset-track',

              file:
                updated.music,
            },
          ],
        );

        const loaded =
          await storage.load(
            'project-001',
          );

        expect(
          loaded?.project
            .vignette.enabled,
        ).toBeFalse();

        expect(
          loaded?.files.size,
        ).toBe(1);

        expect(
          loaded?.files.has(
            'asset-id',
          ),
        ).toBeFalse();
      },
    );


    it(
      'rejects a project save when an asset file is missing',
      async () => {
        const data =
          project();

        try {
          await storage.save(
            data.document,
            [
              {
                assetId:
                  'asset-track',

                file:
                  data.music,
              },
            ],
          );

          fail(
            'Expected missing asset rejection.',
          );
        } catch (error) {
          expect(
            error instanceof
              BuildV2ProjectStorageError,
          ).toBeTrue();

          expect(
            (
              error as
                BuildV2ProjectStorageError
            ).code,
          ).toBe(
            'MISSING_ASSET',
          );
        }
      },
    );


    it(
      'rejects a file that does not match the asset manifest',
      async () => {
        const data =
          project(
            undefined,
            false,
          );

        const wrong =
          wav(
            'different.wav',
            [
              1,
              2,
              3,
              4,
            ],
          );

        try {
          await storage.save(
            data.document,
            [
              {
                assetId:
                  'asset-track',

                file:
                  wrong,
              },
            ],
          );

          fail(
            'Expected asset mismatch rejection.',
          );
        } catch (error) {
          expect(
            (
              error as
                BuildV2ProjectStorageError
            ).code,
          ).toBe(
            'ASSET_MISMATCH',
          );
        }
      },
    );


    it(
      'lists projects newest first',
      async () => {
        const first =
          project(
            '2026-11-13T18:00:00.000Z',
            false,
          );

        await storage.save(
          first.document,
          [
            {
              assetId:
                'asset-track',

              file:
                first.music,
            },
          ],
        );

        const second =
          project(
            '2026-11-13T20:00:00.000Z',
            false,
          );

        second.document.projectId =
          'project-002';

        second.document.name =
          'NEWER PROJECT';

        await storage.save(
          second.document,
          [
            {
              assetId:
                'asset-track',

              file:
                second.music,
            },
          ],
        );

        const list =
          await storage.list();

        expect(
          list.map(
            entry =>
              entry.projectId,
          ),
        ).toEqual([
          'project-002',
          'project-001',
        ]);
      },
    );


    it(
      'deletes project metadata and its audio assets',
      async () => {
        const data =
          project();

        await storage.save(
          data.document,
          [
            {
              assetId:
                'asset-track',

              file:
                data.music,
            },
            {
              assetId:
                'asset-id',

              file:
                data.vignette!,
            },
          ],
        );

        await storage.delete(
          'project-001',
        );

        expect(
          await storage.load(
            'project-001',
          ),
        ).toBeNull();

        expect(
          await storage.list(),
        ).toEqual([]);
      },
    );
  },
);


function deleteDatabase(
  dbName: string,
): Promise<void> {
  return new Promise(
    (resolve, reject) => {
      const request =
        indexedDB.deleteDatabase(
          dbName,
        );

      request.onsuccess =
        () => resolve();

      request.onerror =
        () =>
          reject(
            request.error,
          );

      request.onblocked =
        () => resolve();
    },
  );
}
