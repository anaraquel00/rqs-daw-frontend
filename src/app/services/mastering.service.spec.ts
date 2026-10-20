import { TestBed } from '@angular/core/testing';
import { MasteringService } from './mastering.service';
import { AudioDnaMasterProfile } from './mastering-types';

const recommendedProfile: AudioDnaMasterProfile = {
  atmosphere: 'aurora',
  character_intensity: 28,
  confidence: 0.82,
  confidence_level: 'high',
  auto_configure: true,
  input_domain: 'technical_audio_dna_only',
  reasons: [{ code: 'WARM_SPECTRAL_BALANCE', weight: 0.82 }],
  atmosphere_dsp_behavior: 'profile_label_only_v2_compatibility_path',
};

describe('MasteringService V2 contract', () => {
  let service: MasteringService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MasteringService);
  });

  it('starts with the validated V2 defaults', () => {
    expect(service.getRequest()).toEqual({
      destination: 'streaming',
      platform: 'spotify',
      atmosphere: 'clear_sky',
      intensityPercent: 50,
      requestedLufs: null,
      soundcloudMode: 'standard',
    });
  });

  it('clamps intensity to the 0-100 V2 contract', () => {
    service.setIntensityPercent(-12);
    expect(service.intensityPercent()).toBe(0);

    service.setIntensityPercent(101.7);
    expect(service.intensityPercent()).toBe(100);

    service.setIntensityPercent(42.6);
    expect(service.intensityPercent()).toBe(43);
  });

  it('clears streaming-only state for club and festival', () => {
    service.setPlatform('soundcloud');
    service.setSoundCloudMode('loud');
    service.setRequestedLufs(-12);
    service.setDestination('club');

    expect(service.getRequest()).toEqual({
      destination: 'club',
      platform: null,
      atmosphere: 'clear_sky',
      intensityPercent: 50,
      requestedLufs: null,
      soundcloudMode: 'standard',
    });
  });

  it('does not serialize legacy precision-control compatibility state', () => {
    service.setLowCutoff(350);
    service.setHighCutoff(4200);
    service.setStereoWidth(1.4);
    service.setSatAmount(0.9);
    service.setMonoBass(160);
    service.setCeiling(-0.2);
    service.setThreshold(-6);

    const request = service.getRequest() as unknown as Record<string, unknown>;
    expect(Object.keys(request).sort()).toEqual([
      'atmosphere',
      'destination',
      'intensityPercent',
      'platform',
      'requestedLufs',
      'soundcloudMode',
    ]);
  });

  it('initializes Atmosphere and Character once from a confident Audio DNA recommendation', () => {
    service.beginAudioSource('source-a');

    expect(service.initializeFromAudioDna('source-a', recommendedProfile)).toBeTrue();
    expect(service.atmosphere()).toBe('aurora');
    expect(service.intensityPercent()).toBe(28);
    expect(service.masterProfileSource()).toBe('AUDIO_DNA');
  });

  it('keeps a manual override and does not snap back on unrelated delivery changes', () => {
    service.beginAudioSource('source-a');
    service.initializeFromAudioDna('source-a', recommendedProfile);
    service.setAtmosphere('thunder');
    service.setIntensityPercent(42);

    service.setPlatform('soundcloud');
    expect(service.atmosphere()).toBe('thunder');
    expect(service.intensityPercent()).toBe(42);
    expect(service.masterProfileSource()).toBe('MANUAL');

    expect(service.initializeFromAudioDna('source-a', recommendedProfile)).toBeFalse();
    expect(service.atmosphere()).toBe('thunder');
    expect(service.intensityPercent()).toBe(42);
  });

  it('does not auto-configure an inconclusive low-confidence recommendation', () => {
    service.beginAudioSource('source-low');
    const lowConfidence: AudioDnaMasterProfile = {
      ...recommendedProfile,
      atmosphere: 'clear_sky',
      character_intensity: 25,
      confidence: 0.48,
      confidence_level: 'low',
      auto_configure: false,
    };

    expect(service.initializeFromAudioDna('source-low', lowConfidence)).toBeFalse();
    expect(service.atmosphere()).toBe('clear_sky');
    expect(service.intensityPercent()).toBe(50);
    expect(service.masterProfileSource()).toBe('MANUAL');
  });

  it('resets a manual override only when the artist explicitly requests it', () => {
    service.beginAudioSource('source-a');
    service.initializeFromAudioDna('source-a', recommendedProfile);
    service.setIntensityPercent(44);

    expect(service.resetToAudioDnaRecommendation()).toBeTrue();
    expect(service.atmosphere()).toBe('aurora');
    expect(service.intensityPercent()).toBe(28);
    expect(service.masterProfileSource()).toBe('AUDIO_DNA');
  });
});
