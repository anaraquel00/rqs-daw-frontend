import { HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  Observable,
  catchError,
  from,
  map,
  mergeMap,
  switchMap,
  throwError,
  toArray,
} from 'rxjs';
import {
  buildBuildV2ProjectRestorePlan,
} from '../mix-panel/build-v2-project-restore';
import {
  type BuildV2ProjectDocumentV1,
  parseBuildV2ProjectDocument,
} from '../mix-panel/build-v2-project-schema';
import {
  type BuildV2CloudRestoreAsset,
  type BuildV2CloudRestoreManifest,
  DspService,
} from './dsp';

const MAX_DOWNLOAD_CONCURRENCY = 3;

export interface BuildV2CloudProjectRestoreBundle {
  project: BuildV2ProjectDocumentV1;
  files: ReadonlyMap<string, File>;
  revision: number;
}

export type BuildV2CloudProjectRestorePhase =
  | 'manifest'
  | 'downloading'
  | 'assembling';

export interface BuildV2CloudProjectRestoreProgress {
  phase: BuildV2CloudProjectRestorePhase;
  totalAssets: number;
  completedAssets: number;
  totalBytes: number;
  loadedBytes: number;
  percent: number;
}

export type BuildV2CloudProjectRestoreErrorCode =
  | 'INVALID_MANIFEST'
  | 'ASSET_SET_MISMATCH'
  | 'ASSET_METADATA_MISMATCH'
  | 'ASSET_DOWNLOAD_FAILED'
  | 'ASSET_BLOB_MISMATCH';

export class BuildV2CloudProjectRestoreError extends Error {
  constructor(
    readonly code: BuildV2CloudProjectRestoreErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BuildV2CloudProjectRestoreError';
  }
}

class BuildV2CloudDownloadExpiredError extends Error {}

interface ValidatedManifest {
  project: BuildV2ProjectDocumentV1;
  revision: number;
  assets: readonly BuildV2CloudRestoreAsset[];
  totalBytes: number;
}

@Injectable({ providedIn: 'root' })
export class BuildV2CloudProjectRestoreService {
  private readonly dsp = inject(DspService);

  restoreBuildV2CloudProject(
    projectId: string,
    onProgress: (
      progress: BuildV2CloudProjectRestoreProgress,
    ) => void = () => undefined,
  ): Observable<BuildV2CloudProjectRestoreBundle> {
    this.emitManifestProgress(onProgress);

    return this.restoreAttempt(
      projectId,
      0,
      onProgress,
    );
  }

  private restoreAttempt(
    projectId: string,
    refreshCount: number,
    onProgress: (
      progress: BuildV2CloudProjectRestoreProgress,
    ) => void,
  ): Observable<BuildV2CloudProjectRestoreBundle> {
    return this.dsp.getBuildV2CloudRestoreManifest(projectId).pipe(
      map(manifest => {
        const validated =
          this.validateManifest(
            manifest,
            projectId,
          );

        onProgress({
          phase: 'downloading',
          totalAssets:
            validated.assets.length,
          completedAssets: 0,
          totalBytes:
            validated.totalBytes,
          loadedBytes: 0,
          percent:
            validated.totalBytes === 0
              ? 100
              : 0,
        });

        return validated;
      }),
      switchMap(manifest =>
        this.downloadBundle(
          manifest,
          onProgress,
        ),
      ),
      catchError(error => {
        if (
          error instanceof BuildV2CloudDownloadExpiredError
          && refreshCount === 0
        ) {
          this.emitManifestProgress(
            onProgress,
          );

          return this.restoreAttempt(
            projectId,
            1,
            onProgress,
          );
        }

        return throwError(() => error);
      }),
    );
  }

  private emitManifestProgress(
    onProgress: (
      progress: BuildV2CloudProjectRestoreProgress,
    ) => void,
  ): void {
    onProgress({
      phase: 'manifest',
      totalAssets: 0,
      completedAssets: 0,
      totalBytes: 0,
      loadedBytes: 0,
      percent: 0,
    });
  }

