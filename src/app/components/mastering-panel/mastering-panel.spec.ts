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
import { AudioDnaPayload } from '../../services/mastering-types';

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

const audioDna: AudioDnaPayload = {
  version: 'rqs-audio-dna-v1.1',
  status: 'available',
  source_sha256: 'a'.repeat(64),
  technical: {
    lufs_integrated: -14.87,
    true_peak_dbtp: -3.07,
    lra_lu: 4.7,
    rms_dbfs: -16.52,
    crest_factor_db: 13.45,
    duration_seconds: 285,
    analysis_seconds: 36,
    brightness: 0.2332,
    warmth: 0.5511,
    spectral_balance: 0.4991,
    transient_strength: 0.4124,
    stereo_width: 0.5617,
    low_end_density: 0.7958,
    harshness: 0.1778,
    dynamic_density: 0.0552,
    overall_energy: 0.5618,
    spectral_calibration: {
      brightness: {
        spectral_centroid_hz: 505.363087,
        centroid_nyquist_ratio: 0.045838,
        spectral_rolloff_85_hz: 742.895508,
        rolloff_nyquist_ratio: 0.067383,
        high_band_ratio: 0.046766,
        high_band_energy: 0.000601,
        total_energy: 0.012841,
        high_band_db: -13.300664,
        centroid_component: 0.073309,
        rolloff_component: 0.068808,
        high_band_component: 0.719073,
        brightness_raw: 0.233175,
        normalized: 0.233175,
      },
      low_end: {
        sub_band_ratio: 0.357068,
        bass_band_ratio: 0.276184,
        broadband_ratio: 0.633252,
        low_band_energy: 0.008131,
        total_energy: 0.012841,
        normalized: 0.795771,
      },
      warmth_band_ratio: 0.303757,
      harsh_band_ratio: 0.031603,
      spectral_tilt_db: -13.0181,
    },
  },
  music: {
    status: 'experimental',
    method: 'global_signal_heuristics_held_back_v1_1',
    bpm: {
      value: 63,
      confidence: 0.62,
      alternatives: [
        { value: 126, confidence: 0.62, relation: 'double_time' },
        { value: 42, confidence: 0.59, relation: 'competing_periodicity' },
      ],
      ambiguous: true,
      method: 'onset_autocorrelation_candidates_v1_1',
    },
    key: { value: 'D# minor', confidence: 0.33, status: 'experimental' },
    genres: [],
    genre_status: 'inconclusive',
    moods: [],
    mood_status: 'inconclusive',
    instruments: [],
    instrument_status: 'inconclusive',
    vocal: {
      status: 'inconclusive',
      presence: null,
      processed: null,
      method: 'unavailable_without_trained_vocal_classifier',
    },
    energy: 0.56,
    energy_status: 'technical_composite',
    danceability: 0.63,
    danceability_status: 'experimental',
  },
  master_profile: {
    atmosphere: 'aurora',
    character_intensity: 26,
    confidence: 0.57,
    confidence_level: 'medium',
    auto_configure: true,
    input_domain: 'technical_audio_dna_only',
    reasons: [
      { code: 'MODERATE_ENERGY', weight: 0.89 },
      { code: 'SPACIOUS_IMAGE', weight: 0.56 },
      { code: 'WARM_SPECTRAL_BALANCE', weight: 0.55 },
    ],
    atmosphere_dsp_behavior: 'profile_label_only_v2_compatibility_path',
  },
  release_assistant: {
    status: 'experimental',
    auto_populate: false,
    review_required: true,
    primary_genre: null,
    secondary_genres: [],
    moods: [],
    instruments: [],
    bpm: 63,
    bpm_ambiguous: true,
    key: 'D# minor',
    vocal_or_instrumental: 'inconclusive',
    energy: 0.56,
    danceability: 0.63,
    disclaimer: 'experimental_review_manually_not_for_automatic_publication',
  },
};

