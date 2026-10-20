import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageService } from '../../services/language.service';
import { MasteringService } from '../../services/mastering.service';
import { AudioDnaPayload } from '../../services/mastering-types';
import { AudioDnaCardComponent } from './audio-dna-card';

const audioDna: AudioDnaPayload = {
  version: 'rqs-audio-dna-v1.2',
  status: 'available',
  source_sha256: 'a'.repeat(64),
  technical: {
    lufs_integrated: -14.87,
    true_peak_dbtp: -3.07,
    lra_lu: 4.7,
    rms_dbfs: -16.52,
    crest_factor_db: 13.45,
    duration_seconds: 285,
    brightness: 0.2332,
    warmth: 0.5511,
    transient_strength: 0.4124,
    stereo_width: 0.5617,
    low_end_density: 0.7958,
    harshness: 0.1778,
    dynamic_density: 0.0552,
    overall_energy: 0.5618,
  },
  music: {
    status: 'partial',
    method: 'deterministic_music_features_v1_2',
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
    genres: [], genre_status: 'inconclusive', moods: [], mood_status: 'inconclusive',
    instruments: [], instrument_status: 'inconclusive',
    vocal: { status: 'inconclusive', presence: null, processed: null, method: 'unavailable_without_trained_vocal_classifier' },
    energy: 0.56, energy_label: 'moderate', energy_status: 'technical_composite',
    danceability: 0.63, danceability_label: 'moderate', danceability_status: 'experimental',
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
    atmosphere: 'aurora',
    character_intensity: 26,
    confidence: 0.57,
    confidence_level: 'medium',
    auto_configure: true,
    input_domain: 'technical_audio_dna_only',
    reasons: [{ code: 'MODERATE_ENERGY', weight: 0.89 }],
    atmosphere_dsp_behavior: 'profile_label_only_v2_compatibility_path',
  },
  release_assistant: {
    status: 'experimental', auto_populate: false, review_required: true, primary_genre: null,
    secondary_genres: [], moods: [], instruments: [], bpm: 63, bpm_ambiguous: true,
    key: 'D# minor', vocal_or_instrumental: 'inconclusive', energy: 0.56, danceability: 0.63,
    disclaimer: 'experimental_review_manually_not_for_automatic_publication',
  },
};

