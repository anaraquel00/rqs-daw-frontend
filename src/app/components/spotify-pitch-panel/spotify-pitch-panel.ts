import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  Input,
  OnChanges,
  PLATFORM_ID,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DspService } from '../../services/dsp';
import { LanguageService } from '../../services/language.service';
import {
  AudioDnaPayload,
  MasteringV2Analysis,
  OpenAiMusicAnalystPayload,
  SpotifyPitchEvidence,
  SpotifyPitchEvidenceSource,
  SpotifyPitchRequest,
  SpotifyPitchResponse,
} from '../../services/mastering-types';

interface PitchCopy {
  eyebrow: string;
  title: string;
  subtitle: string;
  evidenceReady: string;
  audioDna: string;
  genre: string;
  astral: string;
  instruments: string;
  technical: string;
  contextTitle: string;
  songAbout: string;
  collaboration: string;
  collaborators: string;
  importance: string;
  promotion: string;
  generate: string;
  generating: string;
  resultTitle: string;
  copyPitch: string;
  copied: string;
  regenerate: string;
  evidenceUsed: string;
  unavailable: string;
  sourceLabels: Record<SpotifyPitchEvidenceSource, string>;
}

const COPY: Record<'en' | 'pt', PitchCopy> = {
  en: {
    eyebrow: 'SPOTIFY PITCH ENGINE',
    title: 'AI Release Intelligence',
    subtitle: 'Turn verified music evidence and your release context into a grounded Spotify pitch.',
    evidenceReady: 'Music evidence ready',
    audioDna: 'Audio DNA',
    genre: 'Genre',
    astral: 'Astral',
    instruments: 'Instruments',
    technical: 'Technical data',
    contextTitle: 'Tell us about the release',
    songAbout: 'What is this song about?',
    collaboration: 'Is this a collaboration?',
    collaborators: 'Collaborator(s), separated by commas',
    importance: 'What makes this release important?',
    promotion: 'Promotion plans',
    generate: 'GENERATE PITCH',
    generating: 'GENERATING…',
    resultTitle: 'SPOTIFY PITCH',
    copyPitch: 'COPY PITCH',
    copied: 'COPIED',
    regenerate: 'REGENERATE',
    evidenceUsed: 'EVIDENCE USED',
    unavailable: 'Pitch generation is temporarily unavailable. Your analysis and mastering remain active.',
    sourceLabels: {
      cocotagger: 'Audio Analysis',
      openai_music_analyst: 'Music Analyst',
      rqs_audio_dna: 'Audio DNA',
      artist: 'Artist supplied',
    },
  },
  pt: {
    eyebrow: 'SPOTIFY PITCH ENGINE',
    title: 'Inteligência de Lançamento com IA',
    subtitle: 'Transforme evidências musicais verificadas e o contexto do lançamento em um pitch fundamentado.',
    evidenceReady: 'Evidências musicais prontas',
    audioDna: 'Audio DNA',
    genre: 'Genre',
    astral: 'Astral',
    instruments: 'Instruments',
    technical: 'Dados técnicos',
    contextTitle: 'Conte sobre o lançamento',
    songAbout: 'Sobre o que é esta música?',
    collaboration: 'Esta faixa é uma colaboração?',
    collaborators: 'Colaborador(es), separados por vírgulas',
    importance: 'O que torna este lançamento importante?',
    promotion: 'Planos de divulgação',
    generate: 'GERAR PITCH',
    generating: 'GERANDO…',
    resultTitle: 'SPOTIFY PITCH',
    copyPitch: 'COPIAR PITCH',
    copied: 'COPIADO',
    regenerate: 'GERAR NOVAMENTE',
    evidenceUsed: 'EVIDÊNCIAS UTILIZADAS',
    unavailable: 'A geração do pitch está indisponível. Sua análise e masterização continuam ativas.',
    sourceLabels: {
      cocotagger: 'Análise de áudio',
      openai_music_analyst: 'Music Analyst',
      rqs_audio_dna: 'Audio DNA',
      artist: 'Informado pelo artista',
    },
  },
};

