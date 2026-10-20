import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LanguageService, UiLanguage } from '../../services/language.service';
import { AuthService } from '../../services/auth.service';
import { AudioComparisonService, AudioVariant } from '../../services/audio-comparison.service';
import { DspService } from '../../services/dsp';
import { MasteringService } from '../../services/mastering.service';
import {
  AudioDnaPayload,
  MasteringAtmosphere,
  MasteringDeliveryTargetCapabilities,
  MasteringDestination,
  MasteringPlatform,
  MasteringProcessCommand,
  MasteringV2Capabilities,
  SoundCloudMode,
} from '../../services/mastering-types';
import { MasteringHelpTopic, masteringEducation } from './mastering-education';
import { PreviewWaveformComponent } from './preview-waveform';

type AudioDnaUiLanguage = UiLanguage | 'fr';

interface AudioDnaCopy {
  title: string;
  technicalEyebrow: string;
  technicalSubtitle: string;
  analyzing: string;
  unavailableTitle: string;
  unavailableBody: string;
  spectralProfile: string;
  lowEnd: string;
  stereoImage: string;
  transients: string;
  harshness: string;
  dynamics: string;
  warmDark: string;
  darkLeaning: string;
  brightOpen: string;
  balanced: string;
  strong: string;
  solid: string;
  restrained: string;
  spacious: string;
  focused: string;
  narrow: string;
  pronounced: string;
  preserved: string;
  soft: string;
  low: string;
  controlled: string;
  elevated: string;
  open: string;
  healthy: string;
  compressed: string;
  masterSuggested: string;
  atmosphere: string;
  characterIntensity: string;
  confidence: string;
  confidenceLow: string;
  confidenceMedium: string;
  confidenceHigh: string;
  recommended: string;
  manualOverride: string;
  inconclusive: string;
  evidencePrefix: string;
  evidenceFallback: string;
  restrainedSuffix: string;
  atmosphereNote: string;
  resetRecommendation: string;
  tempo: string;
  possibleDoubleTime: string;
  possibleHalfTime: string;
  possibleAlternative: string;
  key: string;
  experimentalLowConfidence: string;
  experimentalMediumConfidence: string;
  experimentalHighConfidence: string;
  musicDna: string;
  experimental: string;
  semanticBody: string;
  releaseAssistant: string;
  releaseReview: string;
  advancedDetails: string;
  duration: string;
  brightness: string;
  warmth: string;
  transientStrength: string;
  stereoWidth: string;
  lowEndDensity: string;
  dynamicDensity: string;
  overallEnergy: string;
  waiting: string;
  characterSliderLabel: string;
}

