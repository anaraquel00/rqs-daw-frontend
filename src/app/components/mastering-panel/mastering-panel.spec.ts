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
  const isLoggedIn = signal(true);
  const canMaster = signal(true);
  let requestSignIn: jasmine.Spy;
  let clearCalls = 0;
  let stopResetCalls = 0;

  beforeEach(() => {
    clearCalls = 0;
    stopResetCalls = 0;
    canUseMaster.set(false);
    isLoggedIn.set(true);
    canMaster.set(true);
    requestSignIn = jasmine.createSpy('requestSignIn');
    currentLang.set('en');

    const previewStartSignal = signal(0);
    const previewEndSignal = signal(15);
    const previewStatusSignal = signal<'not-generated' | 'processing' | 'ready' | 'error'>('not-generated');
    const playbackModeSignal = signal<'full-track' | 'preview-15s'>('full-track');

    const audioComparisonStub = {
      previewStart: previewStartSignal,
      previewEnd: previewEndSignal,
      previewStatus: previewStatusSignal,
      playbackMode: playbackModeSignal,
      activeVariant: signal('original'),
      currentTime: signal(0),
      duration: signal(60),
      displayCurrentTime: signal(0),
      displayDuration: signal(15),
      canUseMaster,
      isPlaying: signal(false),
      setOriginalSrc: () => undefined,
      setMasterSrc: () => undefined,
      setPreviewStart: (start: number) => {
        previewStartSignal.set(start);
        previewEndSignal.set(start + 15);
      },
      clearMasterSrc: () => {
        clearCalls += 1;
        canUseMaster.set(false);
        previewStatusSignal.set('not-generated');
        playbackModeSignal.set('full-track');
      },
      resetAll: () => undefined,
      switchVariant: async () => undefined,
      stopAndReset: () => { stopResetCalls += 1; },
      seek: () => undefined,
      togglePlayback: async () => undefined,
    };

    TestBed.configureTestingModule({
      providers: [
        MasteringService,
        { provide: DspService, useValue: { getMasteringV2Capabilities: () => of(capabilities) } },
        { provide: AudioComparisonService, useValue: audioComparisonStub },
        {
          provide: LanguageService,
          useValue: {
            currentLang,
            tr: () => ({ MASTER_LABEL: 'B - MASTER PREVIEW' }),
          },
        },
        { provide: AuthService, useValue: { canMaster, isLoggedIn, requestSignIn } },
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
it('requires a current Preview before Full Master and locks redundant Preview rendering', () => {
  expect(panel.canGeneratePreview()).toBeTrue();
  expect(panel.canGenerateFullMaster()).toBeFalse();

  panel.audioComparison.previewStatus.set('ready');
  panel.audioComparison.playbackMode.set('preview-15s');
  canUseMaster.set(true);

  expect(panel.canGeneratePreview()).toBeFalse();
  expect(panel.canGenerateFullMaster()).toBeTrue();

  panel.isFullMaster = true;
  panel.audioComparison.playbackMode.set('full-track');
  expect(panel.canGeneratePreview()).toBeFalse();
  expect(panel.canGenerateFullMaster()).toBeFalse();
});

it('sends the selected source start with the Preview command', () => {
  let previewStartSeconds: number | undefined;
  panel.audioComparison.setPreviewStart(12.5);
  panel.processMaster.subscribe((command) => {
    previewStartSeconds = command.previewStartSeconds;
  });

  panel.dispararPreview();

  expect(previewStartSeconds).toBe(12.5);
});

  it('opens Auth UX and emits no protected Preview command for an anonymous user', () => {
    isLoggedIn.set(false);
    const processMaster = jasmine.createSpy('processMaster');
    panel.processMaster.subscribe(processMaster);

    panel.dispararPreview();

    expect(requestSignIn).toHaveBeenCalledOnceWith('mastering');
    expect(processMaster).not.toHaveBeenCalled();
    expect(panel.audioComparison.previewStatus()).toBe('not-generated');
  });

  it('opens Auth UX and emits no Full Master command for an anonymous user', () => {
    isLoggedIn.set(false);
    panel.audioComparison.previewStatus.set('ready');
    panel.audioComparison.playbackMode.set('preview-15s');
    canUseMaster.set(true);
    const processMaster = jasmine.createSpy('processMaster');
    panel.processMaster.subscribe(processMaster);

    panel.dispararProcessamentoCompleto();

    expect(requestSignIn).toHaveBeenCalledOnceWith('mastering');
    expect(processMaster).not.toHaveBeenCalled();
  });

  it('preserves authenticated Preview and Full Master commands', () => {
    const commands: boolean[] = [];
    panel.processMaster.subscribe((command) => commands.push(command.preview));

    panel.dispararPreview();
    panel.audioComparison.previewStatus.set('ready');
    panel.audioComparison.playbackMode.set('preview-15s');
    canUseMaster.set(true);
    panel.dispararProcessamentoCompleto();

    expect(commands).toEqual([true, false]);
    expect(requestSignIn).not.toHaveBeenCalled();
  });

  it('keeps Preview eligible but blocks Full Master for a logged Free user at 3/3', () => {
    canMaster.set(false);
    expect(panel.canGeneratePreview()).toBeTrue();

    panel.audioComparison.previewStatus.set('ready');
    panel.audioComparison.playbackMode.set('preview-15s');
    canUseMaster.set(true);
    expect(panel.canGenerateFullMaster()).toBeFalse();
  });

  it('preserves Premium Full Master eligibility', () => {
    canMaster.set(true);
    panel.audioComparison.previewStatus.set('ready');
    panel.audioComparison.playbackMode.set('preview-15s');
    canUseMaster.set(true);

    expect(panel.canGenerateFullMaster()).toBeTrue();
  });

  it('invalidates stale results and resets audition when the Preview range moves', () => {
    panel.audioComparison.previewStatus.set('ready');
    panel.audioComparison.playbackMode.set('preview-15s');
    canUseMaster.set(true);

    panel.onPreviewRangeStartChange(21.25);

    expect(panel.audioComparison.previewStart()).toBeCloseTo(21.25, 3);
    expect(masteringService.previewStartSeconds()).toBeCloseTo(21.25, 3);
    expect(clearCalls).toBe(1);
    expect(panel.configInvalidatedResult()).toBeTrue();
    expect(canUseMaster()).toBeFalse();
  });

  it('resets source-only audition to the newly selected range when no render exists', () => {
    panel.onPreviewRangeStartChange(9.5);

    expect(panel.audioComparison.previewStart()).toBeCloseTo(9.5, 3);
    expect(stopResetCalls).toBe(1);
    expect(clearCalls).toBe(0);
  });

  it('labels B as Full Master after final rendering', () => {
    expect(panel.masterVariantLabel()).toContain('MASTER PREVIEW');
    panel.isFullMaster = true;
    expect(panel.masterVariantLabel()).toBe('B - FULL MASTER');
  });

});
