import {
  type BuildV2ProjectDocumentV1,
  parseBuildV2ProjectDocument,
} from './build-v2-project-schema';


const BUILD_V2_PROJECT_DB_NAME =
  'rqs-build-v2';

const BUILD_V2_PROJECT_DB_VERSION =
  1;

const PROJECT_STORE =
  'projects';

const ASSET_STORE =
  'assets';

const ASSET_PROJECT_INDEX =
  'byProject';


export interface BuildV2ProjectAssetPayload {
  assetId: string;
  file: File;
}


export interface BuildV2LoadedLocalProject {
  project: BuildV2ProjectDocumentV1;
  files: ReadonlyMap<string, File>;
}


export interface BuildV2LocalProjectSummary {
  projectId: string;
  name: string;
  updatedAt: string;
  trackCount: number;
  hasVignette: boolean;
}


interface BuildV2StoredAssetRecord {
  key: string;
  projectId: string;
  assetId: string;
  blob: Blob;
  originalFileName: string;
  mimeType: string;
  lastModified: number;
}


export type BuildV2ProjectStorageErrorCode =
  | 'INDEXEDDB_UNAVAILABLE'
  | 'MISSING_ASSET'
  | 'EXTRA_ASSET'
  | 'ASSET_MISMATCH'
  | 'CORRUPT_STORAGE';


export class BuildV2ProjectStorageError
  extends Error {
  constructor(
    readonly code:
      BuildV2ProjectStorageErrorCode,
    message: string,
  ) {
    super(message);

    this.name =
      'BuildV2ProjectStorageError';
  }
}


export class BuildV2ProjectStorage {
  constructor(
    private readonly factory:
      IDBFactory | undefined =
      (
        typeof indexedDB
        !== 'undefined'
          ? indexedDB
          : undefined
      ),

    private readonly dbName =
      BUILD_V2_PROJECT_DB_NAME,
  ) {}


  async save(
    projectInput:
      BuildV2ProjectDocumentV1,
    assetPayloads:
      readonly BuildV2ProjectAssetPayload[],
  ): Promise<void> {
    const project =
      parseBuildV2ProjectDocument(
        projectInput,
      );

    const payloads =
      this.validateAssetPayloads(
        project,
        assetPayloads,
      );

    const db =
      await this.open();

    try {
      await new Promise<void>(
        (resolve, reject) => {
          const transaction =
            db.transaction(
              [
                PROJECT_STORE,
                ASSET_STORE,
              ],
              'readwrite',
            );

          transaction.oncomplete =
            () => resolve();

          transaction.onerror =
            () =>
              reject(
                transaction.error
                ?? new Error(
                  'IndexedDB save failed.',
                ),
              );

          transaction.onabort =
            () =>
              reject(
                transaction.error
                ?? new Error(
                  'IndexedDB save aborted.',
                ),
              );

          const projects =
            transaction.objectStore(
              PROJECT_STORE,
            );

          const assets =
            transaction.objectStore(
              ASSET_STORE,
            );

          const projectIndex =
            assets.index(
              ASSET_PROJECT_INDEX,
            );

          /*
           * Replace all stored assets for this project
           * inside the same transaction.
           *
           * This prevents stale vignette/track blobs
           * surviving a project overwrite.
           */
          const cursorRequest =
            projectIndex.openCursor(
              IDBKeyRange.only(
                project.projectId,
              ),
            );

          cursorRequest.onerror =
            () => {
              transaction.abort();
            };

          cursorRequest.onsuccess =
            () => {
              const cursor =
                cursorRequest.result;

              if (cursor) {
                cursor.delete();
                cursor.continue();
                return;
              }

              for (
                const payload
                of payloads
              ) {
                const record:
                  BuildV2StoredAssetRecord = {
                  key:
                    this.assetKey(
                      project.projectId,
                      payload.assetId,
                    ),

                  projectId:
                    project.projectId,

                  assetId:
                    payload.assetId,

                  blob:
                    payload.file,

                  originalFileName:
                    payload.file.name,

                  mimeType:
                    payload.file.type,

                  lastModified:
                    payload.file.lastModified,
                };

                assets.put(
                  record,
                );
              }

              projects.put(
                project,
              );
            };
        },
      );
    } finally {
      db.close();
    }
  }


