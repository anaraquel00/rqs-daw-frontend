import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { DspService } from '../../services/dsp';
import { LanguageService } from '../../services/language.service';
import {
  AudioDnaPayload,
  MasteringV2Analysis,
  OpenAiMusicAnalystPayload,
  SpotifyPitchRequest,
  SpotifyPitchResponse,
} from '../../services/mastering-types';
import { SpotifyPitchPanelComponent } from './spotify-pitch-panel';

describe('SpotifyPitchPanelComponent', () => {
  let fixture: ComponentFixture<SpotifyPitchPanelComponent>;
  let component: SpotifyPitchPanelComponent;
  let dsp: jasmine.SpyObj<DspService>;
  const currentLang = signal<'en' | 'pt' | 'pl' | 'fr'>('en');

  const metrics: MasteringV2Analysis = {
    integrated_lufs: -11,
    true_peak_dbtp: -1,
    rms_dbfs: -15,
    crest_factor_db: 8,
    loudness_range_lu: 5,
    duration_seconds: 180,
  };
  const audioDna = {
    version: 'rqs-audio-dna-v1.1',
    status: 'available',
    source_sha256: 'a'.repeat(64),
    source_generation: 'source-1',
    analyzer_generation: 'source-1',
    technical: {
      lufs_integrated: -11, true_peak_dbtp: -1, lra_lu: 5, rms_dbfs: -15,
      crest_factor_db: 8, duration_seconds: 180, brightness: .7, warmth: .3,
      transient_strength: .7, stereo_width: .8, low_end_density: .7,
      harshness: .2, dynamic_density: .6, overall_energy: .8,
    },
    music: {
      status: 'experimental', method: 'test',
      bpm: { value: 92, confidence: .8, alternatives: [], ambiguous: false, method: 'test' },
      key: { value: null, confidence: 0, status: 'experimental' },
      genres: [], genre_status: 'inconclusive', moods: [], mood_status: 'inconclusive',
      instruments: [], instrument_status: 'inconclusive',
      vocal: { status: 'inconclusive', presence: null, processed: null, method: 'test' },
      energy: .71, energy_status: 'technical_composite',
      danceability: .64, danceability_status: 'experimental',
    },
    master_profile: null,
    release_assistant: null,
    semantic: {
      version: 'rqs-semantic-audio-dna-v1', status: 'READY',
      source_generation: 'source-1', analyzer_generation: 'source-1',
      engine: { name: 'cocotagger', model: 'musiccocoa', revision: 'rev', taxonomy_version: 'tax' },
      categories: {
        genre: [{ tag: 'Trip Hop', raw_score: .4, rank: 1 }],
        mood: [{ tag: 'Bittersweet', raw_score: .38, rank: 1 }],
        instruments: [],
      },
    },
  } as AudioDnaPayload;
  const analyst: OpenAiMusicAnalystPayload = {
    status: 'READY', provider: 'openai', model: 'gpt-audio-1.5',
    instruments: [{ name: 'Synthesizer', confidence: 'high' }],
    vocals: { present: true, confidence: 'high' },
    production_elements: ['Glitch effects'],
  };
  const ready: SpotifyPitchResponse = {
    status: 'READY',
    spotify_pitch: 'A grounded release pitch.',
    evidence_used: [
      { type: 'genre', value: 'Trip Hop', source: 'cocotagger' },
      { type: 'instrument', value: 'Synthesizer', source: 'openai_music_analyst' },
    ],
    warnings: [],
  };

  beforeEach(async () => {
    currentLang.set('en');
    dsp = jasmine.createSpyObj<DspService>('DspService', ['generateSpotifyPitch']);
    dsp.generateSpotifyPitch.and.returnValue(of(ready));
    await TestBed.configureTestingModule({
      imports: [SpotifyPitchPanelComponent],
      providers: [
        { provide: DspService, useValue: dsp },
        { provide: LanguageService, useValue: { currentLang } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SpotifyPitchPanelComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('analysisMetrics', metrics);
    fixture.componentRef.setInput('audioDna', audioDna);
    fixture.componentRef.setInput('openAiMusicAnalyst', analyst);
    fixture.componentRef.setInput('sourceGeneration', 'source-1');
    fixture.detectChanges();
  });

  it('renders the evidence checklist without marking missing evidence as ready', () => {
    const text = fixture.nativeElement.querySelector('[data-testid="evidence-checklist"]').textContent;
    expect(text).toContain('Audio DNA');
    expect(text).toContain('Genre');
    expect(text).toContain('Astral');
    expect(text).toContain('Instruments');
    expect(fixture.nativeElement.querySelectorAll('.evidence-grid .ready').length).toBe(5);

    fixture.componentRef.setInput('openAiMusicAnalyst', null);
    fixture.detectChanges();
    const instrumentRow = Array.from(fixture.nativeElement.querySelectorAll('.evidence-grid span'))
      .find((element: unknown) => (element as HTMLElement).textContent?.includes('Instruments')) as HTMLElement;
    expect(instrumentRow.classList.contains('ready')).toBeFalse();
    expect(instrumentRow.textContent).not.toContain('✓');
  });

  it('shows collaboration fields only when collaboration is enabled', () => {
    expect(fixture.nativeElement.querySelector('input[name="collaborators"]')).toBeNull();
    component.isCollaboration = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[name="collaborators"]')).not.toBeNull();
  });

  it('sends only approved Release Intelligence inputs and no audio or DSP loudness metrics', () => {
    component.songAbout = 'Finding clarity.';
    component.isCollaboration = true;
    component.collaborators = 'Ana, RQS';
    component.generatePitch();
    const request = dsp.generateSpotifyPitch.calls.mostRecent().args[0] as SpotifyPitchRequest;
    expect(request.release_intelligence.audio_intelligence.genre).toEqual(['Trip Hop']);
    expect(request.release_intelligence.audio_intelligence.astral).toEqual(['Bittersweet']);
    expect(request.release_intelligence.artist_context.collaborators).toEqual(['Ana', 'RQS']);
    expect(JSON.stringify(request)).not.toMatch(/integrated_lufs|true_peak|base64|audio_url/);
  });

  it('renders loading, READY result, and friendly evidence labels', () => {
    const pending = new Subject<SpotifyPitchResponse>();
    dsp.generateSpotifyPitch.and.returnValue(pending);
    component.generatePitch();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('GENERATING');
    pending.next(ready);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="spotify-pitch-result"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('A grounded release pitch.');
    expect(fixture.nativeElement.textContent).toContain('Genre / Audio Analysis');
    expect(fixture.nativeElement.textContent).toContain('Instrument / Music Analyst');
  });

  it('renders a graceful UNAVAILABLE state without affecting analysis evidence', () => {
    dsp.generateSpotifyPitch.and.returnValue(of({
      status: 'UNAVAILABLE', spotify_pitch: '', evidence_used: [], warnings: ['OPENAI_TIMEOUT'],
    }));
    component.generatePitch();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Pitch generation is temporarily unavailable');
    expect(component.genreValues()).toEqual(['Trip Hop']);
  });

  it('isolates transport errors to the pitch panel', () => {
    dsp.generateSpotifyPitch.and.returnValue(throwError(() => new Error('network')));
    component.generatePitch();
    fixture.detectChanges();
    expect(component.requestState()).toBe('unavailable');
    expect(component.genreValues()).toEqual(['Trip Hop']);
  });

  it('regenerate issues one new request and does not re-run audio analysis', () => {
    component.generatePitch();
    component.generatePitch();
    expect(dsp.generateSpotifyPitch).toHaveBeenCalledTimes(2);
  });

  it('wires COPY PITCH to the clipboard action', () => {
    component.generatePitch();
    fixture.detectChanges();
    const copy = spyOn(component, 'copyPitch').and.resolveTo();
    const button = Array.from(fixture.nativeElement.querySelectorAll('.pitch-actions button'))
      .find((element: unknown) => (element as HTMLElement).textContent?.includes('COPY PITCH')) as HTMLButtonElement;
    button.click();
    expect(copy).toHaveBeenCalled();
  });

  it('ignores stale results after source generation changes', () => {
    const pending = new Subject<SpotifyPitchResponse>();
    dsp.generateSpotifyPitch.and.returnValue(pending);
    component.generatePitch();
    fixture.componentRef.setInput('sourceGeneration', 'source-2');
    fixture.detectChanges();
    pending.next(ready);
    expect(component.result()).toBeNull();
    expect(component.songAbout).toBe('');
  });

  it('renders PT-BR copy', () => {
    currentLang.set('pt');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Inteligência de Lançamento com IA');
    expect(fixture.nativeElement.textContent).toContain('GERAR PITCH');
  });

  it('renders EN copy and falls back to EN for other supported languages', () => {
    for (const language of ['en', 'pl', 'fr'] as const) {
      currentLang.set(language);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('AI Release Intelligence');
      expect(fixture.nativeElement.textContent).toContain('GENERATE PITCH');
    }
  });

  it('retains theme-aware classes for light and dark studio shells', () => {
    const styles = (SpotifyPitchPanelComponent as unknown as { ɵcmp: { styles: string[] } })
      .ɵcmp.styles.join(' ');
    expect(styles).toMatch(/app-studio-shell.*data-theme.*light/);
    expect(styles).toContain('--studio-card');
    expect(styles).toContain('--studio-text');
  });
});
