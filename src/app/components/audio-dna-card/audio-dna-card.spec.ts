import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageService } from '../../services/language.service';
import { MasteringService } from '../../services/mastering.service';
import {
  AudioDnaPayload,
  AudioIntelligenceV2Payload,
  MasteringDeliveryTargetCapabilities,
  OpenAiMusicAnalystPayload,
} from '../../services/mastering-types';
import { AudioDnaCardComponent } from './audio-dna-card';

const target: MasteringDeliveryTargetCapabilities = {
  target_lufs: -14,
  min_lufs: -14.5,
  max_lufs: -13.5,
  true_peak_ceiling_dbtp: -1.2,
  min_plr_lu: 9,
  min_lra_retention: 0.85,
  max_crest_loss_db: 1.5,
  policy_source: 'test',
};

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
    fixture.componentRef.setInput('target', target);
    fixture.detectChanges();
  });

  it('renders the approved artist-first summary in the required order', () => {
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';
    const summary = root.querySelector('.track-summary') as HTMLElement;
    const master = root.querySelector('.master-profile') as HTMLElement;
    const why = root.querySelector('.why-master') as HTMLElement;
    const readiness = root.querySelector('.distribution-readiness') as HTMLElement;

    expect(text).toContain('TRACK SUMMARY');
    expect(text).toContain('63 BPM');
    expect(text).toContain('Possible double-time: 126 BPM');
    expect(text).toContain('D# minor');
    expect(text).toContain('Energy');
    expect(text).toContain('Danceability');
    expect(text).toContain('RECOMMENDED MASTER');
    expect(text).toContain('Aurora');
    expect(text).toContain('26%');
    expect(text).toContain('WHY THIS MASTER?');
    expect(text).toContain('Moderate energy');
    expect(text).toContain('DISTRIBUTION READINESS');
    expect(text).toContain('-14.9 LUFS');
    expect(text).toContain('Needs attention');
    expect(text).toContain('-3.1 dBTP');
    expect(text).toContain('Within range');
    expect(summary.compareDocumentPosition(master) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(master.compareDocumentPosition(why) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(why.compareDocumentPosition(readiness) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('hides Music DNA and Pitch Assistant even when semantic evidence is available', () => {
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

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).not.toContain('MUSIC DNA');
    expect(text).not.toContain('PITCH ASSISTANT');
    expect(text).not.toContain('electronic');
    expect(text).toContain('Aurora');
    expect(mastering.atmosphere()).toBe('aurora');
    expect(mastering.intensityPercent()).toBe(26);
  });

  it('renders Genre and Astral but omits abstained Instruments for READY semantic evidence', () => {
    const ready = structuredClone(audioDna);
    ready.source_generation = 'source-9';
    ready.analyzer_generation = 'source-9';
    ready.semantic = {
      version: 'rqs-semantic-audio-dna-v1',
      status: 'READY',
      source_generation: 'source-9',
      analyzer_generation: 'source-9',
      engine: {
        name: 'cocotagger',
        model: 'musiccocoa',
        revision: 'pinned-revision',
        taxonomy_version: 'pinned-taxonomy',
      },
      categories: {
        genre: [{ tag: 'electronic', raw_score: 0.34, rank: 1 }],
        mood: [{ tag: 'dark', raw_score: 0.35, rank: 1 }],
        instruments: [{ tag: 'sitar', raw_score: 0.19, rank: 1 }],
      },
    };
    fixture.componentRef.setInput('audioDna', ready);
    fixture.detectChanges();

    const semantic = fixture.nativeElement.querySelector('[data-testid="semantic-audio-dna"]') as HTMLElement;
    const text = semantic.textContent ?? '';
    expect(text).toContain('Genre');
    expect(text).toContain('Electronic');
    expect(text).toContain('Astral');
    expect(text).toContain('Dark');
    expect(text).not.toContain('Instruments');
    expect(text).not.toContain('Synthesizer');
    expect(text).not.toContain('Sitar');
    expect(text).not.toContain('Mood');
    expect(fixture.nativeElement.textContent).toContain('RECOMMENDED MASTER');
    expect(mastering.atmosphere()).toBe('aurora');
  });

  it('renders Audio Intelligence V2 while preserving the technical and Master sections', () => {
    const intelligence: AudioIntelligenceV2Payload = {
      analysisVersion: 'audio-intelligence-v2', status: 'READY', provider: 'openai', model: 'gpt-audio-1.5',
      genre_family_taxonomy: ['electronic', 'rock'],
      source_generation: 'source-v2', analyzer_generation: 'source-v2',
      genre_family: ['electronic'], subgenres: ['Progressive House'], moods: ['uplifting'],
      instruments: ['Synthesizer', 'Drum machine'], vocals: ['Processed vocals'],
      production_elements: ['Layered synth texture'], uncertainty: 'medium',
    };
    fixture.componentRef.setInput('audioIntelligence', intelligence);
    fixture.detectChanges();

    const v2 = fixture.nativeElement.querySelector('[data-testid="audio-intelligence-v2"]') as HTMLElement;
    expect(v2.textContent).toContain('electronic · Progressive House');
    expect(v2.textContent).toContain('uplifting');
    expect(v2.textContent).toContain('Synthesizer · Drum machine');
    expect(fixture.nativeElement.textContent).toContain('RECOMMENDED MASTER');
    expect(fixture.nativeElement.textContent).toContain('DISTRIBUTION READINESS');
  });

  it('isolates an unavailable V2 analysis without falling back to legacy CocoTagger labels', () => {
    const legacy = structuredClone(audioDna);
    legacy.semantic = {
      version: 'rqs-semantic-audio-dna-v1', status: 'READY', source_generation: 'legacy', analyzer_generation: 'legacy',
      engine: { name: 'cocotagger', model: 'musiccocoa', revision: 'rev', taxonomy_version: 'tax' },
      categories: { genre: [{ tag: 'country', raw_score: .2, rank: 1 }] },
    };
    fixture.componentRef.setInput('audioDna', legacy);
    fixture.componentRef.setInput('audioIntelligence', {
      analysisVersion: 'audio-intelligence-v2', status: 'UNAVAILABLE', provider: 'openai', model: 'gpt-audio-1.5',
      genre_family_taxonomy: ['electronic', 'rock'],
      source_generation: 'source-v2', analyzer_generation: 'source-v2', genre_family: [], subgenres: [], moods: [],
      instruments: [], vocals: [], production_elements: [], uncertainty: null, error_code: 'OPENAI_TIMEOUT',
    } satisfies AudioIntelligenceV2Payload);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="audio-intelligence-v2-fallback"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Country');
    expect(fixture.nativeElement.textContent).toContain('RECOMMENDED MASTER');
  });

  it('renders Instruments only from a READY OpenAI Music Analyst result', () => {
    const ready = structuredClone(audioDna);
    ready.semantic = {
      version: 'rqs-semantic-audio-dna-v1',
      status: 'READY',
      source_generation: 'source-9',
      analyzer_generation: 'source-9',
      engine: {
        name: 'cocotagger',
        model: 'musiccocoa',
        revision: 'pinned-revision',
        taxonomy_version: 'pinned-taxonomy',
      },
      categories: {
        genre: [{ tag: 'electronic', raw_score: 0.34, rank: 1 }],
        mood: [{ tag: 'dark', raw_score: 0.35, rank: 1 }],
        instruments: [{ tag: 'sitar', raw_score: 0.19, rank: 1 }],
      },
    };
    const analyst: OpenAiMusicAnalystPayload = {
      status: 'READY',
      provider: 'openai',
      model: 'gpt-audio-1.5',
      instruments: [
        { name: 'Synthesizer', confidence: 'high' },
        { name: 'Electronic Drums', confidence: 'medium' },
      ],
      vocals: { present: true, confidence: 'high' },
      production_elements: ['Layered synth texture'],
    };
    fixture.componentRef.setInput('audioDna', ready);
    fixture.componentRef.setInput('openAiMusicAnalyst', analyst);
    fixture.detectChanges();

    const semantic = fixture.nativeElement.querySelector('[data-testid="semantic-audio-dna"]') as HTMLElement;
    const text = semantic.textContent ?? '';
    expect(text).toContain('AI Music Analysis');
    expect(text).toContain('Genre');
    expect(text).toContain('Astral');
    expect(text).toContain('Instruments');
    expect(text).toContain('Synthesizer · Electronic Drums');
    expect(text).not.toContain('Sitar');
    expect(text).not.toContain('Vocals');
    expect(text).not.toContain('Layered synth texture');
    expect(text).not.toContain('gpt-audio-1.5');
    expect(text).not.toContain('OpenAI');
  });

  for (const instrumentCount of [1, 3, 4, 5]) {
    it(`renders all ${instrumentCount} normalized OpenAI instrument${instrumentCount === 1 ? '' : 's'} without truncation`, () => {
      const ready = structuredClone(audioDna);
      ready.semantic = {
        version: 'rqs-semantic-audio-dna-v1',
        status: 'READY',
        source_generation: 'source-9',
        analyzer_generation: 'source-9',
        engine: {
          name: 'cocotagger', model: 'musiccocoa', revision: 'pinned-revision', taxonomy_version: 'pinned-taxonomy',
        },
        categories: {
          genre: [{ tag: 'electronic', raw_score: 0.34, rank: 1 }],
          mood: [{ tag: 'dark', raw_score: 0.35, rank: 1 }],
          instruments: [],
        },
      };
      const allInstruments: OpenAiMusicAnalystPayload['instruments'] = [
        { name: 'Synthesizer', confidence: 'high' },
        { name: 'Bass Synth', confidence: 'high' },
        { name: 'Electronic Drums', confidence: 'medium' },
        { name: 'Percussion', confidence: 'medium' },
        { name: 'Piano', confidence: 'high' },
      ];
      const instruments = allInstruments.slice(0, instrumentCount);

      fixture.componentRef.setInput('audioDna', ready);
      fixture.componentRef.setInput('openAiMusicAnalyst', {
        status: 'READY',
        provider: 'openai',
        model: 'gpt-audio-1.5',
        instruments,
        vocals: { present: true, confidence: 'high' },
        production_elements: ['Layered synth texture'],
      } satisfies OpenAiMusicAnalystPayload);
      fixture.detectChanges();

      const rendered = fixture.nativeElement.querySelector('[data-testid="openai-instruments"] dd') as HTMLElement;
      expect(rendered.textContent?.trim()).toBe(instruments.map(({ name }) => name).join(' · '));
      expect(rendered.textContent).not.toContain('Vocals');
      expect(rendered.textContent).not.toContain('Layered synth texture');
    });
  }

  it('keeps Genre and Astral while hiding empty or unavailable OpenAI Instruments', () => {
    const ready = structuredClone(audioDna);
    ready.semantic = {
      version: 'rqs-semantic-audio-dna-v1',
      status: 'READY',
      source_generation: 'source-9',
      analyzer_generation: 'source-9',
      engine: {
        name: 'cocotagger', model: 'musiccocoa', revision: 'pinned-revision', taxonomy_version: 'pinned-taxonomy',
      },
      categories: {
        genre: [{ tag: 'electronic', raw_score: 0.34, rank: 1 }],
        mood: [{ tag: 'dark', raw_score: 0.35, rank: 1 }],
        instruments: [{ tag: 'sitar', raw_score: 0.19, rank: 1 }],
      },
    };
    fixture.componentRef.setInput('audioDna', ready);
    fixture.componentRef.setInput('openAiMusicAnalyst', {
      status: 'UNAVAILABLE',
      provider: 'openai',
      model: 'gpt-audio-1.5',
      instruments: [],
      vocals: { present: false, confidence: null },
      production_elements: [],
      error_code: 'OPENAI_TIMEOUT',
    } satisfies OpenAiMusicAnalystPayload);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Electronic');
    expect(text).toContain('Dark');
    expect(text).not.toContain('Instruments');
    expect(text).not.toContain('Sitar');
    expect(text).toContain('RECOMMENDED MASTER');
    expect(text).toContain('DISTRIBUTION READINESS');
  });

  for (const status of ['UNAVAILABLE', 'FAILED', 'STALE'] as const) {
    it(`keeps technical mastering usable when semantic status is ${status}`, () => {
      const unavailable = structuredClone(audioDna);
      unavailable.semantic = {
        version: 'rqs-semantic-audio-dna-v1',
        status,
        source_generation: 'source-9',
        analyzer_generation: 'source-9',
        engine: {
          name: 'cocotagger',
          model: 'musiccocoa',
          revision: 'pinned-revision',
          taxonomy_version: 'pinned-taxonomy',
        },
        categories: {},
        error_code: status,
      };
      fixture.componentRef.setInput('audioDna', unavailable);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[data-testid="semantic-audio-dna"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-testid="semantic-audio-dna-fallback"]')).not.toBeNull();
      expect(fixture.nativeElement.textContent).toContain('RECOMMENDED MASTER');
      expect(fixture.nativeElement.textContent).toContain('DISTRIBUTION READINESS');
      expect(mastering.atmosphere()).toBe('aurora');
      expect(mastering.intensityPercent()).toBe(26);
    });
  }

  it('shows manual override and preserves the explicit reset lifecycle without Apply', () => {
    mastering.setIntensityPercent(40);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('MANUAL OVERRIDE');
    expect(mastering.intensityPercent()).toBe(40);

    let resets = 0;
    fixture.componentInstance.resetRecommendation.subscribe(() => resets += 1);
    (fixture.nativeElement.querySelector('.dna-reset') as HTMLButtonElement).click();
    expect(resets).toBe(1);
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .map((button) => (button as HTMLButtonElement).textContent ?? '').join(' ');
    expect(buttons).not.toContain('Apply');
  });

  it('keeps RQS Audio DNA and raw metrics inside closed Technical Details', () => {
    fixture.componentRef.setInput('mode', 'technical');
    fixture.detectChanges();

    const details = fixture.nativeElement.querySelector('.technical-details') as HTMLDetailsElement;
    expect(details).not.toBeNull();
    expect(details.open).toBeFalse();
    expect(details.querySelector('summary')?.textContent).toContain('TECHNICAL DETAILS');
    expect(details.querySelector('summary')?.textContent).toContain('Technical analysis: RQS Audio DNA');
    expect(details.textContent).toContain('RQS AUDIO DNA');
    expect(details.textContent).toContain('Warm / dark-leaning');
    expect(details.textContent).toContain('0.2332');
    expect(details.textContent).toContain('Energy — Normalized value');
    expect(details.textContent).toContain('56%');
    expect(details.textContent).toContain('Danceability — Normalized value');
    expect(details.textContent).toContain('63%');
    expect(details.textContent).toContain('experimental');
    expect(details.textContent).toContain('deterministic_music_features_v1_2');
  });

  it('uses the approved artist-facing PT-BR copy', () => {
    currentLang.set('pt');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('RESUMO DA FAIXA');
    expect(text).toContain('MASTER RECOMENDADO');
    expect(text).toContain('POR QUE ESTE MASTER?');
    expect(text).toContain('PRONTIDÃO PARA DISTRIBUIÇÃO');
    expect(text).toContain('Confiança média');
    expect(text).not.toContain('CARACTERÍSTICAS MUSICAIS');
    expect(text).not.toContain('Análise semântica aguardando');
  });

  it('contains summary and technical modes at every required content width', () => {
    const host = fixture.nativeElement as HTMLElement;
    host.style.display = 'block';
    for (const mode of ['summary', 'technical'] as const) {
      fixture.componentRef.setInput('mode', mode);
      for (const width of [360, 390, 412, 768, 1024, 1440]) {
        host.style.width = `${width}px`;
        fixture.detectChanges();
        const element = host.querySelector(mode === 'summary' ? '.audio-dna' : '.technical-details') as HTMLElement;
        expect(element.scrollWidth).withContext(`${width}px ${mode} overflow`).toBeLessThanOrEqual(element.clientWidth);
      }
    }
  });
});