  async load(
    projectId: string,
  ): Promise<BuildV2LoadedLocalProject | null> {
    const db =
      await this.open();

    try {
      const rawProject =
        await this.request(
          db
            .transaction(
              PROJECT_STORE,
              'readonly',
            )
            .objectStore(
              PROJECT_STORE,
            )
            .get(
              projectId,
            ),
        );

      if (
        rawProject === undefined
      ) {
        return null;
      }

      let project:
        BuildV2ProjectDocumentV1;

      try {
        project =
          parseBuildV2ProjectDocument(
            rawProject,
          );
      } catch (error) {
        throw new BuildV2ProjectStorageError(
          'CORRUPT_STORAGE',
          `Stored project ${projectId} is invalid: ${String(error)}`,
        );
      }

      const transaction =
        db.transaction(
          ASSET_STORE,
          'readonly',
        );

      const records =
        await this.request(
          transaction
            .objectStore(
              ASSET_STORE,
            )
            .index(
              ASSET_PROJECT_INDEX,
            )
            .getAll(
              IDBKeyRange.only(
                projectId,
              ),
            ),
        ) as BuildV2StoredAssetRecord[];

      const recordsById =
        new Map(
          records.map(
            record => [
              record.assetId,
              record,
            ],
          ),
        );

      const files =
        new Map<string, File>();

      for (
        const asset
        of project.assets
      ) {
        const record =
          recordsById.get(
            asset.assetId,
          );

        if (!record) {
          throw new BuildV2ProjectStorageError(
            'CORRUPT_STORAGE',
            `Stored project ${projectId} is missing asset ${asset.assetId}.`,
          );
        }

        const file =
          new File(
            [
              record.blob,
            ],
            record.originalFileName,
            {
              type:
                record.mimeType,

              lastModified:
                record.lastModified,
            },
          );

        if (
          file.name
            !== asset.originalFileName
          || file.size
            !== asset.sizeBytes
        ) {
          throw new BuildV2ProjectStorageError(
            'CORRUPT_STORAGE',
            `Stored asset ${asset.assetId} does not match the project manifest.`,
          );
        }

        files.set(
          asset.assetId,
          file,
        );
      }

      if (
        files.size
        !== records.length
      ) {
        throw new BuildV2ProjectStorageError(
          'CORRUPT_STORAGE',
          `Stored project ${projectId} contains stale asset records.`,
        );
      }

      return {
        project,
        files,
      };
    } finally {
      db.close();
    }
  }


  async list():
    Promise<
      BuildV2LocalProjectSummary[]
    > {
    const db =
      await this.open();

    try {
      const rawProjects =
        await this.request(
          db
            .transaction(
              PROJECT_STORE,
              'readonly',
            )
            .objectStore(
              PROJECT_STORE,
            )
            .getAll(),
        );

      const summaries =
        rawProjects.map(
          raw => {
            let project:
              BuildV2ProjectDocumentV1;

            try {
              project =
                parseBuildV2ProjectDocument(
                  raw,
                );
            } catch (error) {
              throw new BuildV2ProjectStorageError(
                'CORRUPT_STORAGE',
                `Stored project list contains invalid data: ${String(error)}`,
              );
            }

            return {
              projectId:
                project.projectId,

              name:
                project.name,

              updatedAt:
                project.updatedAt,

              trackCount:
                project.tracks.length,

              hasVignette:
                project.vignette.enabled,
            };
          },
        );

      return summaries.sort(
        (left, right) =>
          Date.parse(
            right.updatedAt,
          )
          - Date.parse(
            left.updatedAt,
          ),
      );
    } finally {
      db.close();
    }
  }


  async delete(
    projectId: string,
  ): Promise<void> {
    const db =
      await this.open();

    try {
      await new Promise<void>(
        (resolve, reject) => {
          const transaction =
            db.transaction(
              [
                PROJECT_STORE,
                ASSET_STORE,
              ],
              'readwrite',
            );

          transaction.oncomplete =
            () => resolve();

          transaction.onerror =
            () =>
              reject(
                transaction.error
                ?? new Error(
                  'IndexedDB delete failed.',
                ),
              );

          transaction.onabort =
            () =>
              reject(
                transaction.error
                ?? new Error(
                  'IndexedDB delete aborted.',
                ),
              );

          transaction
            .objectStore(
              PROJECT_STORE,
            )
            .delete(
              projectId,
            );

          const assets =
            transaction.objectStore(
              ASSET_STORE,
            );

          const cursorRequest =
            assets
              .index(
                ASSET_PROJECT_INDEX,
              )
              .openCursor(
                IDBKeyRange.only(
                  projectId,
                ),
              );

          cursorRequest.onerror =
            () => {
              transaction.abort();
            };

          cursorRequest.onsuccess =
            () => {
              const cursor =
                cursorRequest.result;

              if (!cursor) {
                return;
              }

              cursor.delete();
              cursor.continue();
            };
        },
      );
    } finally {
      db.close();
    }
  }