describe('MasteringPanelComponent V2 request gate and guidance', () => {
  let panel: MasteringPanelComponent;
  let masteringService: MasteringService;
  const currentLang = signal<'en' | 'pt' | 'pl' | 'fr'>('en');
  const canUseMaster = signal(false);
  let clearCalls = 0;
  let stopResetCalls = 0;

  beforeEach(() => {
    clearCalls = 0;
    stopResetCalls = 0;
    canUseMaster.set(false);
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
            tr: () => ({
              MASTER_LABEL: 'B - MASTER PREVIEW',
              FULL_MASTER_COMPLETED_ALERT: 'FULL MASTER',
              ORIGINAL_LABEL: 'A - ORIGINAL',
              MASTER_LIMIT_REACHED: 'Limit reached',
              PRO_WAITLIST_NOTE: 'Waitlist',
              PRO_WAITLIST_JOINING: 'Joining',
              PRO_WAITLIST_CTA: 'Join',
              PRO_WAITLIST_SUCCESS: 'Joined',
              PRO_WAITLIST_ERROR: 'Error',
              AB_PREVIEW_GENERATING: 'Generating',
              BTN_GENERATE_PREVIEW: 'Preview',
            }),
            t: () => ({
              AUTH_REQUIRED_TITLE: 'Sign in',
              AUTH_REQUIRED_BODY: 'Sign in body',
              AUTH_REQUIRED_SECONDARY: 'Sign in secondary',
              AUTH_CONTINUE_EMAIL: 'Continue',
              FREE_USAGE_LABEL: 'Free usage',
              PRO_USAGE_LABEL: 'Pro usage',
              PROCESSING_ACUSTICO: 'Processing',
              MASTER_FULL: 'Full master',
            }),
          },
        },
        {
          provide: AuthService,
          useValue: {
            canMaster: signal(true),
            isLoggedIn: signal(true),
            remainingMasters: signal(3),
            isPremium: signal(false),
            requestSignIn: () => undefined,
          },
        },
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

  it('does not change the selected delivery when resetting to the Audio DNA recommendation', () => {
    const recommendation = {
      atmosphere: 'aurora' as const,
      character_intensity: 28,
      confidence: 0.82,
      confidence_level: 'high' as const,
      auto_configure: true,
      input_domain: 'technical_audio_dna_only' as const,
      reasons: [{ code: 'WARM_SPECTRAL_BALANCE', weight: 0.82 }],
      atmosphere_dsp_behavior: 'profile_label_only_v2_compatibility_path' as const,
    };
    masteringService.beginAudioSource('source-a');
    masteringService.initializeFromAudioDna('source-a', recommendation);
    masteringService.setDestination('club');
    masteringService.setIntensityPercent(42);

    panel.resetToAudioDna();

    expect(masteringService.destination()).toBe('club');
    expect(masteringService.atmosphere()).toBe('aurora');
    expect(masteringService.intensityPercent()).toBe(28);
  });

  it('renders the Audio DNA loading and unavailable states', () => {
    const fixture = TestBed.createComponent(MasteringPanelComponent);
    fixture.componentRef.setInput('originalFile', new File([], 'source.wav'));
    fixture.componentRef.setInput('audioDnaLoading', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Analyzing technical characteristics');

    currentLang.set('pt');
    fixture.componentRef.setInput('audioDnaLoading', false);
    fixture.componentRef.setInput('audioDnaUnavailable', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Audio DNA indisponível');
    expect(fixture.nativeElement.textContent).toContain('A análise técnica e a masterização continuam disponíveis');
    fixture.destroy();
  });

  it('renders the detected Audio DNA and the suggested master profile', () => {
    masteringService.beginAudioSource('render-source');
    const fixture = TestBed.createComponent(MasteringPanelComponent);
    fixture.componentRef.setInput('originalFile', new File([], 'source.wav'));
    fixture.componentRef.setInput('audioSourceId', 'render-source');
    fixture.componentRef.setInput('audioDna', audioDna);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('RQS AUDIO DNA');
    expect(text).toContain('TECHNICAL AUDIO DNA');
    expect(text).toContain('Warm / dark-leaning');
    expect(text).toContain('Strong');
    expect(text).toContain('Spacious');
    expect(text).toContain('Preserved');
    expect(text).toContain('Healthy');
    expect(text).toContain('MASTER PROFILE SUGGESTED');
    expect(text).toContain('Aurora');
    expect(text).toContain('26%');
    expect(text).toContain('Medium');
    expect(text).toContain('Possible double-time: 126 BPM');
    expect(text).toContain('D# minor');
    expect(text).toContain('Experimental / low confidence');
    expect(text).toContain('The experimental semantic analysis does not yet have enough evidence');
    expect(text).toContain('RELEASE ASSISTANT — EXPERIMENTAL');
    expect(text).not.toContain('Primary genre');
    const masterProfile = fixture.nativeElement.querySelector('.master-profile-card') as HTMLElement;
    const qualitativeSummary = fixture.nativeElement.querySelector('.dna-signal-grid') as HTMLElement;
    expect(masterProfile.compareDocumentPosition(qualitativeSummary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(masteringService.atmosphere()).toBe('aurora');
    expect(masteringService.intensityPercent()).toBe(26);
    expect((fixture.nativeElement.querySelector('.advanced-audio-details') as HTMLDetailsElement).open).toBeFalse();
    fixture.destroy();
  });

  it('shows a subtle manual override after the artist changes Character without an Apply action', () => {
    masteringService.beginAudioSource('manual-source');
    const fixture = TestBed.createComponent(MasteringPanelComponent);
    fixture.componentRef.setInput('originalFile', new File([], 'source.wav'));
    fixture.componentRef.setInput('audioSourceId', 'manual-source');
    fixture.componentRef.setInput('audioDna', audioDna);
    fixture.detectChanges();

    expect(masteringService.masterProfileSource()).toBe('AUDIO_DNA');
    fixture.componentInstance.updateIntensity({ target: { value: '40' } } as unknown as Event);
    fixture.detectChanges();

    expect(masteringService.intensityPercent()).toBe(40);
    expect(masteringService.masterProfileSource()).toBe('MANUAL');
    expect(fixture.nativeElement.textContent).toContain('Manual override');
    const buttonText = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .map((button) => (button as HTMLButtonElement).textContent ?? '')
      .join(' ');
    expect(buttonText).not.toContain('Apply');
    fixture.destroy();
  });

  it('provides explicit slider semantics and native keyboard-accessible details', () => {
    masteringService.beginAudioSource('accessible-source');
    const fixture = TestBed.createComponent(MasteringPanelComponent);
    fixture.componentRef.setInput('originalFile', new File([], 'source.wav'));
    fixture.componentRef.setInput('audioSourceId', 'accessible-source');
    fixture.componentRef.setInput('audioDna', audioDna);
    fixture.detectChanges();

    const slider = fixture.nativeElement.querySelector('#character-intensity') as HTMLInputElement;
    const label = fixture.nativeElement.querySelector('label[for="character-intensity"]') as HTMLLabelElement;
    const details = Array.from(fixture.nativeElement.querySelectorAll('details')) as HTMLDetailsElement[];
    expect(label).toBeTruthy();
    expect(slider.getAttribute('aria-label')).toBe('Mastering Character intensity');
    expect(slider.getAttribute('aria-valuetext')).toBe('26%');
    expect(slider.value).toBe('26');
    expect(parseFloat(getComputedStyle(slider).height)).toBeGreaterThanOrEqual(44);
    expect(details.length).toBeGreaterThanOrEqual(2);
    expect(details.every((detail) => detail.querySelector('summary'))).toBeTrue();
    expect(fixture.nativeElement.querySelector('button[aria-pressed="true"]')?.textContent).toContain('Aurora');
    fixture.destroy();
  });

  it('localizes the Audio DNA guidance in every supported UI language', () => {
    masteringService.beginAudioSource('language-source');
    const fixture = TestBed.createComponent(MasteringPanelComponent);
    fixture.componentRef.setInput('originalFile', new File([], 'source.wav'));
    fixture.componentRef.setInput('audioSourceId', 'language-source');
    fixture.componentRef.setInput('audioDna', audioDna);

    const expected = {
      en: 'The experimental semantic analysis does not yet have enough evidence',
      pt: 'A análise semântica ainda não encontrou evidência suficiente',
      pl: 'Eksperymentalna analiza semantyczna nie ma jeszcze wystarczających danych',
      fr: 'L’analyse sémantique expérimentale ne dispose pas encore de suffisamment de données',
    } as const;
    for (const language of ['en', 'pt', 'pl', 'fr'] as const) {
      currentLang.set(language);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain(expected[language]);
    }
    fixture.destroy();
  });

  it('keeps the Audio DNA card free of horizontal overflow at the required content widths', () => {
    masteringService.beginAudioSource('responsive-source');
    const fixture = TestBed.createComponent(MasteringPanelComponent);
    fixture.componentRef.setInput('originalFile', new File([], 'source.wav'));
    fixture.componentRef.setInput('audioSourceId', 'responsive-source');
    fixture.componentRef.setInput('audioDna', audioDna);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    host.style.display = 'block';
    for (const width of [360, 390, 412, 768, 1024, 1440]) {
      host.style.width = `${width}px`;
      fixture.detectChanges();
      const card = host.querySelector('.audio-dna-card') as HTMLElement;
      expect(card.scrollWidth).withContext(`${width}px Audio DNA overflow`).toBeLessThanOrEqual(card.clientWidth);
    }
    fixture.destroy();
  });

});