const AUDIO_DNA_COPY: Record<AudioDnaUiLanguage, AudioDnaCopy> = {
  en: {
    title: 'RQS AUDIO DNA', technicalEyebrow: 'TECHNICAL AUDIO DNA',
    technicalSubtitle: 'A clear reading of the sound measured in your final audio.',
    analyzing: 'Analyzing technical characteristics…', unavailableTitle: 'Audio DNA unavailable',
    unavailableBody: 'Technical analysis and mastering remain available.',
    spectralProfile: 'Spectral profile', lowEnd: 'Low-end', stereoImage: 'Stereo image',
    transients: 'Transients', harshness: 'Harshness', dynamics: 'Dynamics',
    warmDark: 'Warm / dark-leaning', darkLeaning: 'Dark-leaning', brightOpen: 'Bright / open', balanced: 'Balanced',
    strong: 'Strong', solid: 'Solid', restrained: 'Restrained', spacious: 'Spacious', focused: 'Focused', narrow: 'Narrow',
    pronounced: 'Pronounced', preserved: 'Preserved', soft: 'Soft', low: 'Low', controlled: 'Controlled', elevated: 'Elevated',
    open: 'Open', healthy: 'Healthy', compressed: 'Compressed',
    masterSuggested: 'MASTER PROFILE SUGGESTED', atmosphere: 'Atmosphere', characterIntensity: 'Character Intensity',
    confidence: 'Confidence', confidenceLow: 'Low', confidenceMedium: 'Medium', confidenceHigh: 'High',
    recommended: 'Recommended by Audio DNA', manualOverride: 'Manual override', inconclusive: 'Inconclusive analysis',
    evidencePrefix: 'Technical evidence', evidenceFallback: 'The recommendation uses only measurements from the final audio.',
    restrainedSuffix: 'The suggested Character remains restrained to preserve the source dynamics.',
    atmosphereNote: 'Atmosphere is the recommended sonic profile; V2 currently uses the same compatibility DSP path.',
    resetRecommendation: 'Reset to recommendation', tempo: 'Tempo', possibleDoubleTime: 'Possible double-time',
    possibleHalfTime: 'Possible half-time', possibleAlternative: 'Possible alternative', key: 'Key',
    experimentalLowConfidence: 'Experimental / low confidence', experimentalMediumConfidence: 'Experimental / medium confidence',
    experimentalHighConfidence: 'Experimental / high confidence', musicDna: 'MUSIC DNA', experimental: 'EXPERIMENTAL',
    semanticBody: 'The experimental semantic analysis does not yet have enough evidence to classify genre, mood, instrumentation and vocals reliably.',
    releaseAssistant: 'RELEASE ASSISTANT — EXPERIMENTAL',
    releaseReview: 'Detected metadata must be reviewed manually before publishing. Nothing is filled automatically.',
    advancedDetails: 'ADVANCED AUDIO DETAILS', duration: 'Duration', brightness: 'Brightness', warmth: 'Warmth',
    transientStrength: 'Transient strength', stereoWidth: 'Stereo width', lowEndDensity: 'Low-end density',
    dynamicDensity: 'Dynamic density', overallEnergy: 'Overall energy', waiting: 'Waiting for audio analysis.',
    characterSliderLabel: 'Mastering Character intensity',
  },
  pt: {
    title: 'RQS AUDIO DNA', technicalEyebrow: 'AUDIO DNA TÉCNICO',
    technicalSubtitle: 'Uma leitura clara do som medido no seu áudio final.',
    analyzing: 'Analisando características técnicas…', unavailableTitle: 'Audio DNA indisponível',
    unavailableBody: 'A análise técnica e a masterização continuam disponíveis.',
    spectralProfile: 'Perfil espectral', lowEnd: 'Graves', stereoImage: 'Imagem estéreo',
    transients: 'Transientes', harshness: 'Aspereza', dynamics: 'Dinâmica',
    warmDark: 'Quente / tendendo ao escuro', darkLeaning: 'Tendendo ao escuro', brightOpen: 'Brilhante / aberto', balanced: 'Equilibrado',
    strong: 'Forte', solid: 'Sólido', restrained: 'Contido', spacious: 'Espaçosa', focused: 'Focada', narrow: 'Estreita',
    pronounced: 'Pronunciados', preserved: 'Preservados', soft: 'Suaves', low: 'Baixa', controlled: 'Controlada', elevated: 'Elevada',
    open: 'Aberta', healthy: 'Saudável', compressed: 'Comprimida',
    masterSuggested: 'PERFIL DE MASTER SUGERIDO', atmosphere: 'Atmosphere', characterIntensity: 'Intensidade de Character',
    confidence: 'Confiança', confidenceLow: 'Baixa', confidenceMedium: 'Média', confidenceHigh: 'Alta',
    recommended: 'Recomendado pelo Audio DNA', manualOverride: 'Ajuste manual', inconclusive: 'Análise inconclusiva',
    evidencePrefix: 'Evidência técnica', evidenceFallback: 'A recomendação usa apenas medições do áudio final.',
    restrainedSuffix: 'O Character sugerido permanece contido para preservar a dinâmica da fonte.',
    atmosphereNote: 'Atmosphere representa o perfil sonoro recomendado; o V2 usa atualmente o mesmo caminho DSP de compatibilidade.',
    resetRecommendation: 'Restaurar recomendação', tempo: 'Tempo', possibleDoubleTime: 'Possível double-time',
    possibleHalfTime: 'Possível half-time', possibleAlternative: 'Alternativa possível', key: 'Tonalidade',
    experimentalLowConfidence: 'Experimental / baixa confiança', experimentalMediumConfidence: 'Experimental / confiança média',
    experimentalHighConfidence: 'Experimental / alta confiança', musicDna: 'MUSIC DNA', experimental: 'EXPERIMENTAL',
    semanticBody: 'A análise semântica ainda não encontrou evidência suficiente para classificar gênero, mood, instrumentos e voz com confiança.',
    releaseAssistant: 'RELEASE ASSISTANT — EXPERIMENTAL',
    releaseReview: 'Os metadados detectados devem ser revisados manualmente antes da publicação. Nada é preenchido automaticamente.',
    advancedDetails: 'DETALHES AVANÇADOS DO ÁUDIO', duration: 'Duração', brightness: 'Brilho', warmth: 'Calor',
    transientStrength: 'Força dos transientes', stereoWidth: 'Largura estéreo', lowEndDensity: 'Densidade dos graves',
    dynamicDensity: 'Densidade dinâmica', overallEnergy: 'Energia geral', waiting: 'Aguardando análise do áudio.',
    characterSliderLabel: 'Intensidade de Character da masterização',
  },
  pl: {
    title: 'RQS AUDIO DNA', technicalEyebrow: 'TECHNICZNE AUDIO DNA',
    technicalSubtitle: 'Czytelny opis brzmienia zmierzonego w gotowym nagraniu.',
    analyzing: 'Analizowanie cech technicznych…', unavailableTitle: 'Audio DNA niedostępne',
    unavailableBody: 'Analiza techniczna i mastering pozostają dostępne.',
    spectralProfile: 'Profil widmowy', lowEnd: 'Niskie pasmo', stereoImage: 'Obraz stereo',
    transients: 'Transjenty', harshness: 'Ostrość', dynamics: 'Dynamika',
    warmDark: 'Ciepły / ciemniejszy', darkLeaning: 'Ciemniejszy', brightOpen: 'Jasny / otwarty', balanced: 'Zrównoważony',
    strong: 'Mocne', solid: 'Stabilne', restrained: 'Powściągliwe', spacious: 'Przestrzenny', focused: 'Skupiony', narrow: 'Wąski',
    pronounced: 'Wyraźne', preserved: 'Zachowane', soft: 'Łagodne', low: 'Niska', controlled: 'Kontrolowana', elevated: 'Podwyższona',
    open: 'Otwarta', healthy: 'Zdrowa', compressed: 'Skompresowana',
    masterSuggested: 'SUGEROWANY PROFIL MASTERU', atmosphere: 'Atmosphere', characterIntensity: 'Intensywność Character',
    confidence: 'Pewność', confidenceLow: 'Niska', confidenceMedium: 'Średnia', confidenceHigh: 'Wysoka',
    recommended: 'Rekomendacja Audio DNA', manualOverride: 'Ustawienie ręczne', inconclusive: 'Analiza niejednoznaczna',
    evidencePrefix: 'Dane techniczne', evidenceFallback: 'Rekomendacja korzysta wyłącznie z pomiarów gotowego nagrania.',
    restrainedSuffix: 'Sugerowany Character pozostaje powściągliwy, aby zachować dynamikę źródła.',
    atmosphereNote: 'Atmosphere oznacza zalecany profil brzmieniowy; V2 korzysta obecnie z tej samej zgodnej ścieżki DSP.',
    resetRecommendation: 'Przywróć rekomendację', tempo: 'Tempo', possibleDoubleTime: 'Możliwe double-time',
    possibleHalfTime: 'Możliwe half-time', possibleAlternative: 'Możliwa alternatywa', key: 'Tonacja',
    experimentalLowConfidence: 'Eksperymentalne / niska pewność', experimentalMediumConfidence: 'Eksperymentalne / średnia pewność',
    experimentalHighConfidence: 'Eksperymentalne / wysoka pewność', musicDna: 'MUSIC DNA', experimental: 'EKSPERYMENTALNE',
    semanticBody: 'Eksperymentalna analiza semantyczna nie ma jeszcze wystarczających danych, aby wiarygodnie sklasyfikować gatunek, nastrój, instrumentarium i wokal.',
    releaseAssistant: 'RELEASE ASSISTANT — EKSPERYMENTALNY',
    releaseReview: 'Wykryte metadane wymagają ręcznej weryfikacji przed publikacją. Nic nie jest uzupełniane automatycznie.',
    advancedDetails: 'ZAAWANSOWANE DANE AUDIO', duration: 'Czas trwania', brightness: 'Jasność', warmth: 'Ciepło',
    transientStrength: 'Siła transjentów', stereoWidth: 'Szerokość stereo', lowEndDensity: 'Gęstość dołu',
    dynamicDensity: 'Gęstość dynamiczna', overallEnergy: 'Ogólna energia', waiting: 'Oczekiwanie na analizę audio.',
    characterSliderLabel: 'Intensywność Character masteringu',
  },
  fr: {
    title: 'RQS AUDIO DNA', technicalEyebrow: 'AUDIO DNA TECHNIQUE',
    technicalSubtitle: 'Une lecture claire du son mesuré dans votre audio final.',
    analyzing: 'Analyse des caractéristiques techniques…', unavailableTitle: 'Audio DNA indisponible',
    unavailableBody: 'L’analyse technique et le mastering restent disponibles.',
    spectralProfile: 'Profil spectral', lowEnd: 'Graves', stereoImage: 'Image stéréo',
    transients: 'Transitoires', harshness: 'Agressivité', dynamics: 'Dynamique',
    warmDark: 'Chaud / plutôt sombre', darkLeaning: 'Plutôt sombre', brightOpen: 'Brillant / ouvert', balanced: 'Équilibré',
    strong: 'Forts', solid: 'Solides', restrained: 'Retenus', spacious: 'Spacieuse', focused: 'Ciblée', narrow: 'Étroite',
    pronounced: 'Prononcées', preserved: 'Préservées', soft: 'Douces', low: 'Faible', controlled: 'Maîtrisée', elevated: 'Élevée',
    open: 'Ouverte', healthy: 'Saine', compressed: 'Compressée',
    masterSuggested: 'PROFIL DE MASTER SUGGÉRÉ', atmosphere: 'Atmosphere', characterIntensity: 'Intensité Character',
    confidence: 'Confiance', confidenceLow: 'Faible', confidenceMedium: 'Moyenne', confidenceHigh: 'Élevée',
    recommended: 'Recommandé par Audio DNA', manualOverride: 'Réglage manuel', inconclusive: 'Analyse non concluante',
    evidencePrefix: 'Données techniques', evidenceFallback: 'La recommandation utilise uniquement les mesures de l’audio final.',
    restrainedSuffix: 'Le Character suggéré reste mesuré afin de préserver la dynamique de la source.',
    atmosphereNote: 'Atmosphere représente le profil sonore recommandé ; V2 utilise actuellement le même chemin DSP de compatibilité.',
    resetRecommendation: 'Restaurer la recommandation', tempo: 'Tempo', possibleDoubleTime: 'Double-time possible',
    possibleHalfTime: 'Half-time possible', possibleAlternative: 'Alternative possible', key: 'Tonalité',
    experimentalLowConfidence: 'Expérimental / confiance faible', experimentalMediumConfidence: 'Expérimental / confiance moyenne',
    experimentalHighConfidence: 'Expérimental / confiance élevée', musicDna: 'MUSIC DNA', experimental: 'EXPÉRIMENTAL',
    semanticBody: 'L’analyse sémantique expérimentale ne dispose pas encore de suffisamment de données pour classer de façon fiable le genre, l’ambiance, l’instrumentation et les voix.',
    releaseAssistant: 'RELEASE ASSISTANT — EXPÉRIMENTAL',
    releaseReview: 'Les métadonnées détectées doivent être vérifiées manuellement avant publication. Rien n’est rempli automatiquement.',
    advancedDetails: 'DÉTAILS AUDIO AVANCÉS', duration: 'Durée', brightness: 'Brillance', warmth: 'Chaleur',
    transientStrength: 'Force des transitoires', stereoWidth: 'Largeur stéréo', lowEndDensity: 'Densité des graves',
    dynamicDensity: 'Densité dynamique', overallEnergy: 'Énergie globale', waiting: 'En attente de l’analyse audio.',
    characterSliderLabel: 'Intensité Character du mastering',
  },
};

