import { Injectable } from '@angular/core';
import { Observable, concatMap, from, switchMap, toArray } from 'rxjs';
import type { BuildV2ProjectSaveSnapshot } from '../mix-panel/build-v2-project-session';
import { BuildV2CloudAssetUploadService } from './build-v2-cloud-asset-upload.service';
import { DspService } from './dsp';
import type { BuildV2CloudProjectSaveResponse } from './dsp';

@Injectable({
  providedIn: 'root',
})
export class BuildV2CloudProjectSaveService {
  constructor(
    private readonly assetUpload: BuildV2CloudAssetUploadService,
    private readonly dsp: DspService,
  ) {}

  saveBuildV2CloudProjectSnapshot(
    snapshot: BuildV2ProjectSaveSnapshot,
    expectedRevision?: number,
  ): Observable<BuildV2CloudProjectSaveResponse> {
    return from(snapshot.assets).pipe(
      concatMap(asset => this.assetUpload.uploadBuildV2CloudAsset(
        snapshot.project.projectId,
        asset.assetId,
        asset.file,
      )),
      toArray(),
      switchMap(() => this.dsp.saveBuildV2CloudProject(snapshot.project, expectedRevision)),
    );
  }
}
