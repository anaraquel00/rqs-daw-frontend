import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, inject } from '@angular/core';
import { LanguageService, UiLanguage } from '../../services/language.service';
import { MasteringService } from '../../services/mastering.service';
import {
  AudioDnaConfidenceLevel,
  AudioDnaPayload,
  AudioDnaTempoRelation,
  MasteringAnalysisState,
  MasteringAtmosphere,
} from '../../services/mastering-types';

interface AudioDnaCopy {
  technicalEyebrow: string;
  subtitle: string;
  analyzing: string;
  unavailableTitle: string;
  unavailableBody: string;
  masterSuggested: string;
  atmosphere: string;
  character: string;
  confidence: string;
  recommended: string;
  manualOverride: string;
  inconclusive: string;
  reset: string;
  spectral: string;
  lowEnd: string;
  stereo: string;
  transients: string;
  harshness: string;
  dynamics: string;
  warmDark: string;
  dark: string;
  bright: string;
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
  tempo: string;
  possibleDouble: string;
  possibleHalf: string;
  possibleAlternative: string;
  key: string;
  musicDna: string;
  experimental: string;
  semanticBody: string;
  releaseAssistant: string;
  releaseBody: string;
  advanced: string;
  duration: string;
  brightness: string;
  warmth: string;
  transientStrength: string;
  stereoWidth: string;
  lowEndDensity: string;
  dynamicDensity: string;
  overallEnergy: string;
  confidenceLow: string;
  confidenceMedium: string;
  confidenceHigh: string;
}