  private validateManifest(
    manifest: BuildV2CloudRestoreManifest,
    requestedProjectId: string,
  ): ValidatedManifest {
    let project: BuildV2ProjectDocumentV1;
    try {
      project = parseBuildV2ProjectDocument(manifest?.project);
    } catch {
      throw new BuildV2CloudProjectRestoreError(
        'INVALID_MANIFEST',
        'Cloud restore manifest contains a non-canonical project.',
      );
    }

    if (
      project.projectId !== requestedProjectId
      || !Number.isSafeInteger(manifest?.revision)
      || manifest.revision < 1
      || !Array.isArray(manifest?.assets)
      || !Number.isSafeInteger(manifest?.totalBytes)
      || manifest.totalBytes < 0
    ) {
      throw new BuildV2CloudProjectRestoreError(
        'INVALID_MANIFEST',
        'Cloud restore manifest metadata is invalid.',
      );
    }

    const expectedTotalBytes = project.assets.reduce(
      (total, asset) => total + asset.sizeBytes,
      0,
    );
    if (manifest.totalBytes !== expectedTotalBytes) {
      throw new BuildV2CloudProjectRestoreError(
        'ASSET_METADATA_MISMATCH',
        'Cloud restore total size does not match the canonical project.',
      );
    }

    if (manifest.assets.length !== project.assets.length) {
      throw new BuildV2CloudProjectRestoreError(
        'ASSET_SET_MISMATCH',
        'Cloud restore asset count does not match the canonical project.',
      );
    }

    const manifestById = new Map<string, BuildV2CloudRestoreAsset>();
    for (const asset of manifest.assets) {
      if (!asset || manifestById.has(asset.assetId)) {
        throw new BuildV2CloudProjectRestoreError(
          'ASSET_SET_MISMATCH',
          'Cloud restore manifest contains a duplicate asset.',
        );
      }
      manifestById.set(asset.assetId, asset);
    }

    const orderedAssets = project.assets.map(canonicalAsset => {
      const manifestAsset = manifestById.get(canonicalAsset.assetId);
      const expectedContentType = canonicalAsset.format === 'wav'
        ? 'audio/wav'
        : 'audio/mpeg';
      if (!manifestAsset) {
        throw new BuildV2CloudProjectRestoreError(
          'ASSET_SET_MISMATCH',
          'Cloud restore manifest is missing a canonical asset.',
        );
      }
      if (
        manifestAsset.originalFileName !== canonicalAsset.originalFileName
        || manifestAsset.format !== canonicalAsset.format
        || manifestAsset.sizeBytes !== canonicalAsset.sizeBytes
        || manifestAsset.contentType !== expectedContentType
        || manifestAsset.expiresInSeconds !== 900
        || !this.isHttpsUrl(manifestAsset.downloadUrl)
      ) {
        throw new BuildV2CloudProjectRestoreError(
          'ASSET_METADATA_MISMATCH',
          `Cloud restore metadata mismatch for asset ${canonicalAsset.assetId}.`,
        );
      }
      return manifestAsset;
    });

    if (manifestById.size !== project.assets.length) {
      throw new BuildV2CloudProjectRestoreError(
        'ASSET_SET_MISMATCH',
        'Cloud restore manifest contains an extra asset.',
      );
    }

    return {
      project,
      revision: manifest.revision,
      assets: orderedAssets,
      totalBytes: manifest.totalBytes,
    };
  }

  private downloadBundle(
    manifest: ValidatedManifest,
    onProgress: (
      progress: BuildV2CloudProjectRestoreProgress,
    ) => void,
  ): Observable<BuildV2CloudProjectRestoreBundle> {
    const loadedByAsset =
      new Map<string, number>();

    let completedAssets = 0;

    const emitProgress = (
      phase: BuildV2CloudProjectRestorePhase,
    ): void => {
      const loadedBytes =
        phase === 'assembling'
          ? manifest.totalBytes
          : Math.min(
              manifest.totalBytes,
              [...loadedByAsset.values()]
                .reduce(
                  (sum, value) =>
                    sum + value,
                  0,
                ),
            );

      onProgress({
        phase,
        totalAssets:
          manifest.assets.length,
        completedAssets,
        totalBytes:
          manifest.totalBytes,
        loadedBytes,
        percent:
          manifest.totalBytes === 0
            ? 100
            : Math.min(
                100,
                (
                  loadedBytes
                  / manifest.totalBytes
                ) * 100,
              ),
      });
    };

    return from(manifest.assets).pipe(
      mergeMap(
        asset =>
          this.downloadAsset(
            asset,
            loadedBytes => {
              loadedByAsset.set(
                asset.assetId,
                Math.min(
                  asset.sizeBytes,
                  Math.max(
                    0,
                    loadedBytes,
                  ),
                ),
              );

              emitProgress(
                'downloading',
              );
            },
            () => {
              loadedByAsset.set(
                asset.assetId,
                asset.sizeBytes,
              );

              completedAssets += 1;

              emitProgress(
                'downloading',
              );
            },
          ),
        MAX_DOWNLOAD_CONCURRENCY,
      ),
      toArray(),
      map(downloaded => {
        emitProgress(
          'assembling',
        );

        const files = new Map(
          downloaded.map(
            ({ assetId, file }) =>
              [assetId, file],
          ),
        );

        buildBuildV2ProjectRestorePlan(
          manifest.project,
          files,
        );

        return {
          project: manifest.project,
          files,
          revision: manifest.revision,
        };
      }),
    );
  }

  private downloadAsset(
    asset: BuildV2CloudRestoreAsset,
    onLoaded: (
      loadedBytes: number,
    ) => void,
    onCompleted: () => void,
  ): Observable<{ assetId: string; file: File }> {
    return this.dsp.downloadBuildV2CloudAsset(
      asset.downloadUrl,
      loadedBytes =>
        onLoaded(loadedBytes),
    ).pipe(
      catchError(error => {
        if (error instanceof HttpErrorResponse && error.status === 403) {
          return throwError(() => new BuildV2CloudDownloadExpiredError());
        }
        return throwError(() => new BuildV2CloudProjectRestoreError(
          'ASSET_DOWNLOAD_FAILED',
          `Cloud asset download failed for ${asset.assetId}.`,
        ));
      }),
      map(blob => {
        if (
          blob.size !== asset.sizeBytes
          || (blob.type !== '' && blob.type !== asset.contentType)
        ) {
          throw new BuildV2CloudProjectRestoreError(
            'ASSET_BLOB_MISMATCH',
            `Downloaded cloud asset does not match ${asset.assetId}.`,
          );
        }
        onLoaded(
          asset.sizeBytes,
        );

        onCompleted();

        return {
          assetId: asset.assetId,
          file: new File(
            [blob],
            asset.originalFileName,
            { type: asset.contentType },
          ),
        };
      }),
    );
  }

  private isHttpsUrl(value: string): boolean {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }
}
