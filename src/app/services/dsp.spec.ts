import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DspService } from './dsp';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';

describe('DspService Mastering V2 transport', () => {
  let service: DspService;
  let http: HttpTestingController;

  const accessToken = 'test-user-access-token';
  const authStub = {
    session: () => ({ access_token: accessToken }),
  };

  beforeEach(() => {
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

  it('does not attach the Supabase bearer token to the signed S3 PUT', () => {
    const file = new File(['audio'], 'track.wav', { type: 'audio/wav' });
    service.uploadToS3('https://s3.example.test/signed-upload', file).subscribe();

    const request = http.expectOne('https://s3.example.test/signed-upload');
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.has('Authorization')).toBeFalse();
    expect(request.request.headers.get('Content-Type')).toBe('audio/wav');
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
});