const COPY: Record<UiLanguage, AudioDnaCopy> = {
  en: {
    technicalEyebrow: 'RQS AUDIO DNA', subtitle: 'A qualitative reading of the technical evidence measured in your final audio.',
    analyzing: 'Analyzing technical characteristics…', unavailableTitle: 'Audio DNA unavailable',
    unavailableBody: 'Technical analysis and mastering remain available.', masterSuggested: 'MASTER PROFILE SUGGESTED',
    atmosphere: 'Atmosphere', character: 'Character Intensity', confidence: 'Confidence', recommended: 'Recommended by Audio DNA',
    manualOverride: 'MANUAL OVERRIDE', inconclusive: 'Inconclusive analysis', reset: 'Reset to recommendation',
    spectral: 'Spectral profile', lowEnd: 'Low-end', stereo: 'Stereo image', transients: 'Transients', harshness: 'Harshness', dynamics: 'Dynamics',
    warmDark: 'Warm / dark-leaning', dark: 'Dark-leaning', bright: 'Bright / open', balanced: 'Balanced', strong: 'Strong', solid: 'Solid',
    restrained: 'Restrained', spacious: 'Spacious', focused: 'Focused', narrow: 'Narrow', pronounced: 'Pronounced', preserved: 'Preserved',
    soft: 'Soft', low: 'Low', controlled: 'Controlled', elevated: 'Elevated', open: 'Open', healthy: 'Healthy', compressed: 'Compressed',
    tempo: 'Tempo', possibleDouble: 'Possible double-time', possibleHalf: 'Possible half-time', possibleAlternative: 'Possible alternative', key: 'Key',
    musicDna: 'MUSIC DNA', experimental: 'EXPERIMENTAL', semanticBody: 'Insufficient evidence for reliable semantic classification of genre, mood, instrumentation or vocals.',
    releaseAssistant: 'RELEASE ASSISTANT — EXPERIMENTAL', releaseBody: 'Review detected metadata manually before publishing. Spotify and SoundCloud are not auto-populated.',
    advanced: 'ADVANCED AUDIO DETAILS', duration: 'Duration', brightness: 'Brightness', warmth: 'Warmth', transientStrength: 'Transient strength',
    stereoWidth: 'Stereo width', lowEndDensity: 'Low-end density', dynamicDensity: 'Dynamic density', overallEnergy: 'Overall energy',
    confidenceLow: 'Low', confidenceMedium: 'Medium', confidenceHigh: 'High',
  },
  pt: {
    technicalEyebrow: 'RQS AUDIO DNA', subtitle: 'Uma leitura qualitativa da evidência técnica medida no seu áudio final.',
    analyzing: 'Analisando características técnicas…', unavailableTitle: 'Audio DNA indisponível',
    unavailableBody: 'A análise técnica e a masterização continuam disponíveis.', masterSuggested: 'PERFIL DE MASTER SUGERIDO',
    atmosphere: 'Atmosphere', character: 'Intensidade de Character', confidence: 'Confiança', recommended: 'Recomendado pelo Audio DNA',
    manualOverride: 'AJUSTE MANUAL', inconclusive: 'Análise inconclusiva', reset: 'Restaurar recomendação',
    spectral: 'Perfil espectral', lowEnd: 'Graves', stereo: 'Imagem estéreo', transients: 'Transientes', harshness: 'Aspereza', dynamics: 'Dinâmica',
    warmDark: 'Quente / tendendo ao escuro', dark: 'Tendendo ao escuro', bright: 'Brilhante / aberto', balanced: 'Equilibrado', strong: 'Forte', solid: 'Sólido',
    restrained: 'Contido', spacious: 'Espaçosa', focused: 'Focada', narrow: 'Estreita', pronounced: 'Pronunciados', preserved: 'Preservados',
    soft: 'Suaves', low: 'Baixa', controlled: 'Controlada', elevated: 'Elevada', open: 'Aberta', healthy: 'Saudável', compressed: 'Comprimida',
    tempo: 'Tempo', possibleDouble: 'Possível double-time', possibleHalf: 'Possível half-time', possibleAlternative: 'Alternativa possível', key: 'Tonalidade',
    musicDna: 'MUSIC DNA', experimental: 'EXPERIMENTAL', semanticBody: 'Evidência insuficiente para classificar gênero, mood, instrumentos ou voz com confiança.',
    releaseAssistant: 'RELEASE ASSISTANT — EXPERIMENTAL', releaseBody: 'Revise os metadados manualmente antes da publicação. Spotify e SoundCloud não são preenchidos automaticamente.',
    advanced: 'DETALHES AVANÇADOS DO ÁUDIO', duration: 'Duração', brightness: 'Brilho', warmth: 'Calor', transientStrength: 'Força dos transientes',
    stereoWidth: 'Largura estéreo', lowEndDensity: 'Densidade dos graves', dynamicDensity: 'Densidade dinâmica', overallEnergy: 'Energia geral',
    confidenceLow: 'Baixa', confidenceMedium: 'Média', confidenceHigh: 'Alta',
  },
  pl: {
    technicalEyebrow: 'RQS AUDIO DNA', subtitle: 'Jakościowy opis danych technicznych zmierzonych w gotowym nagraniu.',
    analyzing: 'Analizowanie cech technicznych…', unavailableTitle: 'Audio DNA niedostępne',
    unavailableBody: 'Analiza techniczna i mastering pozostają dostępne.', masterSuggested: 'SUGEROWANY PROFIL MASTERU',
    atmosphere: 'Atmosphere', character: 'Intensywność Character', confidence: 'Pewność', recommended: 'Rekomendacja Audio DNA',
    manualOverride: 'USTAWIENIE RĘCZNE', inconclusive: 'Analiza niejednoznaczna', reset: 'Przywróć rekomendację',
    spectral: 'Profil widmowy', lowEnd: 'Niskie pasmo', stereo: 'Obraz stereo', transients: 'Transjenty', harshness: 'Ostrość', dynamics: 'Dynamika',
    warmDark: 'Ciepły / ciemniejszy', dark: 'Ciemniejszy', bright: 'Jasny / otwarty', balanced: 'Zrównoważony', strong: 'Mocne', solid: 'Stabilne',
    restrained: 'Powściągliwe', spacious: 'Przestrzenny', focused: 'Skupiony', narrow: 'Wąski', pronounced: 'Wyraźne', preserved: 'Zachowane',
    soft: 'Łagodne', low: 'Niska', controlled: 'Kontrolowana', elevated: 'Podwyższona', open: 'Otwarta', healthy: 'Zdrowa', compressed: 'Skompresowana',
    tempo: 'Tempo', possibleDouble: 'Możliwe double-time', possibleHalf: 'Możliwe half-time', possibleAlternative: 'Możliwa alternatywa', key: 'Tonacja',
    musicDna: 'MUSIC DNA', experimental: 'EKSPERYMENTALNE', semanticBody: 'Brak wystarczających danych do wiarygodnej klasyfikacji gatunku, nastroju, instrumentów lub wokalu.',
    releaseAssistant: 'RELEASE ASSISTANT — EKSPERYMENTALNY', releaseBody: 'Przed publikacją sprawdź metadane ręcznie. Spotify i SoundCloud nie są uzupełniane automatycznie.',
    advanced: 'ZAAWANSOWANE DANE AUDIO', duration: 'Czas trwania', brightness: 'Jasność', warmth: 'Ciepło', transientStrength: 'Siła transjentów',
    stereoWidth: 'Szerokość stereo', lowEndDensity: 'Gęstość dołu', dynamicDensity: 'Gęstość dynamiczna', overallEnergy: 'Ogólna energia',
    confidenceLow: 'Niska', confidenceMedium: 'Średnia', confidenceHigh: 'Wysoka',
  },
  fr: {
    technicalEyebrow: 'RQS AUDIO DNA', subtitle: 'Une lecture qualitative des données techniques mesurées dans votre audio final.',
    analyzing: 'Analyse des caractéristiques techniques…', unavailableTitle: 'Audio DNA indisponible',
    unavailableBody: 'L’analyse technique et le mastering restent disponibles.', masterSuggested: 'PROFIL DE MASTER SUGGÉRÉ',
    atmosphere: 'Atmosphere', character: 'Intensité Character', confidence: 'Confiance', recommended: 'Recommandé par Audio DNA',
    manualOverride: 'RÉGLAGE MANUEL', inconclusive: 'Analyse non concluante', reset: 'Restaurer la recommandation',
    spectral: 'Profil spectral', lowEnd: 'Graves', stereo: 'Image stéréo', transients: 'Transitoires', harshness: 'Agressivité', dynamics: 'Dynamique',
    warmDark: 'Chaud / plutôt sombre', dark: 'Plutôt sombre', bright: 'Brillant / ouvert', balanced: 'Équilibré', strong: 'Forts', solid: 'Solides',
    restrained: 'Retenus', spacious: 'Spacieuse', focused: 'Ciblée', narrow: 'Étroite', pronounced: 'Prononcées', preserved: 'Préservées',
    soft: 'Douces', low: 'Faible', controlled: 'Maîtrisée', elevated: 'Élevée', open: 'Ouverte', healthy: 'Saine', compressed: 'Compressée',
    tempo: 'Tempo', possibleDouble: 'Double-time possible', possibleHalf: 'Half-time possible', possibleAlternative: 'Alternative possible', key: 'Tonalité',
    musicDna: 'MUSIC DNA', experimental: 'EXPÉRIMENTAL', semanticBody: 'Données insuffisantes pour classer de façon fiable le genre, l’ambiance, les instruments ou les voix.',
    releaseAssistant: 'RELEASE ASSISTANT — EXPÉRIMENTAL', releaseBody: 'Vérifiez les métadonnées manuellement avant publication. Spotify et SoundCloud ne sont pas remplis automatiquement.',
    advanced: 'DÉTAILS AUDIO AVANCÉS', duration: 'Durée', brightness: 'Brillance', warmth: 'Chaleur', transientStrength: 'Force des transitoires',
    stereoWidth: 'Largeur stéréo', lowEndDensity: 'Densité des graves', dynamicDensity: 'Densité dynamique', overallEnergy: 'Énergie globale',
    confidenceLow: 'Faible', confidenceMedium: 'Moyenne', confidenceHigh: 'Élevée',
  },
};