@Component({
  selector: 'app-mastering-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, PreviewWaveformComponent],
  templateUrl: './mastering-panel.html',
  styleUrls: ['./mastering-panel.scss'],
})
export class MasteringPanelComponent implements OnInit, OnChanges, OnDestroy {
  readonly lang = inject(LanguageService);
  readonly auth = inject(AuthService);
  readonly audioComparison = inject(AudioComparisonService);
  private readonly dspService = inject(DspService);
  private readonly masteringService = inject(MasteringService);
  private readonly platformId = inject(PLATFORM_ID);
  joiningWaitlist = false;
  joinedWaitlist = false;
  waitlistError = false;

  @Input() originalFile: File | null = null;
  @Input() isProcessing = false;
  @Input() masteredAudioUrl: string | null = null;
  @Input() isFullMaster = false;
  @Input() audioDna: AudioDnaPayload | null = null;
  @Input() audioDnaLoading = false;
  @Input() audioDnaUnavailable = false;
  @Input() audioSourceId: string | null = null;

  @Output() processMaster = new EventEmitter<MasteringProcessCommand>();
  @Output() configChanged = new EventEmitter<void>();

  readonly destination = this.masteringService.destination;
  readonly platform = this.masteringService.platform;
  readonly atmosphere = this.masteringService.atmosphere;
  readonly intensityPercent = this.masteringService.intensityPercent;
  readonly requestedLufs = this.masteringService.requestedLufs;
  readonly soundcloudMode = this.masteringService.soundcloudMode;
  readonly masterProfileSource = this.masteringService.masterProfileSource;
  readonly audioDnaRecommendation = this.masteringService.audioDnaRecommendation;

