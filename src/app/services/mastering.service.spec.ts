import { TestBed } from '@angular/core/testing';
import { MasteringService } from './mastering.service';
import { AudioDnaMasterProfile } from './mastering-types';

const recommendedProfile: AudioDnaMasterProfile = {
  atmosphere: 'aurora', character_intensity: 26, confidence: 0.57, confidence_level: 'medium',
  auto_configure: true, input_domain: 'technical_audio_dna_only', reasons: [],
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

  it('initializes an Audio DNA profile only once for the same source', () => {
    service.beginAudioSource('source-a');
    expect(service.initializeFromAudioDna('source-a', recommendedProfile)).toBeTrue();
    expect(service.atmosphere()).toBe('aurora');
    expect(service.intensityPercent()).toBe(26);
    expect(service.masterProfileSource()).toBe('AUDIO_DNA');

    expect(service.initializeFromAudioDna('source-a', { ...recommendedProfile, character_intensity: 90 })).toBeFalse();
    expect(service.intensityPercent()).toBe(26);
  });

  it('preserves manual override across delivery changes and resets only on explicit request', () => {
    service.beginAudioSource('source-a');
    service.initializeFromAudioDna('source-a', recommendedProfile);
    service.setIntensityPercent(40);
    service.setPlatform('soundcloud');
    service.setDestination('club');

    expect(service.intensityPercent()).toBe(40);
    expect(service.masterProfileSource()).toBe('MANUAL');
    expect(service.resetToAudioDnaRecommendation()).toBeTrue();
    expect(service.atmosphere()).toBe('aurora');
    expect(service.intensityPercent()).toBe(26);
    expect(service.masterProfileSource()).toBe('AUDIO_DNA');
  });

  it('starts a fresh recommendation lifecycle for a new audio source', () => {
    service.beginAudioSource('source-a');
    service.initializeFromAudioDna('source-a', recommendedProfile);
    service.setIntensityPercent(40);
    service.beginAudioSource('source-b');

    expect(service.audioDnaRecommendation()).toBeNull();
    expect(service.masterProfileSource()).toBe('MANUAL');
    expect(service.initializeFromAudioDna('source-a', recommendedProfile)).toBeFalse();
    expect(service.initializeFromAudioDna('source-b', recommendedProfile)).toBeTrue();
  });
});