@Component({
  selector: 'app-audio-dna-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './audio-dna-card.html',
  styleUrls: ['./audio-dna-card.scss'],
})
export class AudioDnaCardComponent {
  @Input() audioDna: AudioDnaPayload | null = null;
  @Input() state: MasteringAnalysisState = 'empty';
  @Output() resetRecommendation = new EventEmitter<void>();

  private readonly lang = inject(LanguageService);
  private readonly mastering = inject(MasteringService);
  readonly copy = computed(() => COPY[this.lang.currentLang()]);
  readonly masterProfileSource = this.mastering.masterProfileSource;

  atmosphereLabel(value: MasteringAtmosphere): string {
    return value.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
  }

  confidenceLabel(level: AudioDnaConfidenceLevel): string {
    if (level === 'high') return this.copy().confidenceHigh;
    if (level === 'medium') return this.copy().confidenceMedium;
    return this.copy().confidenceLow;
  }

  spectralLabel(): string {
    const brightness = this.audioDna?.technical.brightness;
    const warmth = this.audioDna?.technical.warmth;
    if (brightness === undefined || warmth === undefined) return '—';
    if (brightness < 0.35 && warmth >= 0.48) return this.copy().warmDark;
    if (brightness < 0.35) return this.copy().dark;
    if (brightness >= 0.68) return this.copy().bright;
    return this.copy().balanced;
  }