  readonly capabilities = signal<MasteringV2Capabilities | null>(null);
  readonly capabilitiesError = signal<string | null>(null);
  readonly activeHelpTopic = signal<MasteringHelpTopic | null>(null);
  readonly guideOpen = signal(false);
  readonly configInvalidatedResult = signal(false);
  private originalObjectUrl: string | null = null;

  readonly education = computed(() => masteringEducation(this.lang.currentLang()));
  readonly audioDnaCopy = computed(() => AUDIO_DNA_COPY[this.lang.currentLang()]);
  readonly capabilitiesLoading = computed(() => this.capabilities() === null && this.capabilitiesError() === null);

  readonly previewWindowString = computed(() => {
    const start = this.audioComparison.previewStart();
    const end = this.audioComparison.previewEnd();
    return `${this.formatarTempo(start)} – ${this.formatarTempo(end)}`;
  });

  readonly activeHelp = computed(() => {
    const topic = this.activeHelpTopic();
    return topic ? this.education().controls[topic] : null;
  });

  readonly activeTarget = computed<MasteringDeliveryTargetCapabilities | null>(() => {
    const capabilities = this.capabilities();
    if (!capabilities) return null;

    const destination = this.destination();
    if (destination === 'club' || destination === 'festival') {
      return capabilities.destinations[destination].target;
    }

    const platform = this.platform();
    if (!platform) return null;
    const mode: SoundCloudMode = platform === 'soundcloud' ? this.soundcloudMode() : 'standard';
    return capabilities.destinations.streaming.platforms[platform][mode] ?? null;
  });

