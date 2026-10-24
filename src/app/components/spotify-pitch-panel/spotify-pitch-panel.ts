import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  Component, DestroyRef, Input, OnChanges, PLATFORM_ID, SimpleChanges, computed, inject, signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DspService } from '../../services/dsp';
import { LanguageService } from '../../services/language.service';
import {
  AudioDnaPayload, MasteringV2Analysis, OpenAiMusicAnalystPayload,
  SpotifyPitchCollaboratorRole, SpotifyPitchEvidence, SpotifyPitchEvidenceSource,
  SpotifyPitchPromotionChannel, SpotifyPitchRequest, SpotifyPitchResponse,
} from '../../services/mastering-types';

interface PitchCopy {
  eyebrow: string; title: string; subtitle: string;
  masterLabel: string; masterDescription: string; pitchLabel: string; pitchDescription: string;
  evidenceReady: string; pitchReady: string; audioDna: string; genre: string; astral: string;
  instruments: string; technical: string; confirmTitle: string; confirmSubtitle: string;
  detectedGenres: string; atmosphere: string; instrumentation: string; allCorrect: string;
  adjust: string; finishAdjusting: string; contextTitle: string; contextSubtitle: string;
  songStory: string; releaseDifference: string; realContext: string; collaboration: string;
  collaborators: string; collaboratorRole: string; noRole: string; culturalContext: string;
  promotion: string; promotionDetails: string; generate: string; generating: string;
  metadataTitle: string; metadataDisclaimer: string; editorialPitchTitle: string;
  positioningTitle: string; positioningDisclaimer: string; whyTitle: string;
  copyPitch: string; copied: string; regenerate: string; evidenceUsed: string; unavailable: string;
  timingRecommended: string; timingReleaseRadar: string;
  promotionLabels: Record<SpotifyPitchPromotionChannel, string>;
  roleLabels: Record<SpotifyPitchCollaboratorRole, string>;
  sourceLabels: Record<SpotifyPitchEvidenceSource, string>;
}

const EN_PROMOTION_LABELS: Record<SpotifyPitchPromotionChannel, string> = {
  'Social media': 'Social media', YouTube: 'YouTube', 'Music video': 'Music video',
  'Live performance': 'Live performance', 'Press / blogs': 'Press / blogs', Ads: 'Ads',
  'Mailing list': 'Mailing list', Website: 'Website', 'Pre-save': 'Pre-save',
  'No campaign planned': 'No campaign planned',
};
const PT_PROMOTION_LABELS: Record<SpotifyPitchPromotionChannel, string> = {
  'Social media': 'Redes sociais', YouTube: 'YouTube', 'Music video': 'Videoclipe',
  'Live performance': 'Apresentação ao vivo', 'Press / blogs': 'Imprensa / blogs', Ads: 'Anúncios',
  'Mailing list': 'Lista de e-mails', Website: 'Website', 'Pre-save': 'Pre-save',
  'No campaign planned': 'Nenhuma campanha planejada',
};

