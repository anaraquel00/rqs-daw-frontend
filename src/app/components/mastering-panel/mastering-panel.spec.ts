import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MasteringPanelComponent } from './mastering-panel';
import { AudioComparisonService } from '../../services/audio-comparison.service';
import { AuthService } from '../../services/auth.service';
import { DspService } from '../../services/dsp';
import { LanguageService } from '../../services/language.service';
import { MasteringService } from '../../services/mastering.service';
import { MasteringV2Capabilities } from '../../services/mastering-types';

const capabilities: MasteringV2Capabilities = {
  engine: 'rqs-core-mastering-v2',
  release: 'mastering-v2-v1',
  preview_seconds: 15,
  intensity: { min: 0, max: 100, step: 1, default: 50 },
  atmospheres: [
    { id: 'clear_sky', label: 'Clear Sky', subtitle: 'Transparent & Balanced' },
    { id: 'thunder', label: 'Thunder', subtitle: 'Punch & Low-End Impact' },
    { id: 'sunroof', label: 'Sunroof', subtitle: 'Bright & Open' },
    { id: 'aurora', label: 'Aurora', subtitle: 'Warm & Cinematic' },
  ],
  destinations: {
    streaming: {
      platform_required: true,
      platforms: {
        spotify: {
          standard: {
            target_lufs: -14,
            min_lufs: -14.5,
            max_lufs: -13.5,
            true_peak_ceiling_dbtp: -1.2,
            min_plr_lu: 9,
            min_lra_retention: 0.85,
            max_crest_loss_db: 1.5,
            policy_source: 'test',
          },
        },
        apple_music: {},
        youtube: {},
        soundcloud: {},
        generic: {},
      },
    },
    club: {
      platform_required: false,
      target: {
        target_lufs: -10.5,
        min_lufs: -11.5,
        max_lufs: -10,
        true_peak_ceiling_dbtp: -1,
        min_plr_lu: 8.5,
        min_lra_retention: 0.75,
        max_crest_loss_db: 2,
        policy_source: 'test',
      },
    },
    festival: {
      platform_required: false,
      target: {
        target_lufs: -9.5,
        min_lufs: -10.5,
        max_lufs: -9,
        true_peak_ceiling_dbtp: -1,
        min_plr_lu: 7.5,
        min_lra_retention: 0.65,
        max_crest_loss_db: 3,
        policy_source: 'test',
      },
    },
  },
};

describe('MasteringPanelComponent V2 request gate and guidance', () => {
  let panel: MasteringPanelComponent;
  let masteringService: MasteringService;
  const currentLang = signal<'en' | 'pt' | 'pl'>('en');
  const canUseMaster = signal(false);
  let clearCalls = 0;

  beforeEach(() => {
    clearCalls = 0;
    canUseMaster.set(false);
    currentLang.set('en');

    const audioComparisonStub = {
      previewStart: signal(0),
      previewEnd: signal(15),
      previewStatus: signal('not-generated'),
      playbackMode: signal('full-track'),
      activeVariant: signal('original'),
      displayCurrentTime: signal(0),
      displayDuration: signal(15),
      canUseMaster,
      isPlaying: signal(false),
      setOriginalSrc: () => undefined,
      setMasterSrc: () => undefined,
      clearMasterSrc: () => { clearCalls += 1; canUseMaster.set(false); },
      resetAll: () => undefined,
      switchVariant: async () => undefined,
      stopAndReset: () => undefined,
      seek: () => undefined,
      togglePlayback: async () => undefined,
    };

    TestBed.configureTestingModule({
      providers: [
        MasteringService,
        { provide: DspService, useValue: { getMasteringV2Capabilities: () => of(capabilities) } },
        { provide: AudioComparisonService, useValue: audioComparisonStub },
        { provide: LanguageService, useValue: { currentLang } },
        { provide: AuthService, useValue: {} },
      ],
    });

    masteringService = TestBed.inject(MasteringService);
    panel = TestBed.runInInjectionContext(() => new MasteringPanelComponent());
    panel.ngOnInit();
  });

  it('blocks an out-of-range requested LUFS before sending a render', () => {
    masteringService.setDestination('club');
    masteringService.setRequestedLufs(-9.5);

    expect(panel.requestedLufsError()).toContain('-11.5');
    expect(panel.requestedLufsError()).toContain('-10');
    expect(panel.requestReady()).toBeFalse();
    expect(panel.renderBlockReason()).toContain('-11.5');
  });

  it('explains LUFS in Polish without presenting louder as automatically better', () => {
    currentLang.set('pl');
    const help = panel.education().controls.lufs;

    expect(help.short).toContain('bliżej 0');
    expect(help.details).toContain('-1 LUFS');
    expect(help.details).toContain('nie jest „lepsze”');
  });

  it('allows the backend policy default and a valid custom club target', () => {
    masteringService.setDestination('club');
    expect(panel.requestedLufsError()).toBeNull();
    expect(panel.requestReady()).toBeTrue();

    masteringService.setRequestedLufs(-10.8);
    expect(panel.requestedLufsError()).toBeNull();
    expect(panel.requestReady()).toBeTrue();
  });

  it('invalidates a ready master after a configuration change and records a notice', () => {
    canUseMaster.set(true);
    masteringService.setIntensityPercent(50);

    panel.updateIntensity({ target: { value: '51' } } as unknown as Event);

    expect(clearCalls).toBe(1);
    expect(panel.configInvalidatedResult()).toBeTrue();
    expect(canUseMaster()).toBeFalse();
  });
});