  readonly requestedLufsError = computed<string | null>(() => {
    const target = this.activeTarget();
    const requested = this.requestedLufs();
    if (!target || requested === null) return null;
    if (requested < target.min_lufs || requested > target.max_lufs) {
      return this.education().invalidLufs(target.min_lufs, target.max_lufs);
    }
    return null;
  });

  readonly requestReady = computed(() => {
    return this.capabilities() !== null
      && this.capabilitiesError() === null
      && this.activeTarget() !== null
      && this.requestedLufsError() === null;
  });

  readonly renderBlockReason = computed<string | null>(() => {
    if (this.capabilitiesLoading()) {
      if (this.lang.currentLang() === 'pl') return 'Ładowanie polityki masteringu z backendu…';
      if (this.lang.currentLang() === 'pt') return 'Carregando a política de masterização do backend…';
      return 'Loading the mastering policy from the backend…';
    }
    if (this.capabilitiesError()) return this.capabilitiesError();
    if (!this.activeTarget()) {
      if (this.lang.currentLang() === 'pl') return 'Nie znaleziono polityki dla wybranego zastosowania.';
      if (this.lang.currentLang() === 'pt') return 'A política do destino selecionado não está disponível.';
      return 'The selected destination policy is unavailable.';
    }
    return this.requestedLufsError();
  });