const COPY: Record<'en' | 'pt', PitchCopy> = {
  en: {
    eyebrow: 'SPOTIFY PITCH ENGINE', title: 'AI Release Intelligence',
    subtitle: 'I have already heard your music. Now tell me what only you can know — if you want to.',
    masterLabel: 'MASTER', masterDescription: 'Prepare the audio for distribution.',
    pitchLabel: 'PITCH', pitchDescription: 'Prepare the release for editorial presentation.',
    evidenceReady: 'MUSIC EVIDENCE', pitchReady: '✓ Pitch ready to generate',
    audioDna: 'Audio DNA', genre: 'Genre', astral: 'Astral', instruments: 'Instruments', technical: 'Technical data',
    confirmTitle: 'HOW YOUR MUSIC SOUNDS',
    confirmSubtitle: 'The analysis found these characteristics. Confirm or adjust them before generating the pitch.',
    detectedGenres: 'Detected genres', atmosphere: 'Atmosphere', instrumentation: 'Instrumentation',
    allCorrect: 'EVERYTHING LOOKS RIGHT', adjust: 'ADJUST', finishAdjusting: 'FINISH ADJUSTING',
    contextTitle: 'Release context — optional',
    contextSubtitle: 'Your music already has enough evidence to generate a pitch. Add context only if you want to make it more personal.',
    songStory: 'Tell the story of the song in one sentence. (optional)',
    releaseDifference: 'What is different about this track? (optional)',
    realContext: 'Is there a real story or context behind it? (optional)',
    collaboration: 'Is this track a collaboration?', collaborators: 'Who took part?',
    collaboratorRole: 'Optional role', noRole: 'No role selected',
    culturalContext: 'Is there any relevant cultural or geographic connection? (optional)',
    promotion: 'How do you plan to promote it? (optional)', promotionDetails: 'Confirmed details (optional)',
    generate: 'GENERATE PITCH', generating: 'GENERATING…',
    metadataTitle: 'SPOTIFY METADATA SUGGESTIONS',
    metadataDisclaimer: 'Suggestions only. Spotify may use different metadata choices.',
    editorialPitchTitle: 'EDITORIAL PITCH', positioningTitle: 'POSSIBLE EDITORIAL POSITIONING',
    positioningDisclaimer: 'Positioning suggestions. They do not predict or guarantee playlist inclusion.',
    whyTitle: 'WHY THIS PITCH WORKS', copyPitch: 'COPY PITCH', copied: 'COPIED', regenerate: 'REGENERATE',
    evidenceUsed: 'EVIDENCE TRACE',
    unavailable: 'Pitch generation is temporarily unavailable. Your analysis and mastering remain active.',
    timingRecommended: 'Recommended: submit your pitch around 14+ days in advance.',
    timingReleaseRadar: 'For Release Radar eligibility, Spotify states at least 7 days before release.',
    promotionLabels: EN_PROMOTION_LABELS,
    roleLabels: { artist: 'Artist', producer: 'Producer', vocalist: 'Vocalist', songwriter: 'Songwriter', instrumentalist: 'Instrumentalist', other: 'Other' },
    sourceLabels: { cocotagger: 'Audio Analysis', openai_music_analyst: 'Music Analyst', rqs_audio_dna: 'Audio DNA', artist_confirmed: 'Artist confirmed', artist_supplied: 'Artist supplied' },
  },
  pt: {
    eyebrow: 'SPOTIFY PITCH ENGINE', title: 'Inteligência de Lançamento com IA',
    subtitle: 'Eu já ouvi sua música. Agora me conte o que só você pode saber — se quiser.',
    masterLabel: 'MASTER', masterDescription: 'Prepare o áudio para distribuição.',
    pitchLabel: 'PITCH', pitchDescription: 'Prepare o lançamento para apresentação editorial.',
    evidenceReady: 'EVIDÊNCIAS MUSICAIS', pitchReady: '✓ Pitch pronto para gerar',
    audioDna: 'Audio DNA', genre: 'Genre', astral: 'Astral', instruments: 'Instruments', technical: 'Dados técnicos',
    confirmTitle: 'COMO SUA MÚSICA SOA',
    confirmSubtitle: 'A análise encontrou estas características. Confirme ou ajuste antes de gerar o pitch.',
    detectedGenres: 'Gêneros detectados', atmosphere: 'Atmosfera', instrumentation: 'Instrumentação',
    allCorrect: 'TUDO CERTO', adjust: 'AJUSTAR', finishAdjusting: 'CONCLUIR AJUSTES',
    contextTitle: 'Contexto do lançamento — opcional',
    contextSubtitle: 'Sua música já tem evidências suficientes para gerar um pitch. Conte mais apenas se quiser torná-lo mais pessoal.',
    songStory: 'Conte a história da música em uma frase. (opcional)',
    releaseDifference: 'O que existe de diferente nesta faixa? (opcional)',
    realContext: 'Existe alguma história real ou contexto por trás dela? (opcional)',
    collaboration: 'Esta faixa é uma colaboração?', collaborators: 'Quem participou?',
    collaboratorRole: 'Função opcional', noRole: 'Sem função selecionada',
    culturalContext: 'Existe alguma ligação cultural ou geográfica relevante? (opcional)',
    promotion: 'Como você pretende divulgar? (opcional)', promotionDetails: 'Detalhes já confirmados (opcional)',
    generate: 'GERAR PITCH', generating: 'GERANDO…',
    metadataTitle: 'SUGESTÕES DE METADADOS PARA SPOTIFY',
    metadataDisclaimer: 'São sugestões. O Spotify pode adotar escolhas de metadados diferentes.',
    editorialPitchTitle: 'PITCH EDITORIAL', positioningTitle: 'POSSÍVEIS DIREÇÕES EDITORIAIS',
    positioningDisclaimer: 'Sugestões de posicionamento. Não representam previsão ou garantia de inclusão em playlists.',
    whyTitle: 'POR QUE ESTE PITCH FUNCIONA', copyPitch: 'COPIAR PITCH', copied: 'COPIADO', regenerate: 'GERAR NOVAMENTE',
    evidenceUsed: 'RASTRO DE EVIDÊNCIAS',
    unavailable: 'A geração do pitch está indisponível. Sua análise e masterização continuam ativas.',
    timingRecommended: 'Recomendado: envie seu pitch com cerca de 14+ dias de antecedência.',
    timingReleaseRadar: 'Para benefício do Release Radar, o Spotify informa pelo menos 7 dias antes do lançamento.',
    promotionLabels: PT_PROMOTION_LABELS,
    roleLabels: { artist: 'Artista', producer: 'Produtor', vocalist: 'Vocalista', songwriter: 'Compositor', instrumentalist: 'Instrumentista', other: 'Outro' },
    sourceLabels: { cocotagger: 'Análise de áudio', openai_music_analyst: 'Music Analyst', rqs_audio_dna: 'Audio DNA', artist_confirmed: 'Confirmado pelo artista', artist_supplied: 'Informado pelo artista' },
  },
};

