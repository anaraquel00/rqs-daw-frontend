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
  SpotifyPitchQuotaResponse,
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
  const availableQuota: SpotifyPitchQuotaResponse = {
    plan: 'free',
    spotify_pitch: {
      used: 1, limit: 3, remaining: 2, period: 'lifetime', period_key: 'lifetime',
      can_generate: true, active_reservations: 0,
    },
  };
  const ready: SpotifyPitchResponse = {
    status: 'READY',
    metadata_suggestions: {
      genres: ['Trip Hop'], moods: ['Bittersweet'], instruments: ['Synthesizer'],
    },
    editorial_pitch: 'A grounded release pitch.',
    editorial_positioning: ['Alternative Electronic'],
    why_this_pitch_works: [
      'The genre is supported by analysis.',
      'The instrumentation is confirmed.',
      'The pitch remains grounded in evidence.',
    ],
    evidence_used: [
      { type: 'genre', value: 'Trip Hop', source: 'cocotagger' },
      { type: 'instrument', value: 'Synthesizer', source: 'artist_confirmed' },
    ],
    warnings: [],
  };

  beforeEach(async () => {
    currentLang.set('en');
    dsp = jasmine.createSpyObj<DspService>('DspService', ['generateSpotifyPitch', 'getSpotifyPitchQuota']);
    dsp.getSpotifyPitchQuota.and.returnValue(of(availableQuota));
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

  it('keeps Generate enabled with completely empty optional Artist Context', () => {
    const button = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(component.songStory).toBe('');
    expect(component.releaseDifference).toBe('');
    expect(component.realContext).toBe('');
    expect(component.whyNow).toBe('');
    expect(component.selectedPromotionChannels).toEqual([]);
    expect(button.disabled).toBeFalse();
    expect(fixture.nativeElement.querySelector('[data-testid="pitch-ready"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="spotify-pitch-quota"]').textContent)
      .toContain('You have 2 of 3 AI Spotify Pitches remaining.');
  });

  it('blocks Generate and Regenerate when the authoritative quota is exhausted', () => {
    component.quota.set({
      plan: 'free',
      spotify_pitch: {
        used: 3, limit: 3, remaining: 0, period: 'lifetime', period_key: 'lifetime',
        can_generate: false, active_reservations: 0,
      },
    });
    fixture.detectChanges();
    const generate = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(generate.disabled).toBeTrue();
    expect(fixture.nativeElement.querySelector('[data-testid="spotify-pitch-quota"]').textContent)
      .toContain('You have reached your AI Spotify Pitch limit.');
    component.generatePitch();
    expect(dsp.generateSpotifyPitch).not.toHaveBeenCalled();
  });

  it('updates the counter from a READY response and sends a unique idempotency key', () => {
    dsp.generateSpotifyPitch.and.returnValue(of({
      ...ready,
      quota: {
        plan: 'free',
        spotify_pitch: {
          used: 2, limit: 3, remaining: 1, period: 'lifetime', period_key: 'lifetime',
          can_generate: true, active_reservations: 0,
        },
      },
    }));
    component.generatePitch();
    fixture.detectChanges();
    expect(dsp.generateSpotifyPitch.calls.mostRecent().args[1]).toMatch(/^[0-9a-f-]{36}$/);
    expect(component.quota()?.spotify_pitch.used).toBe(2);
    expect(fixture.nativeElement.querySelector('[data-testid="spotify-pitch-quota"]').textContent)
      .toContain('You have 1 of 3 AI Spotify Pitches remaining.');
  });

  it('applies authoritative quota returned by a 429 without another generation', () => {
    const exhausted: SpotifyPitchQuotaResponse = {
      plan: 'free',
      spotify_pitch: {
        used: 3, limit: 3, remaining: 0, period: 'lifetime', period_key: 'lifetime',
        can_generate: false, active_reservations: 0,
      },
    };
    dsp.generateSpotifyPitch.and.returnValue(throwError(() => ({ status: 429, error: { code: 'SPOTIFY_PITCH_QUOTA_EXCEEDED', quota: exhausted } })));
    component.generatePitch();
    fixture.detectChanges();
    expect(component.quota()).toEqual(exhausted);
    expect((fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).disabled).toBeTrue();
  });

  it('renders optional why-now copy in EN and sends only artist-supplied text', () => {
    const field = fixture.nativeElement.querySelector('[data-testid="why-now-field"]') as HTMLElement;
    expect(field.textContent).toContain('Why release this track now? (optional)');
    expect(field.textContent).toContain('a continuation of a story');
    component.whyNow = 'This release marks a new phase.';
    component.generatePitch();
    const request = dsp.generateSpotifyPitch.calls.mostRecent().args[0] as SpotifyPitchRequest;
    expect(request.release_intelligence.artist_context.why_now).toBe('This release marks a new phase.');
  });

  it('shows Confirm Sound and confirms unchanged detector suggestions', () => {
    expect(fixture.nativeElement.querySelector('[data-testid="confirm-sound"]')).not.toBeNull();
    const legend = fixture.nativeElement.querySelector('[data-testid="metadata-curation-legend"]') as HTMLElement;
    expect(legend.textContent).toContain('AI DETECTED');
    expect(legend.textContent).toContain('ARTIST CONFIRMED / FINAL');
    component.confirmSound();
    expect(component.soundConfirmed).toBeTrue();
    expect(component.confirmedGenres).toEqual(['Trip Hop']);
    expect(component.confirmedAstral).toEqual(['Bittersweet']);
    expect(component.confirmedInstruments).toEqual(['Synthesizer']);
  });

  it('allows removing a suggestion without mutating raw detector evidence', () => {
    component.beginAdjustSound();
    component.toggleSoundLabel('genre', 'Trip Hop');
    component.confirmSound();
    expect(component.confirmedGenres).toEqual([]);
    expect(component.genreValues()).toEqual(['Trip Hop']);
    component.generatePitch();
    const request = dsp.generateSpotifyPitch.calls.mostRecent().args[0] as SpotifyPitchRequest;
    expect(request.release_intelligence.raw_audio_evidence.genre).toEqual(['Trip Hop']);
    expect(request.release_intelligence.artist_confirmed_sound.confirmed).toBeTrue();
    expect(request.release_intelligence.artist_confirmed_sound.genre).toEqual([]);
  });

  it('keeps raw genre signals while curating at most three final genres and excluding epic by default', () => {
    const richerAudioDna = {
      ...audioDna,
      semantic: {
        ...audioDna.semantic,
        categories: {
          ...audioDna.semantic!.categories,
          genre: ['Trip Hop', 'Epic', 'Dream Pop', 'Industrial Rock', 'Electronica']
            .map((tag, index) => ({ tag, raw_score: .5 - index * .02, rank: index + 1 })),
        },
      },
    } as AudioDnaPayload;
    fixture.componentRef.setInput('audioDna', richerAudioDna);
    fixture.detectChanges();
    expect(component.genreValues()).toEqual(['Trip Hop', 'Epic', 'Dream Pop', 'Industrial Rock', 'Electronica']);
    expect(component.confirmedGenres).toEqual(['Trip Hop', 'Dream Pop', 'Industrial Rock']);
    component.beginAdjustSound();
    component.toggleSoundLabel('genre', 'Electronica');
    expect(component.confirmedGenres).toEqual(['Trip Hop', 'Dream Pop', 'Industrial Rock']);
  });

  it('shows collaboration fields only when collaboration is enabled', () => {
    expect(fixture.nativeElement.querySelector('input[name="collaborators"]')).toBeNull();
    component.isCollaboration = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[name="collaborators"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('select[name="collaboratorRole"]')).not.toBeNull();
  });

  it('supports promotion chips and treats no campaign planned as an exclusive valid choice', () => {
    component.togglePromotion('Social media');
    component.togglePromotion('YouTube');
    expect(component.selectedPromotionChannels).toEqual(['Social media', 'YouTube']);
    component.togglePromotion('No campaign planned');
    expect(component.selectedPromotionChannels).toEqual(['No campaign planned']);
    component.togglePromotion('Website');
    expect(component.selectedPromotionChannels).toEqual(['Website']);
  });

  it('sends raw and artist-confirmed evidence separately with no audio or loudness metrics', () => {
    component.confirmSound();
    component.songStory = 'Finding clarity.';
    component.isCollaboration = true;
    component.collaborators = 'Ana, RQS';
    component.collaboratorRole = 'producer';
    component.generatePitch();
    const request = dsp.generateSpotifyPitch.calls.mostRecent().args[0] as SpotifyPitchRequest;
    expect(request.release_intelligence.raw_audio_evidence.genre).toEqual(['Trip Hop']);
    expect(request.release_intelligence.artist_confirmed_sound.confirmed).toBeTrue();
    expect(request.release_intelligence.artist_confirmed_sound.genre).toEqual(['Trip Hop']);
    expect(request.release_intelligence.artist_context.collaborators).toEqual([
      { name: 'Ana', role: 'producer' }, { name: 'RQS', role: 'producer' },
    ]);
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
    expect(fixture.nativeElement.textContent).toContain('Genre · Audio Analysis');
    expect(fixture.nativeElement.textContent).toContain('Instrument · Artist confirmed');
  });

  it('renders all four output blocks and evidence provenance', () => {
    component.generatePitch();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="metadata-suggestions"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="editorial-pitch"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="editorial-positioning"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="why-pitch-works"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="evidence-trace"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Alternative Electronic');
  });

  it('marks READY output as an editorial draft for human review', () => {
    component.generatePitch();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="editorial-draft-status"]').textContent)
      .toContain('EDITORIAL DRAFT GENERATED');
    expect(fixture.nativeElement.querySelector('[data-testid="editorial-review-microcopy"]').textContent)
      .toContain('make the final adjustment in your own artistic voice');
  });

  it('renders a graceful UNAVAILABLE state without affecting analysis evidence', () => {
    dsp.generateSpotifyPitch.and.returnValue(of({
      status: 'UNAVAILABLE', metadata_suggestions: { genres: [], moods: [], instruments: [] },
      editorial_pitch: '', editorial_positioning: [], why_this_pitch_works: [], evidence_used: [], warnings: ['OPENAI_TIMEOUT'],
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

  it('regenerate reuses Artist Context and current evidence without audio or another analysis', () => {
    component.songStory = 'A verified story.';
    component.releaseDifference = 'A mature reconstruction.';
    component.whyNow = 'A new phase begins now.';
    component.confirmSound();
    component.generatePitch();
    component.generatePitch();
    expect(dsp.generateSpotifyPitch).toHaveBeenCalledTimes(2);
    const first = dsp.generateSpotifyPitch.calls.argsFor(0)[0];
    const second = dsp.generateSpotifyPitch.calls.argsFor(1)[0];
    expect(second.release_intelligence.artist_context).toEqual(first.release_intelligence.artist_context);
    expect(second.release_intelligence.artist_confirmed_sound).toEqual(first.release_intelligence.artist_confirmed_sound);
    expect(JSON.stringify(second)).not.toMatch(/input_audio|base64|audio_url/);
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
    expect(component.songStory).toBe('');
  });

  it('renders PT-BR copy', () => {
    currentLang.set('pt');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Inteligência de Lançamento com IA');
    expect(fixture.nativeElement.textContent).toContain('GERAR PITCH');
    expect(fixture.nativeElement.textContent).toContain('Contexto do lançamento — opcional');
    expect(fixture.nativeElement.textContent).toContain('Por que lançar esta faixa agora? (opcional)');
    expect(fixture.nativeElement.textContent).toContain('Pode ser uma nova fase, retorno, aniversário');
    expect(fixture.nativeElement.textContent).toContain('14+ dias');
    expect(fixture.nativeElement.textContent).toContain('Você tem 2 de 3 AI Spotify Pitches restantes.');
  });

  it('renders EN copy', () => {
    currentLang.set('en');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('AI Release Intelligence');
    expect(fixture.nativeElement.textContent).toContain('GENERATE PITCH');
    expect(fixture.nativeElement.textContent).toContain('You have 2 of 3 AI Spotify Pitches remaining.');
  });

  it('renders PL copy and sends PL as output language', () => {
    currentLang.set('pl');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Inteligencja wydawnicza AI');
    expect(fixture.nativeElement.textContent).toContain('GENERUJ PITCH');
    expect(fixture.nativeElement.textContent).toContain('Pozostało 2 z 3 AI Spotify Pitches.');
    const request = (component as unknown as { buildRequest(): SpotifyPitchRequest }).buildRequest();
    expect(request.release_intelligence.output_language).toBe('pl');
  });

  it('renders FR copy and sends FR as output language', () => {
    currentLang.set('fr');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Intelligence de sortie par IA');
    expect(fixture.nativeElement.textContent).toContain('GÉNÉRER LE PITCH');
    expect(fixture.nativeElement.textContent).toContain('Il vous reste 2 AI Spotify Pitches sur 3.');
    const request = (component as unknown as { buildRequest(): SpotifyPitchRequest }).buildRequest();
    expect(request.release_intelligence.output_language).toBe('fr');
  });

  it('retains theme-aware classes for light and dark studio shells', () => {
    const styles = (SpotifyPitchPanelComponent as unknown as { ɵcmp: { styles: string[] } })
      .ɵcmp.styles.join(' ');
    expect(styles).toMatch(/app-studio-shell.*data-theme.*light/);
    expect(styles).toContain('--pitch-light-canvas');
    expect(styles).toContain('--studio-text');
  });

  it('defines an editorial light-mode system without changing the dark-mode base', () => {
    const styles = (SpotifyPitchPanelComponent as unknown as { ɵcmp: { styles: string[] } })
      .ɵcmp.styles.join(' ');

    expect(styles).toContain('--pitch-light-canvas');
    expect(styles).toContain('--pitch-light-surface');
    expect(styles).toContain('--pitch-light-text');
    expect(styles).toContain('--pitch-light-text-secondary');
    expect(styles).toContain('--pitch-light-border-strong');
    expect(styles).toContain('clamp(36px, 4.5vw, 44px)');
    expect(styles).toContain('clamp(18px, 2vw, 20px)');
    expect(styles).toContain('button[type=submit]');
    expect(styles).toContain('background: var(--pitch-light-surface);');
  });
});
