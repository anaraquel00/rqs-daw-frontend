import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
  const isLoggedIn = signal(false);

  beforeEach(() => {
    isLoggedIn.set(false);
    requestSignIn = jasmine.createSpy('requestSignIn');
    dsp = jasmine.createSpyObj<DspService>('DspService', [
      'getMasteringV2PresignedUrl',
      'uploadToS3',
      'masterizeV2Preview',
      'masterizeV2Final',
    ]);

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
            previewStatus: signal('not-generated'),
            audioProcessed: signal(false),
            processedFilename: signal(''),
            resetAll: () => undefined,
            clearMasterSrc: () => undefined,
          },
        },
        { provide: AnalyticsService, useValue: { trackEvent: jasmine.createSpy('trackEvent') } },
      ],
    });

    component = TestBed.runInInjectionContext(() => new UploadZoneComponent());
    component.selectedFile = new File(['audio'], 'track.wav', { type: 'audio/wav' });
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