  private validateAssetPayloads(
    project:
      BuildV2ProjectDocumentV1,
    payloads:
      readonly BuildV2ProjectAssetPayload[],
  ):
    BuildV2ProjectAssetPayload[] {
    const manifest =
      new Map(
        project.assets.map(
          asset => [
            asset.assetId,
            asset,
          ],
        ),
      );

    const payloadById =
      new Map<
        string,
        BuildV2ProjectAssetPayload
      >();

    for (
      const payload
      of payloads
    ) {
      if (
        payloadById.has(
          payload.assetId,
        )
      ) {
        throw new BuildV2ProjectStorageError(
          'EXTRA_ASSET',
          `Duplicate asset payload: ${payload.assetId}`,
        );
      }

      payloadById.set(
        payload.assetId,
        payload,
      );
    }

    for (
      const asset
      of project.assets
    ) {
      const payload =
        payloadById.get(
          asset.assetId,
        );

      if (!payload) {
        throw new BuildV2ProjectStorageError(
          'MISSING_ASSET',
          `Missing file for asset ${asset.assetId}.`,
        );
      }

      if (
        payload.file.name
          !== asset.originalFileName
        || payload.file.size
          !== asset.sizeBytes
      ) {
        throw new BuildV2ProjectStorageError(
          'ASSET_MISMATCH',
          `File for asset ${asset.assetId} does not match the canonical manifest.`,
        );
      }
    }

    for (
      const payload
      of payloads
    ) {
      if (
        !manifest.has(
          payload.assetId,
        )
      ) {
        throw new BuildV2ProjectStorageError(
          'EXTRA_ASSET',
          `Unexpected file payload ${payload.assetId}.`,
        );
      }
    }

    return [
      ...payloads,
    ];
  }


  private assetKey(
    projectId: string,
    assetId: string,
  ): string {
    return (
      `${projectId}:${assetId}`
    );
  }


  private async open():
    Promise<IDBDatabase> {
    if (!this.factory) {
      throw new BuildV2ProjectStorageError(
        'INDEXEDDB_UNAVAILABLE',
        'IndexedDB is not available in this environment.',
      );
    }

    return new Promise<
      IDBDatabase
    >(
      (resolve, reject) => {
        const request =
          this.factory!.open(
            this.dbName,
            BUILD_V2_PROJECT_DB_VERSION,
          );

        request.onerror =
          () =>
            reject(
              request.error
              ?? new Error(
                'Could not open IndexedDB.',
              ),
            );

        request.onupgradeneeded =
          () => {
            const db =
              request.result;

            if (
              !db.objectStoreNames
                .contains(
                  PROJECT_STORE,
                )
            ) {
              db.createObjectStore(
                PROJECT_STORE,
                {
                  keyPath:
                    'projectId',
                },
              );
            }

            if (
              !db.objectStoreNames
                .contains(
                  ASSET_STORE,
                )
            ) {
              const assets =
                db.createObjectStore(
                  ASSET_STORE,
                  {
                    keyPath:
                      'key',
                  },
                );

              assets.createIndex(
                ASSET_PROJECT_INDEX,
                'projectId',
                {
                  unique:
                    false,
                },
              );
            }
          };

        request.onsuccess =
          () =>
            resolve(
              request.result,
            );
      },
    );
  }


  private request<T>(
    request:
      IDBRequest<T>,
  ): Promise<T> {
    return new Promise<T>(
      (resolve, reject) => {
        request.onsuccess =
          () =>
            resolve(
              request.result,
            );

        request.onerror =
          () =>
            reject(
              request.error
              ?? new Error(
                'IndexedDB request failed.',
              ),
            );
      },
    );
  }
}
