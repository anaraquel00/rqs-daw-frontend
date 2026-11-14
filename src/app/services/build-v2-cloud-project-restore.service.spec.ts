import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable, of, Subject, throwError } from 'rxjs';
import type { BuildV2ProjectDocumentV1 } from '../mix-panel/build-v2-project-schema';
import {
  BuildV2CloudProjectRestoreError,
  BuildV2CloudProjectRestoreService,
} from './build-v2-cloud-project-restore.service';
import type {
  BuildV2CloudRestoreManifest,
} from './dsp';
import { DspService } from './dsp';

describe('BuildV2CloudProjectRestoreService', () => {
  let service: BuildV2CloudProjectRestoreService;
  let dsp: jasmine.SpyObj<DspService>;

  beforeEach(() => {
    dsp = jasmine.createSpyObj<DspService>('DspService', [
      'getBuildV2CloudRestoreManifest',
      'downloadBuildV2CloudAsset',
    ]);
    TestBed.configureTestingModule({
      providers: [
        BuildV2CloudProjectRestoreService,
        { provide: DspService, useValue: dsp },
      ],
    });
    service = TestBed.inject(BuildV2CloudProjectRestoreService);
  });

  it('reconstructs exact WAV/MP3 Files and preserves asset IDs and revision', async () => {
    const manifest = restoreManifest(2);
    dsp.getBuildV2CloudRestoreManifest.and.returnValue(of(manifest));
    dsp.downloadBuildV2CloudAsset.and.callFake(url => {
      const asset = manifest.assets.find(candidate => candidate.downloadUrl === url)!;
      return of(new Blob(['x'.repeat(asset.sizeBytes)], { type: asset.contentType }));
    });

    const bundle = await firstValueFrom(
      service.restoreBuildV2CloudProject(manifest.project.projectId),
    );

    expect(bundle.revision).toBe(7);
    expect([...bundle.files.keys()]).toEqual(manifest.project.assets.map(asset => asset.assetId));
    for (const asset of manifest.project.assets) {
      const file = bundle.files.get(asset.assetId)!;
      expect(file.name).toBe(asset.originalFileName);
      expect(file.size).toBe(asset.sizeBytes);
      expect(file.type).toBe(asset.format === 'wav' ? 'audio/wav' : 'audio/mpeg');
    }
  });

  it('accepts an empty browser Blob type when size is exact', async () => {
    const manifest = restoreManifest(1);
    dsp.getBuildV2CloudRestoreManifest.and.returnValue(of(manifest));
    dsp.downloadBuildV2CloudAsset.and.returnValue(
      of(new Blob(['x'.repeat(manifest.assets[0].sizeBytes)])),
    );
    await expectAsync(firstValueFrom(
      service.restoreBuildV2CloudProject(manifest.project.projectId),
    )).toBeResolved();
  });

  for (const variant of [
    'missing',
    'extra',
    'duplicate',
    'filename',
    'format',
    'size',
    'contentType',
  ] as const) {
    it(`rejects ${variant} manifest asset drift before downloading`, async () => {
      const manifest = restoreManifest(2);
      if (variant === 'missing') manifest.assets.pop();
      if (variant === 'extra') manifest.assets.push({ ...manifest.assets[0], assetId: 'asset-extra' });
      if (variant === 'duplicate') manifest.assets[1] = { ...manifest.assets[0] };
      if (variant === 'filename') manifest.assets[0].originalFileName = 'different.wav';
      if (variant === 'format') manifest.assets[0].format = 'mp3';
      if (variant === 'size') manifest.assets[0].sizeBytes += 1;
      if (variant === 'contentType') manifest.assets[0].contentType = 'audio/mpeg';
      dsp.getBuildV2CloudRestoreManifest.and.returnValue(of(manifest));

      await expectAsync(firstValueFrom(
        service.restoreBuildV2CloudProject(manifest.project.projectId),
      )).toBeRejectedWithError(BuildV2CloudProjectRestoreError);
      expect(dsp.downloadBuildV2CloudAsset).not.toHaveBeenCalled();
    });
  }

  it('rejects downloaded size and non-empty Content-Type mismatches', async () => {
    const manifest = restoreManifest(1);
    dsp.getBuildV2CloudRestoreManifest.and.returnValue(of(manifest));
    dsp.downloadBuildV2CloudAsset.and.returnValues(
      of(new Blob(['short'], { type: manifest.assets[0].contentType })),
      of(new Blob(['x'.repeat(manifest.assets[0].sizeBytes)], { type: 'audio/mpeg' })),
    );

    await expectAsync(firstValueFrom(
      service.restoreBuildV2CloudProject(manifest.project.projectId),
    )).toBeRejectedWithError(BuildV2CloudProjectRestoreError);
    await expectAsync(firstValueFrom(
      service.restoreBuildV2CloudProject(manifest.project.projectId),
    )).toBeRejectedWithError(BuildV2CloudProjectRestoreError);
  });

  it('never exceeds three concurrent downloads', async () => {
    const manifest = restoreManifest(7);
    const pending: Array<{ subject: Subject<Blob>; assetIndex: number }> = [];
    let active = 0;
    let maxActive = 0;
    dsp.getBuildV2CloudRestoreManifest.and.returnValue(of(manifest));
    dsp.downloadBuildV2CloudAsset.and.callFake(url => new Observable<Blob>(subscriber => {
      const subject = new Subject<Blob>();
      pending.push({
        subject,
        assetIndex: manifest.assets.findIndex(asset => asset.downloadUrl === url),
      });
      active += 1;
      maxActive = Math.max(maxActive, active);
      const subscription = subject.subscribe(subscriber);
      return () => {
        active -= 1;
        subscription.unsubscribe();
      };
    }));

    const restore = firstValueFrom(
      service.restoreBuildV2CloudProject(manifest.project.projectId),
    );
    await Promise.resolve();
    expect(pending.length).toBe(3);
    let completed = 0;
    while (completed < manifest.assets.length) {
      const record = pending[completed];
      expect(record).toBeDefined();
      const asset = manifest.assets[record.assetIndex];
      record.subject.next(new Blob(['x'.repeat(asset.sizeBytes)], { type: asset.contentType }));
      record.subject.complete();
      completed += 1;
      await Promise.resolve();
    }
    await restore;
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('refreshes the complete manifest once after an S3 403 and does not loop', async () => {
    const manifest = restoreManifest(1);
    dsp.getBuildV2CloudRestoreManifest.and.returnValue(of(manifest));
    dsp.downloadBuildV2CloudAsset.and.returnValues(
      throwError(() => new HttpErrorResponse({ status: 403 })),
      of(new Blob(['x'.repeat(manifest.assets[0].sizeBytes)], { type: 'audio/wav' })),
    );
    await expectAsync(firstValueFrom(
      service.restoreBuildV2CloudProject(manifest.project.projectId),
    )).toBeResolved();
    expect(dsp.getBuildV2CloudRestoreManifest).toHaveBeenCalledTimes(2);
  });
});

function restoreManifest(assetCount: number): BuildV2CloudRestoreManifest {
  const assets = Array.from({ length: assetCount }, (_, index) => {
    const format = index % 2 === 0 ? 'wav' as const : 'mp3' as const;
    return {
      assetId: `asset-${index + 1}`,
      originalFileName: `track-${index + 1}.${format}`,
      format,
      sizeBytes: index + 11,
      durationSeconds: 30,
    };
  });
  const tracks = assets.map((asset, index) => ({
    trackId: `track-${index + 1}`,
    assetId: asset.assetId,
    state: { trimStartSeconds: 0, trimEndSeconds: null, gainDb: 0, pan: 0 },
  }));
  const project: BuildV2ProjectDocumentV1 = {
    kind: 'rqs-build-project',
    schemaVersion: 1,
    projectId: '20000000-0000-4000-8000-000000000001',
    name: 'CLOUD RESTORE',
    createdAt: '2026-11-14T00:00:00.000Z',
    updatedAt: '2026-11-14T01:00:00.000Z',
    assets,
    tracks,
    transitions: tracks.slice(0, -1).map((track, index) => ({
      fromTrackId: track.trackId,
      toTrackId: tracks[index + 1].trackId,
      durationSeconds: 4,
      curve: 'equal-power',
      usesDefault: true,
    })),
    transitionDefaults: { durationSeconds: 4, curve: 'equal-power' },
    finalFade: { enabled: true, durationSeconds: 6, curve: 'linear' },
    vignette: { enabled: false, assetId: null, mode: 'duck-overlay-v1' },
    render: {
      exportName: 'CLOUD_RESTORE',
      loudnessMode: 'off',
      outputFormat: 'wav',
      sampleRate: 48_000,
      channels: 2,
    },
  };
  return {
    project,
    revision: 7,
    totalBytes: assets.reduce((sum, asset) => sum + asset.sizeBytes, 0),
    assets: assets.map(asset => ({
      assetId: asset.assetId,
      originalFileName: asset.originalFileName,
      format: asset.format,
      contentType: asset.format === 'wav' ? 'audio/wav' : 'audio/mpeg',
      sizeBytes: asset.sizeBytes,
      downloadUrl: `https://s3.example.test/${asset.assetId}`,
      expiresInSeconds: 900,
    })),
  };
}