@Component({ selector: 'app-spotify-pitch-panel', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './spotify-pitch-panel.html', styleUrls: ['./spotify-pitch-panel.scss'] })
export class SpotifyPitchPanelComponent implements OnChanges {
  private readonly dsp = inject(DspService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  readonly lang = inject(LanguageService);

  @Input() analysisMetrics: MasteringV2Analysis | null = null;
  @Input() audioDna: AudioDnaPayload | null = null;
  @Input() openAiMusicAnalyst: OpenAiMusicAnalystPayload | null = null;
  @Input() sourceGeneration: string | null = null;

  songStory = ''; releaseDifference = ''; realContext = ''; isCollaboration = false;
  collaborators = ''; collaboratorRole: SpotifyPitchCollaboratorRole | '' = '';
  culturalGeographicContext = ''; promotionDetails = '';
  selectedPromotionChannels: SpotifyPitchPromotionChannel[] = [];
  confirmedGenres: string[] = []; confirmedAstral: string[] = []; confirmedInstruments: string[] = [];
  adjustingSound = false; soundConfirmed = false;

  readonly promotionOptions: SpotifyPitchPromotionChannel[] = ['Social media', 'YouTube', 'Music video', 'Live performance', 'Press / blogs', 'Ads', 'Mailing list', 'Website', 'Pre-save', 'No campaign planned'];
  readonly collaboratorRoles: SpotifyPitchCollaboratorRole[] = ['artist', 'producer', 'vocalist', 'songwriter', 'instrumentalist', 'other'];
  readonly requestState = signal<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
  readonly result = signal<SpotifyPitchResponse | null>(null);
  readonly copied = signal(false);
  readonly copy = computed(() => COPY[this.lang.currentLang() === 'pt' ? 'pt' : 'en']);
  private requestIndex = 0;
  private soundFingerprint = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['sourceGeneration'] && !changes['sourceGeneration'].firstChange) {
      this.requestIndex += 1; this.requestState.set('idle'); this.result.set(null); this.copied.set(false);
      this.resetArtistContext();
    }
    if (changes['sourceGeneration'] || changes['audioDna'] || changes['openAiMusicAnalyst']) this.syncConfirmedSound();
  }

  hasAudioDna(): boolean { return this.audioDna?.status === 'available'; }
  genreValues(): string[] { return this.semanticValues('genre'); }
  astralValues(): string[] { return this.semanticValues('mood'); }
  instrumentValues(): OpenAiMusicAnalystPayload['instruments'] { return this.openAiMusicAnalyst?.status === 'READY' ? this.openAiMusicAnalyst.instruments : []; }
  rawInstrumentNames(): string[] { return this.instrumentValues().map(item => item.name); }
  hasTechnicalData(): boolean { return Boolean(this.analysisMetrics && this.audioDna?.technical); }
  hasAnyEvidence(): boolean { return this.hasAudioDna() || this.genreValues().length > 0 || this.astralValues().length > 0 || this.instrumentValues().length > 0 || this.hasTechnicalData(); }

  confirmSound(): void { this.soundConfirmed = true; this.adjustingSound = false; }
  beginAdjustSound(): void { this.adjustingSound = true; this.soundConfirmed = false; }
  isSoundLabelSelected(category: 'genre' | 'astral' | 'instruments', value: string): boolean { return this.confirmedList(category).includes(value); }
  toggleSoundLabel(category: 'genre' | 'astral' | 'instruments', value: string): void {
    const current = this.confirmedList(category);
    const next = current.includes(value) ? current.filter(item => item !== value) : [...current, value];
    if (category === 'genre') this.confirmedGenres = next;
    if (category === 'astral') this.confirmedAstral = next;
    if (category === 'instruments') this.confirmedInstruments = next;
    this.soundConfirmed = false;
  }

  isPromotionSelected(channel: SpotifyPitchPromotionChannel): boolean { return this.selectedPromotionChannels.includes(channel); }
  togglePromotion(channel: SpotifyPitchPromotionChannel): void {
    if (channel === 'No campaign planned') {
      this.selectedPromotionChannels = this.isPromotionSelected(channel) ? [] : [channel];
      return;
    }
    const withoutNone = this.selectedPromotionChannels.filter(item => item !== 'No campaign planned');
    this.selectedPromotionChannels = withoutNone.includes(channel) ? withoutNone.filter(item => item !== channel) : [...withoutNone, channel];
  }

  generatePitch(): void {
    if (this.requestState() === 'loading' || !this.hasAnyEvidence()) return;
    const requestIndex = ++this.requestIndex;
    const sourceGeneration = this.sourceGeneration;
    this.requestState.set('loading'); this.copied.set(false);
    this.dsp.generateSpotifyPitch(this.buildRequest()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        if (requestIndex !== this.requestIndex || sourceGeneration !== this.sourceGeneration) return;
        this.result.set(response); this.requestState.set(response.status === 'READY' ? 'ready' : 'unavailable');
      },
      error: () => {
        if (requestIndex !== this.requestIndex || sourceGeneration !== this.sourceGeneration) return;
        this.result.set(null); this.requestState.set('unavailable');
      },
    });
  }

  async copyPitch(): Promise<void> {
    const pitch = this.result()?.editorial_pitch;
    if (!pitch || !isPlatformBrowser(this.platformId) || !navigator.clipboard) return;
    await navigator.clipboard.writeText(pitch); this.copied.set(true);
  }
  sourceLabel(evidence: SpotifyPitchEvidence): string { return this.copy().sourceLabels[evidence.source]; }
  evidenceTypeLabel(evidence: SpotifyPitchEvidence): string {
    const labels: Record<string, string> = {
      genre: 'Genre', astral: 'Astral', instrument: 'Instrument', vocals: 'Vocals', production_element: 'Production',
      bpm: 'BPM', energy: 'Energy', danceability: 'Danceability', sonic_characteristic: 'Sonic profile',
      collaborator: 'Collaboration', release_story: 'Release story', release_difference: 'Release difference',
      real_context: 'Real context', cultural_context: 'Cultural context', promotion_plan: 'Promotion',
    };
    return labels[evidence.type] ?? evidence.type;
  }

  private confirmedList(category: 'genre' | 'astral' | 'instruments'): string[] {
    return category === 'genre' ? this.confirmedGenres : category === 'astral' ? this.confirmedAstral : this.confirmedInstruments;
  }
  private syncConfirmedSound(): void {
    const genres = this.genreValues(); const astral = this.astralValues(); const instruments = this.rawInstrumentNames();
    const fingerprint = JSON.stringify([this.sourceGeneration, genres, astral, instruments]);
    if (fingerprint === this.soundFingerprint) return;
    this.soundFingerprint = fingerprint;
    this.confirmedGenres = [...genres]; this.confirmedAstral = [...astral]; this.confirmedInstruments = [...instruments];
    this.adjustingSound = false; this.soundConfirmed = false;
  }
  private resetArtistContext(): void {
    this.songStory = ''; this.releaseDifference = ''; this.realContext = ''; this.isCollaboration = false;
    this.collaborators = ''; this.collaboratorRole = ''; this.culturalGeographicContext = '';
    this.promotionDetails = ''; this.selectedPromotionChannels = [];
  }
  private semanticValues(category: 'genre' | 'mood'): string[] {
    const semantic = this.audioDna?.semantic;
    if (semantic?.status !== 'READY' || semantic.source_generation !== semantic.analyzer_generation
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
    const collaboratorNames = this.isCollaboration ? this.collaborators.split(',').map(value => value.trim()).filter(Boolean) : [];
    return { release_intelligence: {
      raw_audio_evidence: {
        genre: this.genreValues(), astral: this.astralValues(), instruments: this.instrumentValues(),
        vocals: this.openAiMusicAnalyst?.status === 'READY' ? this.openAiMusicAnalyst.vocals : null,
        production_elements: this.openAiMusicAnalyst?.status === 'READY' ? this.openAiMusicAnalyst.production_elements : [],
        bpm: music?.bpm?.value ?? null, energy: music?.energy ?? null, danceability: music?.danceability ?? null,
        sonic_characteristics: this.sonicCharacteristics(),
      },
      artist_confirmed_sound: { confirmed: this.soundConfirmed, genre: [...this.confirmedGenres], astral: [...this.confirmedAstral], instruments: [...this.confirmedInstruments] },
      artist_context: {
        song_story: this.songStory.trim(), release_difference: this.releaseDifference.trim(), real_context: this.realContext.trim(),
        is_collaboration: this.isCollaboration,
        collaborators: collaboratorNames.map(name => ({ name, role: this.collaboratorRole || null })),
        cultural_geographic_context: this.culturalGeographicContext.trim(),
      },
      promotion_context: { channels: [...this.selectedPromotionChannels], confirmed_details: this.promotionDetails.trim() },
    } };
  }
}
