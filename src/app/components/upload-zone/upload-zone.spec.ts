import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { AnalyticsService } from '../../services/analytics.service';
import { AudioComparisonService } from '../../services/audio-comparison.service';
import { AuthService } from '../../services/auth.service';
import { DspService } from '../../services/dsp';
import { LanguageService } from '../../services/language.service';
import { MasteringService } from '../../services/mastering.service';
import { AudioDnaPayload, MasteringAnalysisResponse, MasteringProcessCommand, MasteringV2Analysis } from '../../services/mastering-types';
import { UploadZoneComponent } from './upload-zone';

describe('UploadZoneComponent protected Mastering V2 guard', () => {
  let component: UploadZoneComponent;
  let requestSignIn: jasmine.Spy;
  let dsp: jasmine.SpyObj<DspService>;
  let resetAll: jasmine.Spy;
  let clearMasterSrc: jasmine.Spy;
  let analytics: jasmine.SpyObj<AnalyticsService>;
  const previewStatus = signal<'not-generated' | 'processing' | 'ready' | 'error'>('not-generated');
  const audioProcessed = signal(false);
  const processedFilename = signal('');
  const isLoggedIn = signal(false);
  const userId = signal('owner-a');
  const analysis: MasteringV2Analysis = {
    integrated_lufs: -14.2,
    true_peak_dbtp: -1.3,
    rms_dbfs: -18.4,
    crest_factor_db: 8.1,
    loudness_range_lu: 5.2,
    duration_seconds: 185,
  };
  const audioDna: AudioDnaPayload = {
    version: 'rqs-audio-dna-v1.2', status: 'available', source_sha256: 'a'.repeat(64),
    technical: {
      lufs_integrated: -14.2, true_peak_dbtp: -1.3, lra_lu: 5.2, rms_dbfs: -18.4,
      crest_factor_db: 8.1, duration_seconds: 185, brightness: 0.3, warmth: 0.5,
      transient_strength: 0.4, stereo_width: 0.5, low_end_density: 0.7,
      harshness: 0.2, dynamic_density: 0.4, overall_energy: 0.6,
    },
    music: {
      status: 'partial', method: 'deterministic_music_features_v1_2',
      bpm: { value: 63, confidence: 0.62, alternatives: [{ value: 126, confidence: 0.62, relation: 'double_time' }], ambiguous: true, method: 'test' },
      key: { value: null, confidence: 0, status: 'experimental' }, genres: [], genre_status: 'inconclusive', moods: [], mood_status: 'inconclusive',
      instruments: [], instrument_status: 'inconclusive', vocal: { status: 'inconclusive', presence: null, processed: null, method: 'held_back' },
      energy: 0.6, energy_label: 'moderate', energy_status: 'technical_composite',
      danceability: 0.5, danceability_label: 'moderate', danceability_status: 'experimental',
      semantic: {
        status: 'unavailable', method: 'semantic_classifier_not_configured_v1_2', model: null,
        genres: [], moods: [], instruments: [],
        vocal: {
          status: 'unavailable', presence: null, type: null, processed: null, confidence: null,
          method: 'semantic_classifier_not_configured_v1_2',
        },
      },
    },
    master_profile: {
      atmosphere: 'aurora', character_intensity: 26, confidence: 0.57, confidence_level: 'medium', auto_configure: true,
      input_domain: 'technical_audio_dna_only', reasons: [], atmosphere_dsp_behavior: 'profile_label_only_v2_compatibility_path',
    },
    release_assistant: null,
  };

  beforeEach(() => {
    isLoggedIn.set(false);
    requestSignIn = jasmine.createSpy('requestSignIn');
    resetAll = jasmine.createSpy('resetAll');
    clearMasterSrc = jasmine.createSpy('clearMasterSrc');
    previewStatus.set('not-generated');
    audioProcessed.set(false);
    processedFilename.set('');
    dsp = jasmine.createSpyObj<DspService>('DspService', [
      'getMasteringV2PresignedUrl',
      'uploadToS3',
      'analyzeMasteringV2',
      'masterizeV2Preview',
      'masterizeV2Final',
    ]);
    dsp.analyzeMasteringV2.and.returnValue(of(analysis));
    analytics = jasmine.createSpyObj<AnalyticsService>('AnalyticsService', ['trackEvent']);

    TestBed.configureTestingModule({
      providers: [
        MasteringService,
        { provide: DspService, useValue: dsp },
        {
          provide: AuthService,
          useValue: {
            isLoggedIn,
            session: () => isLoggedIn() ? { user: { id: userId() } } : null,
            requestSignIn,
            canMaster: signal(true),
            refreshProfile: jasmine.createSpy('refreshProfile'),
          },
        },
        { provide: LanguageService, useValue: { t: () => ({ LIMIT_EXCEEDED_ALERT: 'limit' }), currentLang: () => 'en' } },
        {
          provide: AudioComparisonService,
          useValue: {
            previewStatus,
            audioProcessed,
            processedFilename,
            resetAll,
            clearMasterSrc,
          },
        },
        { provide: AnalyticsService, useValue: analytics },
      ],
    });

    component = TestBed.runInInjectionContext(() => new UploadZoneComponent());
    TestBed.tick();
    component.selectedFile = new File(['audio'], 'track.wav', { type: 'audio/wav' });
  });

  it('analyzes one authenticated source exactly once without a second upload', () => {
    isLoggedIn.set(true);
    TestBed.tick();

    expect(dsp.analyzeMasteringV2).toHaveBeenCalledTimes(1);
    const body = dsp.analyzeMasteringV2.calls.mostRecent().args[0];
    expect((body.get('audio') as File).name).toBe(component.selectedFile!.name);
    expect(body.get('source_generation')).toBe('source-0');
    expect(body.has('s3Key')).toBeFalse();
    expect(component.analysisState()).toBe('success');
    expect(component.analysisMetrics()).toEqual(analysis);

    TestBed.tick();
    expect(dsp.analyzeMasteringV2).toHaveBeenCalledTimes(1);
  });

  it('initializes the Audio DNA master profile from the current source analysis once', () => {
    const response: MasteringAnalysisResponse = { ...analysis, audio_dna: audioDna, cache: { hit: false } };
    dsp.analyzeMasteringV2.and.returnValue(of(response));
    const file = new File(['audio-dna'], 'audio-dna.wav', { type: 'audio/wav' });
    (component as unknown as { acceptSelectedFile(file: File): void }).acceptSelectedFile(file);
    isLoggedIn.set(true);
    TestBed.tick();

    const mastering = TestBed.inject(MasteringService);
    expect(component.audioDna).toBe(audioDna);
    expect(mastering.atmosphere()).toBe('aurora');
    expect(mastering.intensityPercent()).toBe(26);
    expect(mastering.masterProfileSource()).toBe('AUDIO_DNA');
  });

  it('rejects semantic evidence whose backend generation does not match the active source', () => {
    const stale = structuredClone(audioDna);
    stale.source_generation = 'source-stale';
    stale.analyzer_generation = 'source-stale';
    stale.semantic = {
      version: 'rqs-semantic-audio-dna-v1',
      status: 'READY',
      source_generation: 'source-stale',
      analyzer_generation: 'source-stale',
      engine: {
        name: 'cocotagger',
        model: 'musiccocoa',
        revision: 'pinned-revision',
        taxonomy_version: 'pinned-taxonomy',
      },
      categories: {
        genre: [{ tag: 'electronic', raw_score: 0.34, rank: 1 }],
      },
    };
    dsp.analyzeMasteringV2.and.returnValue(of({
      ...analysis,
      source_generation: 'source-stale',
      analyzer_generation: 'source-stale',
      audio_dna: stale,
    }));

    isLoggedIn.set(true);
    TestBed.tick();

    expect(component.analysisState()).toBe('error');
    expect(component.analysisMetrics()).toBeNull();
    expect(component.audioDna).toBeNull();
    expect(dsp.masterizeV2Preview).not.toHaveBeenCalled();
    expect(dsp.masterizeV2Final).not.toHaveBeenCalled();
  });

  it('shows loading and ignores a stale analysis after source replacement', () => {
    const first = new Subject<MasteringV2Analysis>();
    dsp.analyzeMasteringV2.and.returnValues(first, of({ ...analysis, duration_seconds: 42 }));
    isLoggedIn.set(true);
    TestBed.tick();
    expect(component.analysisState()).toBe('loading');

    const replacement = new File(['replacement'], 'replacement.wav', { type: 'audio/wav' });
    (component as unknown as { acceptSelectedFile(file: File): void }).acceptSelectedFile(replacement);
    expect(component.analysisState()).toBe('success');
    expect(component.analysisMetrics()?.duration_seconds).toBe(42);

    first.next({ ...analysis, duration_seconds: 999 });
    first.complete();
    expect(component.analysisMetrics()?.duration_seconds).toBe(42);
    expect(dsp.analyzeMasteringV2).toHaveBeenCalledTimes(2);
  });

  it('maps analysis failure without invoking Preview or Full Master', () => {
    dsp.analyzeMasteringV2.and.returnValue(new Subject<MasteringV2Analysis>());
    isLoggedIn.set(true);
    TestBed.tick();
    const request = dsp.analyzeMasteringV2.calls.mostRecent().returnValue as Subject<MasteringV2Analysis>;
    request.error({ status: 503 });

    expect(component.analysisState()).toBe('error');
    expect(component.analysisMetrics()).toBeNull();
    expect(dsp.masterizeV2Preview).not.toHaveBeenCalled();
    expect(dsp.masterizeV2Final).not.toHaveBeenCalled();
  });

  it('clears analysis on logout and user switch', () => {
    isLoggedIn.set(true);
    TestBed.tick();
    expect(component.analysisState()).toBe('success');

    userId.set('owner-b');
    TestBed.tick();
    expect(component.selectedFile).toBeNull();
    expect(component.analysisState()).toBe('empty');
    expect(component.analysisMetrics()).toBeNull();

    component.selectedFile = new File(['audio'], 'again.wav', { type: 'audio/wav' });
    isLoggedIn.set(false);
    TestBed.tick();
    expect(component.selectedFile).toBeNull();
    expect(component.analysisMetrics()).toBeNull();
  });

  it('does not consume quota, emit mastering analytics, or modify the DSP request', () => {
    const mastering = TestBed.inject(MasteringService);
    const before = mastering.getRequest();
    const auth = TestBed.inject(AuthService) as unknown as { canMaster: jasmine.Spy; refreshProfile: jasmine.Spy };
    const canMaster = jasmine.createSpy('canMaster').and.returnValue(true);
    (auth as unknown as { canMaster: () => boolean }).canMaster = canMaster;
    isLoggedIn.set(true);
    TestBed.tick();

    expect(canMaster).not.toHaveBeenCalled();
    expect(auth.refreshProfile).not.toHaveBeenCalled();
    expect(analytics.trackEvent).not.toHaveBeenCalled();
    expect(mastering.getRequest()).toEqual(before);
    expect(dsp.masterizeV2Preview).not.toHaveBeenCalled();
    expect(dsp.masterizeV2Final).not.toHaveBeenCalled();
  });

  it('preserves a local selection while the initial auth state remains anonymous', () => {
    TestBed.tick();

    expect(component.selectedFile?.name).toBe('track.wav');
  });

  it('preserves a local selection across the login transition', () => {
    isLoggedIn.set(true);
    TestBed.tick();

    expect(component.selectedFile?.name).toBe('track.wav');
  });

  it('clears the complete local workspace on the logout transition', () => {
    isLoggedIn.set(true);
    TestBed.tick();
    component.s3Key = 'staging/key.wav';
    component.processedAudioUrl = 'https://staging.invalid/result.wav';
    component.processedAudioName = 'result.wav';
    component.isFullMasterCompleted = true;
    component.isProcessing = true;
    component.isUploadingS3 = true;
    component.systemLogs = ['previous session'];
    audioProcessed.set(true);
    processedFilename.set('result.wav');

    isLoggedIn.set(false);
    TestBed.tick();

    expect(component.selectedFile).toBeNull();
    expect(component.s3Key).toBeNull();
    expect(component.processedAudioUrl).toBeNull();
    expect(component.processedAudioName).toBe('');
    expect(component.isFullMasterCompleted).toBeFalse();
    expect(component.isProcessing).toBeFalse();
    expect(component.isUploadingS3).toBeFalse();
    expect(component.systemLogs).toEqual([]);
    expect(resetAll).toHaveBeenCalled();
    expect(audioProcessed()).toBeFalse();
    expect(processedFilename()).toBe('');
  });

  it('keeps repeated anonymous state and cleanup idempotent', () => {
    component.ejetarFaixa();
    component.ejetarFaixa();
    isLoggedIn.set(false);
    TestBed.tick();

    expect(component.selectedFile).toBeNull();
    expect(component.s3Key).toBeNull();
  });

  it('does not restore an S3 key when an upload callback returns after logout', () => {
    const uploadResult = new Subject<void>();
    dsp.getMasteringV2PresignedUrl.and.returnValue(of({
      uploadUrl: 'https://staging.invalid/upload',
      s3Key: 'staging/key.wav',
    }));
    dsp.uploadToS3.and.returnValue(uploadResult);
    isLoggedIn.set(true);
    TestBed.tick();

    component.iniciarUploadS3Silencioso(component.selectedFile!);
    expect(component.isUploadingS3).toBeTrue();

    isLoggedIn.set(false);
    TestBed.tick();
    uploadResult.next();
    uploadResult.complete();

    expect(component.s3Key).toBeNull();
    expect(component.isUploadingS3).toBeFalse();
    expect(component.systemLogs).toEqual([]);
  });

  it('does not restore Preview state when a mastering callback returns after logout', () => {
    const previewResult = new Subject<Blob>();
    dsp.masterizeV2Preview.and.returnValue(previewResult);
    isLoggedIn.set(true);
    TestBed.tick();

    component.processarMaster(command(true));
    isLoggedIn.set(false);
    TestBed.tick();
    previewResult.next(new Blob(['preview'], { type: 'audio/wav' }));
    previewResult.complete();

    expect(component.processedAudioUrl).toBeNull();
    expect(component.processedAudioName).toBe('');
    expect(component.isProcessing).toBeFalse();
    expect(previewStatus()).toBe('not-generated');
  });

  it('restores the protected-request guard after logout', () => {
    isLoggedIn.set(true);
    TestBed.tick();
    isLoggedIn.set(false);
    TestBed.tick();
    component.selectedFile = new File(['new audio'], 'new-track.wav', { type: 'audio/wav' });

    component.processarMaster(command(true));
    component.processarMaster(command(false));

    expect(requestSignIn).toHaveBeenCalledTimes(2);
    expect(dsp.getMasteringV2PresignedUrl).not.toHaveBeenCalled();
    expect(dsp.uploadToS3).not.toHaveBeenCalled();
    expect(dsp.masterizeV2Preview).not.toHaveBeenCalled();
    expect(dsp.masterizeV2Final).not.toHaveBeenCalled();
  });

  it('does not request a protected presigned upload before authentication', () => {
    component.iniciarUploadS3Silencioso(component.selectedFile!);

    expect(requestSignIn).toHaveBeenCalledOnceWith('mastering');
    expect(dsp.getMasteringV2PresignedUrl).not.toHaveBeenCalled();
    expect(dsp.uploadToS3).not.toHaveBeenCalled();
  });

  it('does not emit a protected Preview request before authentication', () => {
    component.processarMaster(command(true));

    expect(requestSignIn).toHaveBeenCalledOnceWith('mastering');
    expect(dsp.masterizeV2Preview).not.toHaveBeenCalled();
    expect(dsp.masterizeV2Final).not.toHaveBeenCalled();
  });

  it('does not emit a protected Full Master request before authentication', () => {
    component.processarMaster(command(false));

    expect(requestSignIn).toHaveBeenCalledOnceWith('mastering');
    expect(dsp.masterizeV2Preview).not.toHaveBeenCalled();
    expect(dsp.masterizeV2Final).not.toHaveBeenCalled();
  });

  it('does not report Preview as a Full Master analytics execution', () => {
    dsp.masterizeV2Preview.and.returnValue(of(new Blob(['preview'], { type: 'audio/wav' })));
    isLoggedIn.set(true);
    TestBed.tick();
    component.s3Key = 'staging/source.wav';

    component.processarMaster(command(true));

    expect(analytics.trackEvent).not.toHaveBeenCalledWith('master_started', jasmine.anything());
    expect(analytics.trackEvent).not.toHaveBeenCalledWith('master_completed', jasmine.anything());
  });

  it('reports master_started and master_completed once for one successful Full Master', () => {
    dsp.masterizeV2Final.and.returnValue(of({
      success: true,
      engine: 'rqs-core-mastering-v2',
      downloadUrl: 'https://staging.invalid/master.wav',
      fileName: 'master.wav',
    }));
    isLoggedIn.set(true);
    TestBed.tick();
    component.s3Key = 'staging/source.wav';

    component.processarMaster(command(false));

    expect(analytics.trackEvent.calls.allArgs().filter(([name]) => name === 'master_started').length).toBe(1);
    expect(analytics.trackEvent.calls.allArgs().filter(([name]) => name === 'master_completed').length).toBe(1);
    expect(analytics.trackEvent).toHaveBeenCalledWith('master_started', {
      source_format: 'wav',
      processing_mode: 'full',
    });
    expect(analytics.trackEvent).toHaveBeenCalledWith('master_completed', {
      source_format: 'wav',
      processing_mode: 'full',
    });
  });

  function command(preview: boolean): MasteringProcessCommand {
    return {
      preview,
      request: {
        destination: 'streaming',
        platform: 'spotify',
        atmosphere: 'clear_sky',
        intensityPercent: 50,
        requestedLufs: null,
        soundcloudMode: 'standard',
      },
    };
  }
});