@Component({
  selector: 'app-spotify-pitch-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './spotify-pitch-panel.html',
  styleUrls: ['./spotify-pitch-panel.scss'],
})
export class SpotifyPitchPanelComponent implements OnChanges {
  private readonly dsp = inject(DspService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  readonly lang = inject(LanguageService);

  @Input() analysisMetrics: MasteringV2Analysis | null = null;
  @Input() audioDna: AudioDnaPayload | null = null;
  @Input() openAiMusicAnalyst: OpenAiMusicAnalystPayload | null = null;
  @Input() sourceGeneration: string | null = null;

  songAbout = '';
  isCollaboration = false;
  collaborators = '';
  releaseImportance = '';
  promotionPlans = '';

  readonly requestState = signal<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  readonly result = signal<SpotifyPitchResponse | null>(null);
  readonly copied = signal(false);
  readonly copy = computed(() => COPY[this.lang.currentLang() === 'pt' ? 'pt' : 'en']);
  private requestIndex = 0;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sourceGeneration'] && !changes['sourceGeneration'].firstChange) {
      this.requestIndex += 1;
      this.requestState.set('idle');
      this.result.set(null);
      this.copied.set(false);
      this.songAbout = '';
      this.isCollaboration = false;
      this.collaborators = '';
      this.releaseImportance = '';
      this.promotionPlans = '';
    }
  }

  hasAudioDna(): boolean {
    return this.audioDna?.status === 'available';
  }

  genreValues(): string[] {
    return this.semanticValues('genre');
  }

  astralValues(): string[] {
    return this.semanticValues('mood');
  }

  instrumentValues(): OpenAiMusicAnalystPayload['instruments'] {
    return this.openAiMusicAnalyst?.status === 'READY'
      ? this.openAiMusicAnalyst.instruments
      : [];
  }

  hasTechnicalData(): boolean {
    return Boolean(this.analysisMetrics && this.audioDna?.technical);
  }

  hasAnyEvidence(): boolean {
    return this.hasAudioDna()
      || this.genreValues().length > 0
      || this.astralValues().length > 0
      || this.instrumentValues().length > 0
      || this.hasTechnicalData();
  }

  generatePitch(): void {
    if (this.requestState() === 'loading' || !this.hasAnyEvidence()) return;
    const requestIndex = ++this.requestIndex;
    const sourceGeneration = this.sourceGeneration;
    this.requestState.set('loading');
    this.copied.set(false);
    this.dsp.generateSpotifyPitch(this.buildRequest())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => {
          if (requestIndex !== this.requestIndex || sourceGeneration !== this.sourceGeneration) return;
          this.result.set(response);
          this.requestState.set(response.status === 'READY' ? 'ready' : 'unavailable');
        },
        error: () => {
          if (requestIndex !== this.requestIndex || sourceGeneration !== this.sourceGeneration) return;
          this.result.set(null);
          this.requestState.set('unavailable');
        },
      });
  }

  async copyPitch(): Promise<void> {
    const pitch = this.result()?.spotify_pitch;
    if (!pitch || !isPlatformBrowser(this.platformId) || !navigator.clipboard) return;
    await navigator.clipboard.writeText(pitch);
    this.copied.set(true);
  }

  sourceLabel(evidence: SpotifyPitchEvidence): string {
    return this.copy().sourceLabels[evidence.source];
  }

  evidenceTypeLabel(evidence: SpotifyPitchEvidence): string {
    const labels: Record<string, string> = {
      genre: 'Genre', astral: 'Astral', instrument: 'Instrument', vocals: 'Vocals',
      production_element: 'Production', bpm: 'BPM', energy: 'Energy',
      danceability: 'Danceability', sonic_characteristic: 'Sonic profile',
      collaborator: 'Collaboration', release_story: 'Release story', promotion_plan: 'Promotion',
    };
    return labels[evidence.type] ?? evidence.type;
  }

  private semanticValues(category: 'genre' | 'mood'): string[] {
    const semantic = this.audioDna?.semantic;
    if (semantic?.status !== 'READY'
      || semantic.source_generation !== semantic.analyzer_generation
      || (this.sourceGeneration && semantic.source_generation !== this.sourceGeneration)) return [];
    return (semantic.categories[category] ?? []).map(item => item.tag).filter(Boolean);
  }

  private sonicCharacteristics(): string[] {
    const technical = this.audioDna?.technical;
    if (!technical) return [];
    const result: string[] = [];
    if (technical.brightness !== undefined) result.push(technical.brightness >= 0.6 ? 'Bright tonal balance' : 'Warm tonal balance');
    if (technical.stereo_width !== undefined) result.push(technical.stereo_width >= 0.6 ? 'Wide stereo image' : 'Focused stereo image');
    if (technical.transient_strength !== undefined && technical.transient_strength >= 0.6) result.push('Pronounced transients');
    if (technical.low_end_density !== undefined && technical.low_end_density >= 0.6) result.push('Strong low-end density');
    if (technical.dynamic_density !== undefined && technical.dynamic_density >= 0.6) result.push('Dense dynamics');
    return result;
  }

  private buildRequest(): SpotifyPitchRequest {
    const music = this.audioDna?.music;
    return {
      release_intelligence: {
        audio_intelligence: {
          genre: this.genreValues(),
          astral: this.astralValues(),
          instruments: this.instrumentValues(),
          vocals: this.openAiMusicAnalyst?.status === 'READY' ? this.openAiMusicAnalyst.vocals : null,
          production_elements: this.openAiMusicAnalyst?.status === 'READY'
            ? this.openAiMusicAnalyst.production_elements
            : [],
          bpm: music?.bpm?.value ?? null,
          energy: music?.energy ?? null,
          danceability: music?.danceability ?? null,
          sonic_characteristics: this.sonicCharacteristics(),
        },
        artist_context: {
          song_about: this.songAbout.trim(),
          is_collaboration: this.isCollaboration,
          collaborators: this.isCollaboration
            ? this.collaborators.split(',').map(value => value.trim()).filter(Boolean)
            : [],
          release_importance: this.releaseImportance.trim(),
          promotion_plans: this.promotionPlans.trim(),
        },
      },
    };
  }
}
