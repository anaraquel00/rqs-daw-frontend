import { Injectable } from '@angular/core';
import { Observable, from, map, mergeMap, of, switchMap, toArray } from 'rxjs';
import type {
  BuildV2ProjectDocumentV1,
} from '../mix-panel/build-v2-project-schema';
import { parseBuildV2ProjectDocument } from '../mix-panel/build-v2-project-schema';
import type { BuildV2ProjectSaveSnapshot } from '../mix-panel/build-v2-project-session';
import { BuildV2CloudAssetUploadService } from './build-v2-cloud-asset-upload.service';
import {
  DspService,
  type BuildV2CloudProjectDeleteResponse,
  type BuildV2CloudProjectSaveResponse,
  type BuildV2CloudQuotaResponse,
} from './dsp';

export type BuildV2CloudAuthoringErrorCode =
  | 'BUILD_CLOUD_PROJECT_QUOTA_EXCEEDED'
  | 'BUILD_CLOUD_STORAGE_QUOTA_EXCEEDED'
  | 'BUILD_CLOUD_AUTHORING_INVALID_STATE';

export class BuildV2CloudAuthoringError extends Error {
  constructor(
    readonly code: BuildV2CloudAuthoringErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BuildV2CloudAuthoringError';
  }
}

export interface BuildV2CloudProjectSaveRequest {
  snapshot: BuildV2ProjectSaveSnapshot;
  baseline: BuildV2ProjectDocumentV1 | null;
  expectedRevision: number | null;
}

export interface BuildV2CloudProjectSaveResult {
  kind: 'saved' | 'upToDate';
  project: BuildV2ProjectDocumentV1;
  response: BuildV2CloudProjectSaveResponse | null;
  quota: BuildV2CloudQuotaResponse | null;
  uploadedAssetIds: string[];
  removedAssetIds: string[];
}

const MAX_CONCURRENT_ASSET_UPLOADS = 3;

@Injectable({ providedIn: 'root' })
export class BuildV2CloudProjectAuthoringService {
  constructor(
    private readonly assetUpload: BuildV2CloudAssetUploadService,
    private readonly dsp: DspService,
  ) {}

  save(
    request: BuildV2CloudProjectSaveRequest,
  ): Observable<BuildV2CloudProjectSaveResult> {
    const project = parseBuildV2ProjectDocument(request.snapshot.project);
    const baseline = request.baseline
      ? parseBuildV2ProjectDocument(request.baseline)
      : null;

    this.assertIdentity(project, baseline, request.expectedRevision);

    if (baseline && this.documentsEqual(project, baseline)) {
      return of({
        kind: 'upToDate',
        project: baseline,
        response: null,
        quota: null,
        uploadedAssetIds: [],
        removedAssetIds: [],
      });
    }

    const document = baseline
      ? parseBuildV2ProjectDocument({
          ...project,
          createdAt: baseline.createdAt,
          updatedAt: this.nextTimestamp(baseline.updatedAt),
        })
      : project;
    const baselineAssetIds = new Set(
      baseline?.assets.map(asset => asset.assetId) ?? [],
    );
    const currentAssetIds = new Set(
      document.assets.map(asset => asset.assetId),
    );
    const newAssets = request.snapshot.assets.filter(
      asset => (
        currentAssetIds.has(asset.assetId)
        && !baselineAssetIds.has(asset.assetId)
      ),
    );
    const missingNewAsset = document.assets.find(asset => (
      !baselineAssetIds.has(asset.assetId)
      && !newAssets.some(payload => payload.assetId === asset.assetId)
    ));
    if (missingNewAsset) {
      throw new BuildV2CloudAuthoringError(
        'BUILD_CLOUD_AUTHORING_INVALID_STATE',
        `Missing local payload for asset ${missingNewAsset.assetId}.`,
      );
    }

    const removedAssetIds = [...baselineAssetIds].filter(
      assetId => !currentAssetIds.has(assetId),
    );
    const newBytes = newAssets.reduce((total, asset) => total + asset.file.size, 0);

    return this.dsp.getBuildV2CloudQuota().pipe(
      switchMap(quota => {
        this.assertQuota(quota, baseline === null, newBytes);
        return from(newAssets).pipe(
          mergeMap(
            asset => this.assetUpload.uploadBuildV2CloudAsset(
              document.projectId,
              asset.assetId,
              asset.file,
            ),
            MAX_CONCURRENT_ASSET_UPLOADS,
          ),
          toArray(),
          switchMap(() => this.dsp.saveBuildV2CloudProject(
            document,
            request.expectedRevision ?? undefined,
          )),
          map(response => ({
            kind: 'saved' as const,
            project: document,
            response,
            quota,
            uploadedAssetIds: newAssets.map(asset => asset.assetId),
            removedAssetIds,
          })),
        );
      }),
    );
  }

  delete(
    projectId: string,
    expectedRevision: number,
  ): Observable<BuildV2CloudProjectDeleteResponse> {
    return this.dsp.deleteBuildV2CloudProject(projectId, expectedRevision);
  }

  private assertIdentity(
    project: BuildV2ProjectDocumentV1,
    baseline: BuildV2ProjectDocumentV1 | null,
    expectedRevision: number | null,
  ): void {
    if (
      (baseline && baseline.projectId !== project.projectId)
      || (baseline && expectedRevision === null)
      || (!baseline && expectedRevision !== null)
    ) {
      throw new BuildV2CloudAuthoringError(
        'BUILD_CLOUD_AUTHORING_INVALID_STATE',
        'Cloud project identity and revision are inconsistent.',
      );
    }
  }

  private assertQuota(
    quota: BuildV2CloudQuotaResponse,
    createsProject: boolean,
    newBytes: number,
  ): void {
    if (createsProject && !quota.projects.canCreate) {
      throw new BuildV2CloudAuthoringError(
        'BUILD_CLOUD_PROJECT_QUOTA_EXCEEDED',
        'Cloud project quota has been reached.',
      );
    }
    if (
      newBytes > quota.storage.remainingBytes
      || (newBytes > 0 && !quota.storage.canReserve)
    ) {
      throw new BuildV2CloudAuthoringError(
        'BUILD_CLOUD_STORAGE_QUOTA_EXCEEDED',
        'Cloud storage quota is insufficient for the new assets.',
      );
    }
  }

  private nextTimestamp(previous: string): string {
    const previousMs = Date.parse(previous);
    return new Date(Math.max(Date.now(), previousMs + 1)).toISOString();
  }

  private documentsEqual(
    left: BuildV2ProjectDocumentV1,
    right: BuildV2ProjectDocumentV1,
  ): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
  }
}
