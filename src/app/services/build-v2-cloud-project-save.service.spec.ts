import { firstValueFrom, of, throwError } from 'rxjs';
import type { BuildV2ProjectSaveSnapshot } from '../mix-panel/build-v2-project-session';
import { BuildV2CloudAssetUploadService } from './build-v2-cloud-asset-upload.service';
import { BuildV2CloudProjectSaveService } from './build-v2-cloud-project-save.service';
import { DspService } from './dsp';
import type { BuildV2CloudAssetRecord } from './dsp';

describe('BuildV2CloudProjectSaveService', () => {
  const projectId = '20000000-0000-4000-8000-000000000002';
  const timestamp = '2026-11-13T20:00:00.000Z';
  let assetUpload: jasmine.SpyObj<BuildV2CloudAssetUploadService>;
  let dsp: jasmine.SpyObj<DspService>;
  let service: BuildV2CloudProjectSaveService;

  function snapshot(): BuildV2ProjectSaveSnapshot {
    const fileA = new File(['a'], 'a.wav', { type: 'audio/wav' });
    const fileB = new File(['b'], 'b.mp3', { type: 'audio/mpeg' });
    return {
      project: {
        kind: 'rqs-build-project',
        schemaVersion: 1,
        projectId,
        name: 'CLOUD SAVE',
        createdAt: timestamp,
        updatedAt: timestamp,
        assets: [
          {
            assetId: '30000000-0000-4000-8000-000000000003',
            originalFileName: 'a.wav',
            format: 'wav',
            sizeBytes: fileA.size,
            durationSeconds: 20,
          },
          {
            assetId: '30000000-0000-4000-8000-000000000004',
            originalFileName: 'b.mp3',
            format: 'mp3',
            sizeBytes: fileB.size,
            durationSeconds: 20,
          },
        ],
        tracks: [
          {
            trackId: 'track-a',
            assetId: '30000000-0000-4000-8000-000000000003',
            state: { trimStartSeconds: 0, trimEndSeconds: null, gainDb: 0, pan: 0 },
          },
          {
            trackId: 'track-b',
            assetId: '30000000-0000-4000-8000-000000000004',
            state: { trimStartSeconds: 0, trimEndSeconds: null, gainDb: 0, pan: 0 },
          },
        ],
        transitions: [{
          fromTrackId: 'track-a',
          toTrackId: 'track-b',
          durationSeconds: 4,
          curve: 'equal-power',
          usesDefault: true,
        }],
        transitionDefaults: { durationSeconds: 4, curve: 'equal-power' },
        finalFade: { enabled: false, durationSeconds: 8, curve: 'equal-power' },
        vignette: { enabled: false, assetId: null, mode: 'duck-overlay-v1' },
        render: {
          exportName: 'CLOUD_SAVE',
          loudnessMode: 'off',
          outputFormat: 'wav',
          sampleRate: 48_000,
          channels: 2,
        },
      },
      assets: [
        { assetId: '30000000-0000-4000-8000-000000000003', file: fileA },
        { assetId: '30000000-0000-4000-8000-000000000004', file: fileB },
      ],
    };
  }

  const response = {
    success: true as const,
    alreadySaved: false,
    project: {
      projectId,
      name: 'CLOUD SAVE',
      schemaVersion: 1,
      assetCount: 2,
      trackCount: 2,
      documentCreatedAt: timestamp,
      documentUpdatedAt: timestamp,
    },
  };

  function confirmedAsset(assetId: string): BuildV2CloudAssetRecord {
    return {
      projectId,
      assetId,
      originalFileName: 'fixture.wav',
      format: 'wav',
      contentType: 'audio/wav',
      sizeBytes: 1,
      etag: 'fixture-etag',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  beforeEach(() => {
    assetUpload = jasmine.createSpyObj<BuildV2CloudAssetUploadService>(
      'BuildV2CloudAssetUploadService',
      ['uploadBuildV2CloudAsset'],
    );
    dsp = jasmine.createSpyObj<DspService>('DspService', ['saveBuildV2CloudProject']);
    service = new BuildV2CloudProjectSaveService(assetUpload, dsp);
  });

  it('confirms every asset before saving project metadata exactly once', async () => {
    const order: string[] = [];
    assetUpload.uploadBuildV2CloudAsset.and.callFake((_project, assetId) => {
      order.push(`asset:${assetId}`);
      return of(confirmedAsset(assetId));
    });
    dsp.saveBuildV2CloudProject.and.callFake(project => {
      order.push(`project:${project.projectId}`);
      return of(response);
    });

    await expectAsync(firstValueFrom(service.saveBuildV2CloudProjectSnapshot(snapshot())))
      .toBeResolvedTo(response);
    expect(assetUpload.uploadBuildV2CloudAsset).toHaveBeenCalledTimes(2);
    expect(dsp.saveBuildV2CloudProject).toHaveBeenCalledTimes(1);
    expect(order.at(-1)).toBe(`project:${projectId}`);
  });

  it('never sends project metadata when an asset upload fails', async () => {
    assetUpload.uploadBuildV2CloudAsset.and.returnValue(
      throwError(() => new Error('UPLOAD_FAILED')),
    );

    await expectAsync(firstValueFrom(service.saveBuildV2CloudProjectSnapshot(snapshot())))
      .toBeRejectedWithError('UPLOAD_FAILED');
    expect(dsp.saveBuildV2CloudProject).not.toHaveBeenCalled();
  });

  it('continues to metadata save when every upload reports an already-confirmed asset', async () => {
    assetUpload.uploadBuildV2CloudAsset.and.callFake((_project, assetId) => (
      of(confirmedAsset(assetId))
    ));
    dsp.saveBuildV2CloudProject.and.returnValue(of({ ...response, alreadySaved: true }));

    const result = await firstValueFrom(service.saveBuildV2CloudProjectSnapshot(snapshot()));
    expect(result.alreadySaved).toBeTrue();
    expect(dsp.saveBuildV2CloudProject).toHaveBeenCalledTimes(1);
  });

  it('surfaces a create-only 409 from metadata persistence', async () => {
    assetUpload.uploadBuildV2CloudAsset.and.callFake((_project, assetId) => (
      of(confirmedAsset(assetId))
    ));
    dsp.saveBuildV2CloudProject.and.returnValue(
      throwError(() => new Error('BUILD_PROJECT_ALREADY_EXISTS')),
    );

    await expectAsync(firstValueFrom(service.saveBuildV2CloudProjectSnapshot(snapshot())))
      .toBeRejectedWithError('BUILD_PROJECT_ALREADY_EXISTS');
  });
});
