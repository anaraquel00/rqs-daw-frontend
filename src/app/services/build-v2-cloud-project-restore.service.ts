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
}

@Injectable({ providedIn: 'root' })
export class BuildV2CloudProjectRestoreService {
  private readonly dsp = inject(DspService);

  restoreBuildV2CloudProject(
    projectId: string,
  ): Observable<BuildV2CloudProjectRestoreBundle> {
    return this.restoreAttempt(projectId, 0);
  }

  private restoreAttempt(
    projectId: string,
    refreshCount: number,
  ): Observable<BuildV2CloudProjectRestoreBundle> {
    return this.dsp.getBuildV2CloudRestoreManifest(projectId).pipe(
      map(manifest => this.validateManifest(manifest, projectId)),
      switchMap(manifest => this.downloadBundle(manifest)),
      catchError(error => {
        if (
          error instanceof BuildV2CloudDownloadExpiredError
          && refreshCount === 0
        ) {
          return this.restoreAttempt(projectId, 1);
        }
        return throwError(() => error);
      }),
    );
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
    };
  }

  private downloadBundle(
    manifest: ValidatedManifest,
  ): Observable<BuildV2CloudProjectRestoreBundle> {
    return from(manifest.assets).pipe(
      mergeMap(
        asset => this.downloadAsset(asset),
        MAX_DOWNLOAD_CONCURRENCY,
      ),
      toArray(),
      map(downloaded => {
        const files = new Map(
          downloaded.map(({ assetId, file }) => [assetId, file]),
        );
        buildBuildV2ProjectRestorePlan(manifest.project, files);
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
  ): Observable<{ assetId: string; file: File }> {
    return this.dsp.downloadBuildV2CloudAsset(asset.downloadUrl).pipe(
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
