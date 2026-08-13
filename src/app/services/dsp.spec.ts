import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DspService } from './dsp';
import { environment } from '../../environments/environment';

describe('DspService Mastering V2 transport', () => {
  let service: DspService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DspService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads capabilities from the V2 endpoint', () => {
    service.getMasteringV2Capabilities().subscribe();

    const request = http.expectOne(`${environment.baseUrl}/mastering/v2/capabilities`);
    expect(request.request.method).toBe('GET');
    request.flush({});
  });

  it('sends preview as blob request to the V2 process endpoint', () => {
    const formData = new FormData();
    formData.append('destination', 'streaming');

    service.masterizeV2Preview(formData).subscribe();

    const request = http.expectOne(`${environment.baseUrl}/mastering/v2/process`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBe(formData);
    expect(request.request.responseType).toBe('blob');
    request.flush(new Blob([], { type: 'audio/wav' }));
  });

  it('sends final render to the V2 process endpoint and expects JSON', () => {
    const formData = new FormData();
    formData.append('destination', 'festival');

    service.masterizeV2Final(formData).subscribe();

    const request = http.expectOne(`${environment.baseUrl}/mastering/v2/process`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toBe(formData);
    expect(request.request.responseType).toBe('json');
    request.flush({
      success: true,
      engine: 'mastering-v2-v1',
      downloadUrl: 'http://localhost:8080/mastering/v2/local-download/example',
      fileName: 'RQS_MASTER_V2_CLEAR_SKY_example.wav',
    });
  });
});
