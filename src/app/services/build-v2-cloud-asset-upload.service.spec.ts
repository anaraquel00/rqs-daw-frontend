import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { BuildV2CloudAssetUploadService } from './build-v2-cloud-asset-upload.service';
import { environment } from '../../environments/environment';

describe('BuildV2CloudAssetUploadService', () => {
  const projectId = '20000000-0000-4000-8000-000000000002';
  const assetId = '30000000-0000-4000-8000-000000000003';
  const token = 'build-v2-user-token';
  let service: BuildV2CloudAssetUploadService;
  let http: HttpTestingController;

  const record = {
    projectId,
    assetId,
    originalFileName: 'track.wav',
    format: 'wav' as const,
    contentType: 'audio/wav' as const,
    sizeBytes: 4,
    etag: 'etag',
    createdAt: '2026-11-13T20:00:00.000Z',
    updatedAt: '2026-11-13T20:00:00.000Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { session: () => ({ access_token: token }) } },
      ],
    });
    service = TestBed.inject(BuildV2CloudAssetUploadService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('returns an already-confirmed asset without PUT or confirm', async () => {
    const file = new File(['data'], 'track.wav', { type: 'audio/wav' });
    const resultPromise = firstValueFrom(
      service.uploadBuildV2CloudAsset(projectId, assetId, file),
    );

    const presign = http.expectOne(
      `${environment.baseUrl}/build/v2/projects/${projectId}/assets/presign`,
    );
    expect(presign.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    presign.flush({ alreadyConfirmed: true, asset: record });

    await expectAsync(resultPromise).toBeResolvedTo(record);
    http.expectNone('https://s3.example.test/signed-upload');
    http.expectNone(
      `${environment.baseUrl}/build/v2/projects/${projectId}/assets/${assetId}/confirm`,
    );
  });

  for (const scenario of [
    { fileName: 'track.wav', fileType: 'audio/wav', format: 'wav', contentType: 'audio/wav' },
    { fileName: 'track.mp3', fileType: 'audio/mpeg', format: 'mp3', contentType: 'audio/mpeg' },
  ] as const) {
    it(`uploads and confirms ${scenario.format.toUpperCase()} with the required Content-Type`, async () => {
      const file = new File(['data'], scenario.fileName, { type: scenario.fileType });
      const scenarioRecord = {
        ...record,
        originalFileName: scenario.fileName,
        format: scenario.format,
        contentType: scenario.contentType,
      };
      const resultPromise = firstValueFrom(
        service.uploadBuildV2CloudAsset(projectId, assetId, file),
      );

      const presign = http.expectOne(
        `${environment.baseUrl}/build/v2/projects/${projectId}/assets/presign`,
      );
      expect(presign.request.body).toEqual({
        assetId,
        originalFileName: scenario.fileName,
        format: scenario.format,
        sizeBytes: 4,
      });
      expect(presign.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
      presign.flush({
        alreadyConfirmed: false,
        uploadUrl: 'https://s3.example.test/signed-upload',
        objectKey: `uploads/user/build/project/asset.${scenario.format}`,
        expiresInSeconds: 900,
        requiredHeaders: { 'Content-Type': scenario.contentType },
      });

      const put = http.expectOne('https://s3.example.test/signed-upload');
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toBe(file);
      expect(put.request.headers.get('Content-Type')).toBe(scenario.contentType);
      expect(put.request.headers.has('Authorization')).toBeFalse();
      put.flush(null);

      const confirm = http.expectOne(
        `${environment.baseUrl}/build/v2/projects/${projectId}/assets/${assetId}/confirm`,
      );
      expect(confirm.request.body).toEqual({
        originalFileName: scenario.fileName,
        format: scenario.format,
        sizeBytes: 4,
      });
      expect(confirm.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
      confirm.flush({ asset: scenarioRecord });

      await expectAsync(resultPromise).toBeResolvedTo(scenarioRecord);
    });
  }

  it('does not confirm when the signed PUT fails', async () => {
    const file = new File(['data'], 'track.wav', { type: 'audio/wav' });
    const resultPromise = firstValueFrom(
      service.uploadBuildV2CloudAsset(projectId, assetId, file),
    );
    http.expectOne(
      `${environment.baseUrl}/build/v2/projects/${projectId}/assets/presign`,
    ).flush({
      alreadyConfirmed: false,
      uploadUrl: 'https://s3.example.test/signed-upload',
      objectKey: 'uploads/user/build/project/asset.wav',
      expiresInSeconds: 900,
      requiredHeaders: { 'Content-Type': 'audio/wav' },
    });
    http.expectOne('https://s3.example.test/signed-upload').flush(
      { error: 'upload failed' },
      { status: 503, statusText: 'Unavailable' },
    );

    await expectAsync(resultPromise).toBeRejected();
    http.expectNone(
      `${environment.baseUrl}/build/v2/projects/${projectId}/assets/${assetId}/confirm`,
    );
  });

  it('fails the operation when confirm fails', async () => {
    const file = new File(['data'], 'track.wav', { type: 'audio/wav' });
    const resultPromise = firstValueFrom(
      service.uploadBuildV2CloudAsset(projectId, assetId, file),
    );
    http.expectOne(
      `${environment.baseUrl}/build/v2/projects/${projectId}/assets/presign`,
    ).flush({
      alreadyConfirmed: false,
      uploadUrl: 'https://s3.example.test/signed-upload',
      objectKey: 'uploads/user/build/project/asset.wav',
      expiresInSeconds: 900,
      requiredHeaders: { 'Content-Type': 'audio/wav' },
    });
    http.expectOne('https://s3.example.test/signed-upload').flush(null);
    http.expectOne(
      `${environment.baseUrl}/build/v2/projects/${projectId}/assets/${assetId}/confirm`,
    ).flush(
      { code: 'BUILD_ASSET_STORAGE_FAILED' },
      { status: 502, statusText: 'Bad Gateway' },
    );

    await expectAsync(resultPromise).toBeRejected();
  });
});