  ngOnInit(): void {
    this.dspService.getMasteringV2Capabilities().subscribe({
      next: (capabilities) => {
        if (capabilities.engine !== 'rqs-core-mastering-v2') {
          this.capabilities.set(null);
          this.capabilitiesError.set(`Unexpected mastering engine: ${capabilities.engine}`);
          return;
        }
        this.capabilities.set(capabilities);
        this.capabilitiesError.set(null);
      },
      error: () => {
        this.capabilities.set(null);
        if (this.lang.currentLang() === 'pl') {
          this.capabilitiesError.set('Nie można pobrać kontraktu Mastering V2.');
        } else if (this.lang.currentLang() === 'pt') {
          this.capabilitiesError.set('Não foi possível carregar o contrato Mastering V2.');
        } else {
          this.capabilitiesError.set('Mastering V2 contract is unavailable.');
        }
      },
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['originalFile']) {
      this.releaseOriginalObjectUrl();
      this.configInvalidatedResult.set(false);
      if (this.originalFile && isPlatformBrowser(this.platformId)) {
        this.originalObjectUrl = window.URL.createObjectURL(this.originalFile);
        this.audioComparison.setOriginalSrc(
          this.originalObjectUrl,
          this.masteringService.previewStartSeconds(),
        );
      }
    }

    if (changes['masteredAudioUrl']) {
      if (this.masteredAudioUrl) {
        const mode = this.isFullMaster ? 'full-track' : 'preview-15s';
        this.audioComparison.setMasterSrc(this.masteredAudioUrl, mode);
        this.configInvalidatedResult.set(false);
      } else {
        this.audioComparison.clearMasterSrc();
      }
    }

    if ((changes['audioDna'] || changes['audioSourceId'])
        && this.audioSourceId
        && this.audioDna?.status === 'available'
        && this.audioDna.master_profile) {
      this.masteringService.initializeFromAudioDna(this.audioSourceId, this.audioDna.master_profile);
    }
  }

  selectDestination(value: MasteringDestination): void {
    if (this.isProcessing || this.destination() === value) return;
    this.masteringService.setDestination(value);
    this.notifyConfigChanged();
  }

  selectPlatform(value: MasteringPlatform): void {
    if (this.isProcessing || this.platform() === value) return;
    this.masteringService.setPlatform(value);
    this.notifyConfigChanged();
  }

  selectAtmosphere(value: MasteringAtmosphere): void {
    if (this.isProcessing || this.atmosphere() === value) return;
    this.masteringService.setAtmosphere(value);
    this.notifyConfigChanged();
  }

  selectSoundCloudMode(value: SoundCloudMode): void {
    if (this.isProcessing || this.soundcloudMode() === value) return;
    this.masteringService.setSoundCloudMode(value);
    this.notifyConfigChanged();
  }

  updateIntensity(event: Event): void {
    if (this.isProcessing) return;
    const value = Number((event.target as HTMLInputElement).value);
    const normalized = Math.max(0, Math.min(100, Math.round(value)));
    if (normalized === this.intensityPercent()) return;
    this.masteringService.setIntensityPercent(normalized);
    this.notifyConfigChanged();
  }

  resetToAudioDna(): void {
    if (this.isProcessing || !this.masteringService.resetToAudioDnaRecommendation()) return;
    this.notifyConfigChanged();
  }

  confidencePercent(value: number): number {
    return Math.round(Math.max(0, Math.min(1, value)) * 100);
  }

  atmosphereLabel(value: MasteringAtmosphere): string {
    return value.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
  }

  spectralProfileLabel(): string {
    const copy = this.audioDnaCopy();
    const brightness = this.audioDna?.technical.brightness;
    const warmth = this.audioDna?.technical.warmth;
    if (brightness === undefined || warmth === undefined) return '—';
    if (brightness < 0.35 && warmth >= 0.48) return copy.warmDark;
    if (brightness < 0.35) return copy.darkLeaning;
    if (brightness >= 0.68) return copy.brightOpen;
    return copy.balanced;
  }

  lowEndLabel(): string {
    const value = this.audioDna?.technical.low_end_density;
    if (value === undefined) return '—';
    if (value >= 0.72) return this.audioDnaCopy().strong;
    if (value >= 0.45) return this.audioDnaCopy().solid;
    return this.audioDnaCopy().restrained;
  }

  stereoImageLabel(): string {
    const value = this.audioDna?.technical.stereo_width;
    if (value === undefined) return '—';
    if (value >= 0.50) return this.audioDnaCopy().spacious;
    if (value >= 0.28) return this.audioDnaCopy().focused;
    return this.audioDnaCopy().narrow;
  }

  transientLabel(): string {
    const value = this.audioDna?.technical.transient_strength;
    if (value === undefined) return '—';
    if (value >= 0.65) return this.audioDnaCopy().pronounced;
    if (value >= 0.32) return this.audioDnaCopy().preserved;
    return this.audioDnaCopy().soft;
  }

  harshnessLabel(): string {
    const value = this.audioDna?.technical.harshness;
    if (value === undefined) return '—';
    if (value < 0.30) return this.audioDnaCopy().low;
    if (value < 0.60) return this.audioDnaCopy().controlled;
    return this.audioDnaCopy().elevated;
  }

  dynamicsLabel(): string {
    const technical = this.audioDna?.technical;
    if (!technical || technical.dynamic_density === undefined) return '—';
    if (technical.dynamic_density >= 0.72 || technical.crest_factor_db < 7.5) {
      return this.audioDnaCopy().compressed;
    }
    if (technical.crest_factor_db >= 14.0) return this.audioDnaCopy().open;
    return this.audioDnaCopy().healthy;
  }

  confidenceLevelLabel(level: 'low' | 'medium' | 'high'): string {
    const copy = this.audioDnaCopy();
    if (level === 'high') return copy.confidenceHigh;
    if (level === 'medium') return copy.confidenceMedium;
    return copy.confidenceLow;
  }

  tempoConfidenceLabel(confidence: number): string {
    if (confidence >= 0.75) return this.audioDnaCopy().confidenceHigh;
    if (confidence >= 0.45) return this.audioDnaCopy().confidenceMedium;
    return this.audioDnaCopy().confidenceLow;
  }

  tempoOctaveAlternative(): NonNullable<NonNullable<AudioDnaPayload['music']>['bpm']['alternatives']>[number] | null {
    return this.audioDna?.music?.bpm.alternatives.find(
      (candidate) => candidate.relation === 'double_time' || candidate.relation === 'half_time',
    ) ?? null;
  }

  tempoAlternativeLabel(relation: 'half_time' | 'double_time' | 'competing_periodicity'): string {
    if (relation === 'double_time') return this.audioDnaCopy().possibleDoubleTime;
    if (relation === 'half_time') return this.audioDnaCopy().possibleHalfTime;
    return this.audioDnaCopy().possibleAlternative;
  }

  experimentalKeyConfidenceLabel(confidence: number): string {
    const copy = this.audioDnaCopy();
    if (confidence >= 0.75) return copy.experimentalHighConfidence;
    if (confidence >= 0.45) return copy.experimentalMediumConfidence;
    return copy.experimentalLowConfidence;
  }

  audioDnaReasonText(): string {
    const reasons = this.audioDna?.master_profile?.reasons ?? [];
    const language = this.lang.currentLang();
    const labels: Record<string, Record<AudioDnaUiLanguage, string>> = {
      WIDE_STEREO_IMAGE: { en: 'a wide stereo image', pt: 'imagem estéreo ampla', pl: 'szeroki obraz stereo', fr: 'une image stéréo large' },
      SPACIOUS_IMAGE: { en: 'a spacious stereo image', pt: 'imagem estéreo espaçosa', pl: 'przestrzenny obraz stereo', fr: 'une image stéréo spacieuse' },
      PRESERVED_TRANSIENTS: { en: 'preserved transients', pt: 'transientes preservados', pl: 'zachowane transjenty', fr: 'des transitoires préservées' },
      LOW_HARSHNESS: { en: 'low harshness', pt: 'baixa aspereza', pl: 'niska ostrość', fr: 'une faible agressivité' },
      WARM_SPECTRAL_BALANCE: { en: 'a warm spectral balance', pt: 'balanço espectral quente', pl: 'ciepła równowaga widmowa', fr: 'un équilibre spectral chaud' },
      MODERATE_ENERGY: { en: 'moderate energy', pt: 'energia moderada', pl: 'umiarkowana energia', fr: 'une énergie modérée' },
      DENSE_LOW_END: { en: 'a dense low-end', pt: 'graves densos', pl: 'gęste niskie pasmo', fr: 'des graves denses' },
      HIGH_ENERGY: { en: 'high energy', pt: 'energia alta', pl: 'wysoka energia', fr: 'une énergie élevée' },
      HIGH_DYNAMIC_DENSITY: { en: 'high dynamic density', pt: 'alta densidade dinâmica', pl: 'wysoka gęstość dynamiczna', fr: 'une densité dynamique élevée' },
      BRIGHT_SPECTRAL_BALANCE: { en: 'a bright spectral balance', pt: 'balanço espectral brilhante', pl: 'jasna równowaga widmowa', fr: 'un équilibre spectral brillant' },
      DENSE_SOURCE_RESTRAINT: { en: 'a dense source', pt: 'uma fonte densa', pl: 'gęste źródło', fr: 'une source dense' },
      HIGH_LRA_RESTRAINT: { en: 'a wide loudness range', pt: 'ampla faixa de loudness', pl: 'szeroki zakres głośności', fr: 'une large plage de sonie' },
      HARSH_SOURCE_RESTRAINT: { en: 'elevated harshness', pt: 'aspereza elevada', pl: 'podwyższona ostrość', fr: 'une agressivité élevée' },
      STRONG_TRANSIENT_RESTRAINT: { en: 'strong transients', pt: 'transientes fortes', pl: 'silne transjenty', fr: 'des transitoires fortes' },
      INCONCLUSIVE_TECHNICAL_DNA: { en: 'inconclusive technical evidence', pt: 'evidência técnica inconclusiva', pl: 'niejednoznaczne dane techniczne', fr: 'des données techniques non concluantes' },
    };
    const evidence = reasons
      .map((reason) => labels[reason.code]?.[language])
      .filter((label): label is string => Boolean(label));
    if (!evidence.length) return this.audioDnaCopy().evidenceFallback;
    return `${this.audioDnaCopy().evidencePrefix}: ${evidence.join(', ')}. ${this.audioDnaCopy().restrainedSuffix}`;
  }

  updateRequestedLufs(value: string | number | null): void {
    if (this.isProcessing) return;

    let nextValue: number | null = null;
    if (value !== null && value !== '') {
      const parsed = Number(value);
      nextValue = Number.isFinite(parsed) ? parsed : null;
    }

    if (nextValue === this.requestedLufs()) return;
    this.masteringService.setRequestedLufs(nextValue);
    this.notifyConfigChanged();
  }

  usePolicyLufs(): void {
    if (this.isProcessing || this.requestedLufs() === null) return;
    this.masteringService.setRequestedLufs(null);
    this.notifyConfigChanged();
  }

  toggleHelp(topic: MasteringHelpTopic): void {
    this.activeHelpTopic.set(this.activeHelpTopic() === topic ? null : topic);
  }

  toggleGuide(): void {
    this.guideOpen.update((value) => !value);
  }

  alternarAudicao(variant: AudioVariant): void {
    void this.audioComparison.switchVariant(variant);
  }

  hasCurrentPreview(): boolean {
    return !this.isFullMaster
      && this.audioComparison.canUseMaster()
      && this.audioComparison.playbackMode() === 'preview-15s';
  }

  hasCurrentFullMaster(): boolean {
    return this.isFullMaster
      && this.audioComparison.canUseMaster()
      && this.audioComparison.playbackMode() === 'full-track';
  }

  canGeneratePreview(): boolean {
    return !this.isProcessing
      && this.requestReady()
      && this.audioComparison.previewStatus() !== 'processing'
      && !this.hasCurrentPreview()
      && !this.hasCurrentFullMaster();
  }

  canGenerateFullMaster(): boolean {
    return !this.isProcessing
      && this.requestReady()
      && this.hasCurrentPreview()
      && this.auth.canMaster();
  }

  workflowStatusText(): string {
    const language = this.lang.currentLang();
    if (this.hasCurrentFullMaster()) {
      if (language === 'pl') return 'Pełny Master jest aktualny. Plik jest gotowy do pobrania.';
      if (language === 'pt') return 'O Master completo está atual. O arquivo está pronto para download.';
      return 'The Full Master is current. The file is ready to download.';
    }
    if (this.hasCurrentPreview()) {
      if (language === 'pl') return 'Preview jest aktualny. Możesz teraz wykonać pełny Master, jeśli pozwala na to plan.';
      if (language === 'pt') return 'A prévia está atual. Agora você pode gerar o Master completo se o plano permitir.';
      return 'The Preview is current. You can now render the Full Master if your plan allows it.';
    }
    if (language === 'pl') return 'Ustawienia są prawidłowe. Najpierw wygeneruj 15-sekundowy Preview.';
    if (language === 'pt') return 'As configurações estão válidas. Gere primeiro a prévia de 15 segundos.';
    return 'Settings are valid. Generate the 15-second Preview first.';
  }

  onPreviewRangeStartChange(startSeconds: number): void {
    if (this.isProcessing || !Number.isFinite(startSeconds)) return;
    const normalized = Math.max(0, Math.round(startSeconds * 1000) / 1000);
    if (Math.abs(normalized - this.audioComparison.previewStart()) < 0.005) return;

    const hadCurrentResult = this.audioComparison.canUseMaster() || this.isFullMaster;
    this.masteringService.setPreviewStartSeconds(normalized);
    this.audioComparison.setPreviewStart(normalized);

    if (hadCurrentResult) {
      this.audioComparison.clearMasterSrc();
      this.configInvalidatedResult.set(true);
      this.configChanged.emit();
    } else {
      this.audioComparison.stopAndReset();
    }
  }

  masterVariantLabel(): string {
    if (!this.isFullMaster) return this.lang.tr().MASTER_LABEL;
    if (this.lang.currentLang() === 'pl') return 'B - PEŁNY MASTER';
    if (this.lang.currentLang() === 'pt') return 'B - MASTER COMPLETO';
    return 'B - FULL MASTER';
  }

  onWaveformSeek(seconds: number): void {
    this.audioComparison.seek(seconds);
  }

  dispararPreview(): void {
    if (!this.canGeneratePreview()) return;
    const previewStartSeconds = this.audioComparison.previewStart();
    this.masteringService.setPreviewStartSeconds(previewStartSeconds);
    this.configInvalidatedResult.set(false);
    this.audioComparison.previewStatus.set('processing');
    this.processMaster.emit({
      request: this.masteringService.getRequest(),
      preview: true,
      previewStartSeconds,
    });
  }

  dispararProcessamentoCompleto(): void {
    if (!this.canGenerateFullMaster()) return;
    this.configInvalidatedResult.set(false);
    this.processMaster.emit({ request: this.masteringService.getRequest(), preview: false });
  }

  pararReproducao(): void {
    this.audioComparison.stopAndReset();
  }

  formatarTempo(segundos: number): string {
    if (!Number.isFinite(segundos) || segundos < 0) return '00:00';
    const mins = Math.floor(segundos / 60);
    const secs = Math.floor(segundos % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  onScrubberChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number.parseFloat(input.value);
    if (!Number.isFinite(value)) return;

    if (this.audioComparison.canUseMaster() && this.audioComparison.playbackMode() === 'preview-15s') {
      this.audioComparison.seek(this.audioComparison.previewStart() + value);
    } else {
      this.audioComparison.seek(value);
    }
  }

  async joinProWaitlist(): Promise<void> {
    const email = this.auth.session()?.user?.email;
    if (!email) {
      this.waitlistError = true;
      return;
    }

    this.joiningWaitlist = true;
    this.waitlistError = false;

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'studio.raquelsynths.com',
          language: this.lang.currentLang(),
          website: '',
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        this.waitlistError = true;
        return;
      }
      this.joinedWaitlist = true;
    } catch {
      this.waitlistError = true;
    } finally {
      this.joiningWaitlist = false;
    }
  }

  ngOnDestroy(): void {
    this.releaseOriginalObjectUrl();
    this.audioComparison.resetAll();
  }

  private notifyConfigChanged(): void {
    const hadMaster = this.audioComparison.canUseMaster();
    this.audioComparison.clearMasterSrc();
    if (hadMaster) this.configInvalidatedResult.set(true);
    this.configChanged.emit();
  }

  private releaseOriginalObjectUrl(): void {
    if (!this.originalObjectUrl) return;
    if (isPlatformBrowser(this.platformId)) {
      window.URL.revokeObjectURL(this.originalObjectUrl);
    }
    this.originalObjectUrl = null;
  }
}
