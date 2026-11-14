import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DspService } from './dsp';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { SpotifyPitchRequest } from './mastering-types';

describe('DspService Mastering V2 transport', () => {
  let service: DspService;
  let http: HttpTestingController;

  const accessToken = 'test-user-access-token';
  let currentSession: { access_token: string } | null;
  const authStub = {
    session: () => currentSession,
  };

  beforeEach(() => {
    currentSession = { access_token: accessToken };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authStub },
      ],
    });
    service = TestBed.inject(DspService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads capabilities publicly from the V2 endpoint', () => {
    service.getMasteringV2Capabilities().subscribe();

    const request = http.expectOne(`${environment.baseUrl}/mastering/v2/capabilities`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({});
  });

  it('sends preview with the authenticated bearer token', () => {
    const formData = new FormData();
    formData.append('destination', 'streaming');

    service.masterizeV2Preview(formData).subscribe();

    const request = http.expectOne(`${environment.baseUrl}/mastering/v2/process`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBe(formData);
    expect(request.request.responseType).toBe('blob');
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    request.flush(new Blob([], { type: 'audio/wav' }));
  });

  it('sends final render with the authenticated bearer token', () => {
    const formData = new FormData();
    formData.append('destination', 'festival');

    service.masterizeV2Final(formData).subscribe();

    const request = http.expectOne(`${environment.baseUrl}/mastering/v2/process`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBe(formData);
    expect(request.request.responseType).toBe('json');
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    request.flush({
      success: true,
      engine: 'mastering-v2-v1',
      downloadUrl: 'http://localhost:8080/mastering/v2/local-download/example',
      fileName: 'RQS_MASTER_V2_CLEAR_SKY_example.wav',
    });
  });

  it('requests existing audio measurements without invoking the render contract', () => {
    const formData = new FormData();
    formData.append('s3Key', 'uploads/user-id/track.wav');

    service.analyzeMasteringV2(formData, '00000000-0000-4000-8000-000000000010').subscribe(result => {
      expect(result.duration_seconds).toBe(5);
    });

    const request = http.expectOne(`${environment.baseUrl}/mastering/v2/analysis`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBe(formData);
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    expect(request.request.headers.get('Idempotency-Key')).toBe('00000000-0000-4000-8000-000000000010');
    request.flush({
      integrated_lufs: -14.2,
      true_peak_dbtp: -1.1,
      rms_dbfs: -12.04,
      crest_factor_db: 6.02,
      loudness_range_lu: 4.3,
      duration_seconds: 5,
    });
  });

  it('rehydrates an owner-scoped persisted analysis without invoking analysis', () => {
    const analysisId = '00000000-0000-4000-8000-000000000011';
    service.getMasteringV2Analysis(analysisId).subscribe(result => {
      expect(result.analysis_id).toBe(analysisId);
      expect(result.flow_stage).toBe('artist_confirmation');
    });

    const request = http.expectOne(`${environment.baseUrl}/mastering/v2/analyses/${analysisId}`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    request.flush({ analysis_id: analysisId, status: 'READY', flow_stage: 'artist_confirmation' });
    http.expectNone(`${environment.baseUrl}/mastering/v2/analysis`);
  });

  it('persists Artist Confirmation explicitly as draft or confirmed state', () => {
    const analysisId = '00000000-0000-4000-8000-000000000012';
    const body = {
      mode: 'confirm' as const,
      artist_confirmed_sound: {
        genre_family: ['electronic'], subgenres: ['melodic trance'], moods: ['uplifting'],
        instruments: ['synthesizer'], vocals: [], production_elements: ['arpeggiated synths'],
      },
    };
    service.saveArtistConfirmation(analysisId, body).subscribe();
    const request = http.expectOne(
      `${environment.baseUrl}/mastering/v2/analyses/${analysisId}/artist-confirmation`,
    );
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(body);
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    request.flush({ analysis_id: analysisId, status: 'READY', flow_stage: 'artist_confirmed' });
  });

  it('requests a typed delivery AUTO proposal without invoking a render contract', () => {
    const body = {
      source_generation: 'source-7',
      analyzer_generation: 'source-7',
      metrics: {
        integrated_lufs: -14.2,
        true_peak_dbtp: -1.3,
        rms_dbfs: -18,
        crest_factor_db: 8,
        loudness_range_lu: 5,
        duration_seconds: 180,
      },
      context: {
        destination: 'streaming' as const,
        platform: 'spotify' as const,
        soundcloudMode: 'standard' as const,
        atmosphere: 'clear_sky' as const,
        intensityPercent: 50,
        requestedLufs: null,
      },
      expected_policy_version: 'mastering-v2-v1:delivery-auto-v1',
    };

    service.recommendMasteringV2Auto(body).subscribe(result => {
      expect(result.status).toBe('NO_CHANGE_RECOMMENDED');
    });

    const request = http.expectOne(`${environment.baseUrl}/mastering/v2/auto/recommend`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBe(body);
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    request.flush({ status: 'NO_CHANGE_RECOMMENDED' });
    http.expectNone(`${environment.baseUrl}/mastering/v2/process`);
  });

  it('loads the authenticated authoritative AI Spotify Pitch quota', () => {
    service.getSpotifyPitchQuota().subscribe(result => {
      expect(result.spotify_pitch.remaining).toBe(2);
    });

    const request = http.expectOne(`${environment.baseUrl}/mastering/v2/spotify-pitch/quota`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    request.flush({
      plan: 'free',
      spotify_pitch: {
        used: 1, limit: 3, remaining: 2, period: 'lifetime', period_key: 'lifetime',
        can_generate: true, active_reservations: 0,
      },
    });
  });

  it('sends the server-authenticated pitch request with an idempotency key', () => {
    const payload = { release_intelligence: {} } as unknown as SpotifyPitchRequest;
    service.generateSpotifyPitch(payload, '00000000-0000-4000-8000-000000000001').subscribe();

    const request = http.expectOne(`${environment.baseUrl}/mastering/v2/spotify-pitch`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBe(payload);
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    expect(request.request.headers.get('Idempotency-Key')).toBe('00000000-0000-4000-8000-000000000001');
    request.flush({ status: 'UNAVAILABLE' });
  });

  it('requests a user-owned V2 presigned URL with authentication', () => {
    service.getMasteringV2PresignedUrl('track.wav').subscribe();

    const request = http.expectOne(
      req => req.url === `${environment.baseUrl}/mastering/v2/presigned-url`
        && req.params.get('filename') === 'track.wav',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    request.flush({
      uploadUrl: 'https://s3.example.test/signed-upload',
      s3Key: 'uploads/user-id/track.wav',
    });
  });

  it('requests a temporary authenticated playback URL for an owned Mastering V2 source', () => {
    service
      .getMasteringV2SourcePlaybackUrl('uploads/user-id/track.wav')
      .subscribe();

    const request = http.expectOne(
      `${environment.baseUrl}/mastering/v2/source-playback-url`,
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      s3Key: 'uploads/user-id/track.wav',
    });
    expect(
      request.request.headers.get('Authorization'),
    ).toBe(`Bearer ${accessToken}`);

    request.flush({
      playbackUrl: 'https://s3.example.test/signed-playback',
      expiresInSeconds: 3600,
    });
  });

  it('does not attach the Supabase bearer token to the signed S3 PUT', () => {
    const file = new File(['audio'], 'track.wav', { type: 'audio/wav' });
    service.uploadToS3('https://s3.example.test/signed-upload', file).subscribe();

    const request = http.expectOne('https://s3.example.test/signed-upload');
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.has('Authorization')).toBeFalse();
    expect(request.request.headers.get('Content-Type')).toBe('audio/wav');
    request.flush(null);
  });

  it('sends the BUILD V2 presign contract with the authenticated bearer token', () => {
    const projectId = '20000000-0000-4000-8000-000000000002';
    const assetId = '30000000-0000-4000-8000-000000000003';
    const body = {
      assetId,
      originalFileName: 'track.wav',
      format: 'wav' as const,
      sizeBytes: 1024,
    };
    service.presignBuildV2Asset(projectId, body).subscribe();

    const request = http.expectOne(
      `${environment.baseUrl}/build/v2/projects/${projectId}/assets/presign`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    request.flush({
      alreadyConfirmed: false,
      uploadUrl: 'https://s3.example.test/build-upload',
      objectKey: 'uploads/user/build/project/asset.wav',
      expiresInSeconds: 900,
      requiredHeaders: { 'Content-Type': 'audio/wav' },
    });
  });

  it('sends the BUILD V2 confirm contract with the authenticated bearer token', () => {
    const projectId = '20000000-0000-4000-8000-000000000002';
    const assetId = '30000000-0000-4000-8000-000000000003';
    const body = {
      originalFileName: 'track.mp3',
      format: 'mp3' as const,
      sizeBytes: 2048,
    };
    service.confirmBuildV2Asset(projectId, assetId, body).subscribe();

    const request = http.expectOne(
      `${environment.baseUrl}/build/v2/projects/${projectId}/assets/${assetId}/confirm`,
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    request.flush({ asset: {} });
  });

  it('sends the raw canonical BUILD V2 project with PUT and bearer authentication', () => {
    const projectId = '20000000-0000-4000-8000-000000000002';
    const project = {
      kind: 'rqs-build-project' as const,
      schemaVersion: 1 as const,
      projectId,
      name: 'CLOUD PROJECT',
      createdAt: '2026-11-13T20:00:00.000Z',
      updatedAt: '2026-11-13T20:00:00.000Z',
      assets: [],
      tracks: [],
      transitions: [],
      transitionDefaults: { durationSeconds: 8, curve: 'equal-power' as const },
      finalFade: { enabled: false, durationSeconds: 8, curve: 'equal-power' as const },
      vignette: { enabled: false, assetId: null, mode: 'duck-overlay-v1' as const },
      render: {
        exportName: 'CLOUD_PROJECT',
        loudnessMode: 'off' as const,
        outputFormat: 'wav' as const,
        sampleRate: 48_000 as const,
        channels: 2 as const,
      },
    };

    service.saveBuildV2CloudProject(project).subscribe(response => {
      expect(response.alreadySaved).toBeFalse();
    });

    const request = http.expectOne(`${environment.baseUrl}/build/v2/projects/${projectId}`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toBe(project);
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    expect(request.request.headers.has('If-Match')).toBeFalse();
    request.flush({
      success: true,
      alreadySaved: false,
      updated: false,
      project: {
        projectId,
        name: project.name,
        schemaVersion: 1,
        revision: 1,
        assetCount: 0,
        trackCount: 0,
        documentCreatedAt: project.createdAt,
        documentUpdatedAt: project.updatedAt,
      },
    });
  });

  it('sends a quoted strong If-Match revision for BUILD V2 project updates', () => {
    const projectId = '20000000-0000-4000-8000-000000000002';
    const project = {
      kind: 'rqs-build-project' as const,
      schemaVersion: 1 as const,
      projectId,
      name: 'REVISIONED PROJECT',
      createdAt: '2026-11-13T20:00:00.000Z',
      updatedAt: '2026-11-13T21:00:00.000Z',
      assets: [],
      tracks: [],
      transitions: [],
      transitionDefaults: { durationSeconds: 8, curve: 'equal-power' as const },
      finalFade: { enabled: false, durationSeconds: 8, curve: 'equal-power' as const },
      vignette: { enabled: false, assetId: null, mode: 'duck-overlay-v1' as const },
      render: {
        exportName: 'REVISIONED_PROJECT',
        loudnessMode: 'off' as const,
        outputFormat: 'wav' as const,
        sampleRate: 48_000 as const,
        channels: 2 as const,
      },
    };

    service.saveBuildV2CloudProject(project, 7).subscribe();

    const request = http.expectOne(`${environment.baseUrl}/build/v2/projects/${projectId}`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('If-Match')).toBe('"7"');
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    request.flush({
      success: true,
      alreadySaved: false,
      updated: true,
      project: {
        projectId,
        name: project.name,
        schemaVersion: 1,
        revision: 8,
        assetCount: 0,
        trackCount: 0,
        documentCreatedAt: project.createdAt,
        documentUpdatedAt: project.updatedAt,
      },
    });
  });

  it('deletes a BUILD V2 project with bearer authentication and If-Match', () => {
    const projectId = '20000000-0000-4000-8000-000000000002';
    service.deleteBuildV2CloudProject(projectId, 8).subscribe(response => {
      expect(response.cleanupComplete).toBeTrue();
    });

    const request = http.expectOne(`${environment.baseUrl}/build/v2/projects/${projectId}`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.get('If-Match')).toBe('"8"');
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    request.flush({
      success: true,
      alreadyDeleted: false,
      projectId,
      finalRevision: 9,
      cleanupComplete: true,
      deletedAssets: 2,
      pendingAssets: 0,
    });
  });

  it('uses the exact server-required Content-Type without adding JWT to BUILD S3 PUT', () => {
    const file = new File(['audio'], 'ambiguous.wav', { type: 'application/octet-stream' });
    service.uploadToS3(
      'https://s3.example.test/build-upload',
      file,
      'audio/mpeg',
    ).subscribe();

    const request = http.expectOne('https://s3.example.test/build-upload');
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush(null);
  });
  it('requests a user-owned Setlist upload URL with authentication', () => {
    service.getSetlistPresignedUrl('set-track.wav').subscribe();

    const request = http.expectOne(
      req => req.url === `${environment.baseUrl}/mix/presigned-url`
        && req.params.get('filename') === 'set-track.wav',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    request.flush({
      uploadUrl: 'https://s3.example.test/setlist-upload',
      s3Key: 'uploads/user-id/setlist/set-track.wav',
    });
  });

  it('sends only the explicit Setlist Stage 1 render contract with authentication', () => {
    const payload = {
      tracks: ['uploads/user-id/setlist/track-01.wav', 'uploads/user-id/setlist/track-02.wav'],
      vignette: null,
      crossfades: [8],
      curve: 'equal-power' as const,
      loudness: 'off' as const,
      exportName: 'RQS_TEST_SETLIST',
      outputFormat: 'wav' as const,
    };

    service.generateMixS3(payload).subscribe();

    const request = http.expectOne(`${environment.baseUrl}/mix/generate-s3`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    request.flush({
      success: true,
      downloadUrl: 'https://s3.example.test/setlist-download',
      fileName: 'RQS_TEST_SETLIST.wav',
      output: {
        format: 'wav',
        codec: 'pcm_s24le',
        sampleRate: 48000,
        channels: 2,
        durationSeconds: 120,
      },
    });
  });

  it('sends a local Stems split with the authenticated bearer token', () => {
    const file = new File(['audio'], 'track.wav', { type: 'audio/wav' });
    service.extractStems(file).subscribe();

    const request = http.expectOne(`${environment.baseUrl}/stems/split`);
    expect(request.request.method).toBe('POST');
    expect(request.request.responseType).toBe('blob');
    expect(request.request.body).toBeInstanceOf(FormData);
    expect((request.request.body as FormData).get('audio')).toBe(file);
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    request.flush(new Blob([], { type: 'application/zip' }));
  });

  it('preserves ordered per-transition curves alongside the legacy Setlist curve', () => {
    const payload = {
      tracks: ['uploads/user-id/setlist/a.wav', 'uploads/user-id/setlist/b.wav', 'uploads/user-id/setlist/c.wav'],
      vignette: null,
      crossfades: [8, 3],
      curves: ['equal-power', 'fast-cut'] as ('equal-power' | 'fast-cut')[],
      curve: 'equal-power' as const,
      loudness: 'off' as const,
      exportName: 'RQS_R2',
      outputFormat: 'wav' as const,
    };
    service.generateMixS3(payload).subscribe();
    const request = http.expectOne(`${environment.baseUrl}/mix/generate-s3`);
    expect(request.request.body).toEqual(payload);
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    request.flush({ success: true });
  });

  it('sends a user-owned S3 Stems split with the authenticated bearer token', () => {
    service.extractStemsS3('uploads/user-id/track.wav').subscribe();

    const request = http.expectOne(`${environment.baseUrl}/stems/split-s3`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ s3Key: 'uploads/user-id/track.wav' });
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${accessToken}`);
    request.flush({
      success: true,
      downloadUrl: 'https://s3.example.test/signed-download',
    });
  });

  it('does not fabricate a bearer token for Stems without a session', () => {
    currentSession = null;
    const file = new File(['audio'], 'track.wav', { type: 'audio/wav' });

    service.extractStems(file).subscribe();
    service.extractStemsS3('uploads/user-id/track.wav').subscribe();

    const uploadRequest = http.expectOne(`${environment.baseUrl}/stems/split`);
    const s3Request = http.expectOne(`${environment.baseUrl}/stems/split-s3`);
    expect(uploadRequest.request.headers.has('Authorization')).toBeFalse();
    expect(s3Request.request.headers.has('Authorization')).toBeFalse();
    uploadRequest.flush(new Blob([], { type: 'application/zip' }));
    s3Request.flush({
      success: true,
      downloadUrl: 'https://s3.example.test/signed-download',
    });
  });
});