describe('AudioDnaCardComponent', () => {
  let fixture: ComponentFixture<AudioDnaCardComponent>;
  let mastering: MasteringService;
  const currentLang = signal<'en' | 'pt' | 'pl' | 'fr'>('en');

  beforeEach(async () => {
    currentLang.set('en');
    await TestBed.configureTestingModule({
      imports: [AudioDnaCardComponent],
      providers: [
        MasteringService,
        { provide: LanguageService, useValue: { currentLang } },
      ],
    }).compileComponents();

    mastering = TestBed.inject(MasteringService);
    mastering.beginAudioSource('fixture-source');
    mastering.initializeFromAudioDna('fixture-source', audioDna.master_profile!);
    fixture = TestBed.createComponent(AudioDnaCardComponent);
    fixture.componentRef.setInput('state', 'success');
    fixture.componentRef.setInput('audioDna', audioDna);
    fixture.detectChanges();
  });

  it('renders V1.2 metrics under Core Musical Features, separate from Music DNA', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('MASTER PROFILE SUGGESTED');
    expect(text).toContain('Aurora');
    expect(text).toContain('26%');
    expect(text).toContain('Medium');
    expect(text).toContain('RQS AUDIO DNA');
    expect(text).toContain('Warm / dark-leaning');
    expect(text).toContain('Strong');
    expect(text).toContain('Spacious');
    expect(text).toContain('Preserved');
    expect(text).toContain('Low');
    expect(text).toContain('Healthy');
    expect(text).toContain('63 BPM');
    expect(text).toContain('Possible double-time: 126 BPM');
    const core = fixture.nativeElement.querySelector('.core-musical-features') as HTMLElement;
    const semantic = fixture.nativeElement.querySelector('.music-dna') as HTMLElement;
    expect(core.textContent).toContain('CORE MUSICAL FEATURES');
    expect(core.textContent).toContain('Tempo');
    expect(core.textContent).toContain('Key');
    expect(core.textContent).toContain('Energy');
    expect(core.textContent).toContain('Danceability');
    expect(core.textContent).not.toContain('Normalized value');
    expect(semantic.textContent).toContain('MUSIC DNA');
    expect(semantic.textContent).toContain('Semantic analysis pending trained classifiers.');
    expect(semantic.textContent).toContain('Genre · Subgenre · Mood · Instruments · Vocals · Character');
    expect(text).not.toContain('Primary genre');
    expect(fixture.nativeElement.querySelector('.analyze-music-dna')).toBeNull();
  });

  it('renders available semantic evidence without changing the Master Profile', () => {
    const available = structuredClone(audioDna);
    available.music!.status = 'available';
    available.music!.semantic = {
      status: 'available', method: 'zero_shot_audio_classifier_v1', model: 'candidate/model',
      genres: [{ label: 'electronic', confidence: 0.88 }],
      moods: [{ label: 'dark', confidence: 0.74 }],
      instruments: [{ label: 'synthesizer', confidence: 0.91 }],
      vocal: {
        status: 'available', presence: 0.76, type: 'singing_voice', processed: null,
        confidence: 0.81, method: 'zero_shot_audio_classifier_v1',
      },
    };
    fixture.componentRef.setInput('audioDna', available);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('electronic');
    expect(text).toContain('dark');
    expect(text).toContain('synthesizer');
    expect(text).not.toContain('electronic 88%');
    expect(text).toContain('singing voice');
    expect(text).toContain('Aurora');
    expect(text).toContain('26%');
  });

  it('keeps Pitch Assistant collapsed and inactive without semantic data', () => {
    const details = fixture.nativeElement.querySelector('.pitch-assistant') as HTMLDetailsElement;
    expect(details.open).toBeFalse();
    expect(details.querySelector('summary')?.textContent).toContain('PITCH ASSISTANT');
    expect(details.textContent).toContain('Pitch Assistant will be activated when semantic analysis is available.');
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .map((button) => (button as HTMLButtonElement).textContent ?? '').join(' ');
    expect(buttons).not.toContain('Apply');
    expect(buttons).not.toContain('Publish');
  });

  it('shows manual override and exposes an explicit reset without reapplying automatically', () => {
    mastering.setIntensityPercent(40);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('MANUAL OVERRIDE');
    expect(mastering.intensityPercent()).toBe(40);

    let resets = 0;
    fixture.componentInstance.resetRecommendation.subscribe(() => resets += 1);
    (fixture.nativeElement.querySelector('.dna-reset') as HTMLButtonElement).click();
    expect(resets).toBe(1);
  });

  it('keeps raw normalized values inside closed advanced details', () => {
    const details = fixture.nativeElement.querySelector('.advanced-details') as HTMLDetailsElement;
    expect(details.open).toBeFalse();
    expect(details.textContent).toContain('0.2332');
    expect(details.textContent).toContain('Energy — Normalized value');
    expect(details.textContent).toContain('56%');
    expect(details.textContent).toContain('Danceability — Normalized value');
    expect(details.textContent).toContain('63%');
    expect(fixture.nativeElement.querySelector('.signal-grid')?.textContent).not.toContain('0.2332');
    expect(fixture.nativeElement.querySelector('.core-musical-features')?.textContent).not.toContain('Normalized value');
    expect(details.querySelector('summary')).toBeTruthy();
  });

  it('uses the approved artist-facing PT-BR copy without fake semantic values', () => {
    currentLang.set('pt');
    fixture.detectChanges();

    const core = fixture.nativeElement.querySelector('.core-musical-features') as HTMLElement;
    const semantic = fixture.nativeElement.querySelector('.music-dna') as HTMLElement;
    const pitch = fixture.nativeElement.querySelector('.pitch-assistant') as HTMLDetailsElement;
    expect(core.textContent).toContain('CARACTERÍSTICAS MUSICAIS');
    expect(core.textContent).toContain('Tonalidade');
    expect(core.textContent).toContain('Energia');
    expect(core.textContent).toContain('Dançabilidade');
    expect(semantic.textContent).toContain('Análise semântica aguardando classificadores treinados.');
    expect(semantic.textContent).not.toContain('Electronic');
    expect(semantic.textContent).not.toContain('Progressive House');
    expect(pitch.open).toBeFalse();
    expect(pitch.textContent).toContain('O assistente de pitch será ativado quando a análise semântica estiver disponível.');
  });

  it('contains the card at every required content width', () => {
    const host = fixture.nativeElement as HTMLElement;
    host.style.display = 'block';
    for (const width of [360, 390, 412, 768, 1024, 1440]) {
      host.style.width = `${width}px`;
      fixture.detectChanges();
      const card = host.querySelector('.audio-dna') as HTMLElement;
      expect(card.scrollWidth).withContext(`${width}px Audio DNA overflow`).toBeLessThanOrEqual(card.clientWidth);
    }
  });
});
