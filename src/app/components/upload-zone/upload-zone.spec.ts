import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject } from 'rxjs';
import { AnalyticsService } from '../../services/analytics.service';
import { AudioComparisonService } from '../../services/audio-comparison.service';
import { AuthService } from '../../services/auth.service';
import { DspService } from '../../services/dsp';
import { LanguageService } from '../../services/language.service';
import { MasteringService } from '../../services/mastering.service';
import { MasteringProcessCommand } from '../../services/mastering-types';
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
      'masterizeV2Preview',
      'masterizeV2Final',
    ]);
    analytics = jasmine.createSpyObj<AnalyticsService>('AnalyticsService', ['trackEvent']);

    TestBed.configureTestingModule({
      providers: [
        MasteringService,
        { provide: DspService, useValue: dsp },
        {
          provide: AuthService,
          useValue: {
            isLoggedIn,
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
