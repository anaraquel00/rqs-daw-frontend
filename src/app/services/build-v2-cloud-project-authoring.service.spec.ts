import { Subject, finalize, firstValueFrom, of, throwError } from 'rxjs';
import type { BuildV2ProjectDocumentV1 } from '../mix-panel/build-v2-project-schema';
import type { BuildV2ProjectSaveSnapshot } from '../mix-panel/build-v2-project-session';
import { BuildV2CloudAssetUploadService } from './build-v2-cloud-asset-upload.service';
import {
  BuildV2CloudAuthoringError,
  BuildV2CloudProjectAuthoringService,
} from './build-v2-cloud-project-authoring.service';
import {
  DspService,
  type BuildV2CloudAssetRecord,
  type BuildV2CloudQuotaResponse,
} from './dsp';

describe('BuildV2CloudProjectAuthoringService', () => {
  const projectId = '20000000-0000-4000-8000-000000000002';
  const timestamp = '2026-11-13T20:00:00.000Z';
  let assetUpload: jasmine.SpyObj<BuildV2CloudAssetUploadService>;
  let dsp: jasmine.SpyObj<DspService>;
  let service: BuildV2CloudProjectAuthoringService;

  const quota: BuildV2CloudQuotaResponse = {
    plan: 'pro',
    projects: { used: 1, limit: 100, remaining: 99, canCreate: true },
    storage: {
      confirmedBytes: 2,
      reservedBytes: 0,
      usedBytes: 2,
      limitBytes: 10_000,
      remainingBytes: 9_998,
      canReserve: true,
    },
  };

  function file(assetId: string, bytes = assetId.length): File {
    return new File(['x'.repeat(bytes)], `${assetId}.wav`, { type: 'audio/wav' });
  }

  function project(assetIds = ['asset-a', 'asset-b']): BuildV2ProjectDocumentV1 {
    return {
      kind: 'rqs-build-project',
      schemaVersion: 1,
      projectId,
      name: 'GATE 6',
      createdAt: timestamp,
      updatedAt: timestamp,
      assets: assetIds.map(assetId => ({
        assetId,
        originalFileName: `${assetId}.wav`,
        format: 'wav' as const,
        sizeBytes: file(assetId).size,
        durationSeconds: 20,
      })),
      tracks: assetIds.map((assetId, index) => ({
        trackId: `track-${index}`,
        assetId,
        state: { trimStartSeconds: 0, trimEndSeconds: null, gainDb: 0, pan: 0 },
      })),
      transitions: assetIds.slice(1).map((_assetId, index) => ({
        fromTrackId: `track-${index}`,
        toTrackId: `track-${index + 1}`,
        durationSeconds: 4,
        curve: 'equal-power' as const,
        usesDefault: true,
      })),
      transitionDefaults: { durationSeconds: 4, curve: 'equal-power' },
      finalFade: { enabled: false, durationSeconds: 8, curve: 'equal-power' },
      vignette: { enabled: false, assetId: null, mode: 'duck-overlay-v1' },
      render: {
        exportName: 'GATE_6',
        loudnessMode: 'off',
        outputFormat: 'wav',
        sampleRate: 48_000,
        channels: 2,
      },
    };
  }

  function snapshot(document = project()): BuildV2ProjectSaveSnapshot {
    return {
      project: document,
      assets: document.assets.map(asset => ({
        assetId: asset.assetId,
        file: file(asset.assetId),
      })),
    };
  }

  function withVignette(
    document: BuildV2ProjectDocumentV1,
    assetId: string | null,
  ): BuildV2ProjectDocumentV1 {
    const copy = structuredClone(document);
    copy.vignette = {
      enabled: assetId !== null,
      assetId,
      mode: 'duck-overlay-v1',
    };
    if (assetId && !copy.assets.some(asset => asset.assetId === assetId)) {
      copy.assets.push({
        assetId,
        originalFileName: `${assetId}.wav`,
        format: 'wav',
        sizeBytes: file(assetId).size,
        durationSeconds: 3,
      });
    }
    return copy;
  }

  function record(assetId: string): BuildV2CloudAssetRecord {
    return {
      projectId,
      assetId,
      originalFileName: `${assetId}.wav`,
      format: 'wav',
      contentType: 'audio/wav',
      sizeBytes: file(assetId).size,
      etag: 'etag',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  function saveResponse(revision = 1, updated = false) {
    return {
      success: true as const,
      alreadySaved: false,
      updated,
      project: {
        projectId,
        name: 'GATE 6',
        schemaVersion: 1,
        revision,
        assetCount: 2,
        trackCount: 2,
        documentCreatedAt: timestamp,
        documentUpdatedAt: timestamp,
      },
    };
  }

  beforeEach(() => {
    assetUpload = jasmine.createSpyObj<BuildV2CloudAssetUploadService>(
      'BuildV2CloudAssetUploadService',
      ['uploadBuildV2CloudAsset'],
    );
    dsp = jasmine.createSpyObj<DspService>('DspService', [
      'getBuildV2CloudQuota',
      'saveBuildV2CloudProject',
      'deleteBuildV2CloudProject',
    ]);
    service = new BuildV2CloudProjectAuthoringService(assetUpload, dsp);
    dsp.getBuildV2CloudQuota.and.returnValue(of(quota));
    assetUpload.uploadBuildV2CloudAsset.and.callFake((_projectId, assetId) => (
      of(record(assetId))
    ));
    dsp.saveBuildV2CloudProject.and.returnValue(of(saveResponse()));
  });

  it('creates only after quota and every new asset confirmation', async () => {
    const result = await firstValueFrom(service.save({
      snapshot: snapshot(),
      baseline: null,
      expectedRevision: null,
    }));

    expect(result.kind).toBe('saved');
    expect(result.uploadedAssetIds).toEqual(['asset-a', 'asset-b']);
    expect(dsp.getBuildV2CloudQuota).toHaveBeenCalledTimes(1);
    expect(assetUpload.uploadBuildV2CloudAsset).toHaveBeenCalledTimes(2);
    expect(dsp.saveBuildV2CloudProject).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ projectId }),
      undefined,
    );
  });

  it('returns an exact no-op without quota, upload, or metadata requests', async () => {
    const baseline = project();
    const result = await firstValueFrom(service.save({
      snapshot: snapshot(baseline),
      baseline,
      expectedRevision: 4,
    }));

    expect(result.kind).toBe('upToDate');
    expect(dsp.getBuildV2CloudQuota).not.toHaveBeenCalled();
    expect(assetUpload.uploadBuildV2CloudAsset).not.toHaveBeenCalled();
    expect(dsp.saveBuildV2CloudProject).not.toHaveBeenCalled();
  });

  it('uploads only the added asset and reports the removed asset on update', async () => {
    const baseline = project(['asset-a', 'asset-b']);
    const changed = project(['asset-a', 'asset-c']);
    changed.name = 'GATE 6 DELTA';
    dsp.saveBuildV2CloudProject.and.returnValue(of(saveResponse(5, true)));

    const result = await firstValueFrom(service.save({
      snapshot: snapshot(changed),
      baseline,
      expectedRevision: 4,
    }));

    expect(result.uploadedAssetIds).toEqual(['asset-c']);
    expect(result.removedAssetIds).toEqual(['asset-b']);
    expect(assetUpload.uploadBuildV2CloudAsset).toHaveBeenCalledOnceWith(
      projectId,
      'asset-c',
      jasmine.any(File),
    );
    expect(dsp.saveBuildV2CloudProject).toHaveBeenCalledWith(
      jasmine.objectContaining({ name: 'GATE 6 DELTA' }),
      4,
    );
    expect(result.project.tracks[1].trackId).toBe(baseline.tracks[1].trackId);
    expect(result.project.tracks[1].assetId).toBe('asset-c');
  });

  it('performs a metadata-only update with no asset upload and immutable createdAt', async () => {
    const baseline = project();
    const changed = structuredClone(baseline);
    changed.tracks[0].state.gainDb = -3;
    changed.tracks[0].state.pan = 0.25;
    changed.finalFade.enabled = true;
    dsp.saveBuildV2CloudProject.and.returnValue(of(saveResponse(3, true)));

    const result = await firstValueFrom(service.save({
      snapshot: snapshot(changed),
      baseline,
      expectedRevision: 2,
    }));

    expect(assetUpload.uploadBuildV2CloudAsset).not.toHaveBeenCalled();
    expect(dsp.saveBuildV2CloudProject).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ createdAt: baseline.createdAt }),
      2,
    );
    expect(result.project.createdAt).toBe(baseline.createdAt);
    expect(Date.parse(result.project.updatedAt)).toBeGreaterThan(
      Date.parse(baseline.updatedAt),
    );
  });

  for (const scenario of [
    {
      name: 'adds a vignette asset',
      baseline: () => project(['asset-a']),
      changed: () => withVignette(project(['asset-a']), 'vignette-new'),
      uploaded: ['vignette-new'],
      removed: [],
    },
    {
      name: 'replaces a vignette asset',
      baseline: () => withVignette(project(['asset-a']), 'vignette-old'),
      changed: () => withVignette(project(['asset-a']), 'vignette-new'),
      uploaded: ['vignette-new'],
      removed: ['vignette-old'],
    },
    {
      name: 'removes a vignette asset without uploading',
      baseline: () => withVignette(project(['asset-a']), 'vignette-old'),
      changed: () => project(['asset-a']),
      uploaded: [],
      removed: ['vignette-old'],
    },
  ]) {
    it(scenario.name, async () => {
      const result = await firstValueFrom(service.save({
        snapshot: snapshot(scenario.changed()),
        baseline: scenario.baseline(),
        expectedRevision: 2,
      }));

      expect(result.uploadedAssetIds).toEqual(scenario.uploaded);
      expect(result.removedAssetIds).toEqual(scenario.removed);
      expect(assetUpload.uploadBuildV2CloudAsset.calls.allArgs().map(args => args[1]))
        .toEqual(scenario.uploaded);
    });
  }

  it('makes updatedAt strictly monotonic for a dirty update', async () => {
    const baseline = project();
    baseline.updatedAt = '2099-01-01T00:00:00.000Z';
    const changed = project();
    changed.name = 'DIRTY';

    const result = await firstValueFrom(service.save({
      snapshot: snapshot(changed),
      baseline,
      expectedRevision: 1,
    }));

    expect(Date.parse(result.project.updatedAt)).toBeGreaterThan(
      Date.parse(baseline.updatedAt),
    );
  });

  it('rejects project quota before any upload', async () => {
    dsp.getBuildV2CloudQuota.and.returnValue(of({
      ...quota,
      projects: { used: 100, limit: 100, remaining: 0, canCreate: false },
    }));

    await expectAsync(firstValueFrom(service.save({
      snapshot: snapshot(),
      baseline: null,
      expectedRevision: null,
    }))).toBeRejectedWith(jasmine.objectContaining<BuildV2CloudAuthoringError>({
      code: 'BUILD_CLOUD_PROJECT_QUOTA_EXCEEDED',
    }));
    expect(assetUpload.uploadBuildV2CloudAsset).not.toHaveBeenCalled();
    expect(dsp.saveBuildV2CloudProject).not.toHaveBeenCalled();
  });

  it('rejects storage quota using only new bytes and never uploads', async () => {
    const baseline = project(['asset-a']);
    const changed = project(['asset-a', 'asset-b']);
    dsp.getBuildV2CloudQuota.and.returnValue(of({
      ...quota,
      storage: { ...quota.storage, remainingBytes: 1 },
    }));

    await expectAsync(firstValueFrom(service.save({
      snapshot: snapshot(changed),
      baseline,
      expectedRevision: 1,
    }))).toBeRejectedWith(jasmine.objectContaining<BuildV2CloudAuthoringError>({
      code: 'BUILD_CLOUD_STORAGE_QUOTA_EXCEEDED',
    }));
    expect(assetUpload.uploadBuildV2CloudAsset).not.toHaveBeenCalled();
  });

  it('caps new asset uploads at three concurrent requests', async () => {
    const document = project(['asset-a', 'asset-b', 'asset-c', 'asset-d']);
    const pending: Subject<BuildV2CloudAssetRecord>[] = [];
    let active = 0;
    let maximum = 0;
    assetUpload.uploadBuildV2CloudAsset.and.callFake((_projectId, assetId) => {
      const subject = new Subject<BuildV2CloudAssetRecord>();
      pending.push(subject);
      active += 1;
      maximum = Math.max(maximum, active);
      return subject.asObservable().pipe(finalize(() => { active -= 1; }));
    });

    const resultPromise = firstValueFrom(service.save({
      snapshot: snapshot(document),
      baseline: null,
      expectedRevision: null,
    }));
    await Promise.resolve();
    expect(pending.length).toBe(3);
    pending[0].next(record('asset-a'));
    pending[0].complete();
    await Promise.resolve();
    expect(pending.length).toBe(4);
    for (const [index, subject] of pending.slice(1).entries()) {
      subject.next(record(document.assets[index + 1].assetId));
      subject.complete();
    }
    await resultPromise;
    expect(maximum).toBe(3);
  });

  it('never sends metadata when an asset upload fails', async () => {
    assetUpload.uploadBuildV2CloudAsset.and.returnValue(
      throwError(() => new Error('UPLOAD_FAILED')),
    );

    await expectAsync(firstValueFrom(service.save({
      snapshot: snapshot(),
      baseline: null,
      expectedRevision: null,
    }))).toBeRejectedWithError('UPLOAD_FAILED');
    expect(dsp.saveBuildV2CloudProject).not.toHaveBeenCalled();
  });

  it('forwards delete with the exact selected revision', async () => {
    const response = {
      success: true as const,
      alreadyDeleted: false,
      projectId,
      finalRevision: 8,
      cleanupComplete: true,
      deletedAssets: 2,
      pendingAssets: 0,
    };
    dsp.deleteBuildV2CloudProject.and.returnValue(of(response));

    await expectAsync(firstValueFrom(service.delete(projectId, 7)))
      .toBeResolvedTo(response);
    expect(dsp.deleteBuildV2CloudProject).toHaveBeenCalledOnceWith(projectId, 7);
  });
});