  lowEndLabel(): string { return this.bucket(this.audioDna?.technical.low_end_density, 0.72, 0.45, this.copy().strong, this.copy().solid, this.copy().restrained); }
  stereoLabel(): string { return this.bucket(this.audioDna?.technical.stereo_width, 0.50, 0.28, this.copy().spacious, this.copy().focused, this.copy().narrow); }
  transientLabel(): string { return this.bucket(this.audioDna?.technical.transient_strength, 0.65, 0.32, this.copy().pronounced, this.copy().preserved, this.copy().soft); }
  harshnessLabel(): string { return this.bucketInverse(this.audioDna?.technical.harshness, 0.30, 0.60, this.copy().low, this.copy().controlled, this.copy().elevated); }

  dynamicsLabel(): string {
    const technical = this.audioDna?.technical;
    if (!technical || technical.dynamic_density === undefined) return '—';
    if (technical.dynamic_density >= 0.72 || technical.crest_factor_db < 7.5) return this.copy().compressed;
    if (technical.crest_factor_db >= 14) return this.copy().open;
    return this.copy().healthy;
  }

  tempoAlternative(): { value: number; confidence: number; relation: AudioDnaTempoRelation } | null {
    return this.audioDna?.music?.bpm.alternatives.find((candidate) =>
      candidate.relation === 'double_time' || candidate.relation === 'half_time') ?? null;
  }

  tempoAlternativeLabel(relation: AudioDnaTempoRelation): string {
    if (relation === 'double_time') return this.copy().possibleDouble;
    if (relation === 'half_time') return this.copy().possibleHalf;
    return this.copy().possibleAlternative;
  }

  formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  private bucket(value: number | undefined, high: number, medium: number, highLabel: string, mediumLabel: string, lowLabel: string): string {
    if (value === undefined) return '—';
    if (value >= high) return highLabel;
    if (value >= medium) return mediumLabel;
    return lowLabel;
  }

  private bucketInverse(value: number | undefined, low: number, medium: number, lowLabel: string, mediumLabel: string, highLabel: string): string {
    if (value === undefined) return '—';
    if (value < low) return lowLabel;
    if (value < medium) return mediumLabel;
    return highLabel;
  }
}
