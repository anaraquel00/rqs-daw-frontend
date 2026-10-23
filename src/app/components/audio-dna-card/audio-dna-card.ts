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
  MasteringDeliveryTargetCapabilities,
  OpenAiMusicAnalystPayload,
  SemanticAudioDnaCategory,
} from '../../services/mastering-types';

interface AudioDnaCopy {
  technicalEyebrow: string;
  technicalAnalysis: string;
  technicalDetails: string;
  subtitle: string;
  analyzing: string;
  unavailableTitle: string;
  unavailableBody: string;
  trackSummary: string;
  masterRecommended: string;
  recommendationApplied: string;
  whyThisMaster: string;
  distributionReadiness: string;
  withinRange: string;
  needsAttention: string;
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
  possibleDouble: string;
  possibleHalf: string;
  possibleAlternative: string;
  key: string;
  energy: string;
  danceability: string;
  normalizedValue: string;
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
  levelLow: string;
  levelModerate: string;
  levelHigh: string;
  musicDna: string;
  genre: string;
  astral: string;
  instruments: string;
  semanticEvidence: string;
  semanticUnavailable: string;
}

const COPY: Record<UiLanguage, AudioDnaCopy> = {
  en: {
    technicalEyebrow: 'RQS AUDIO DNA', technicalAnalysis: 'Technical analysis: RQS Audio DNA', technicalDetails: 'TECHNICAL DETAILS',
    subtitle: 'A qualitative reading of the technical evidence measured in your final audio.',
    analyzing: 'Analyzing technical characteristics…', unavailableTitle: 'Audio DNA unavailable',
    unavailableBody: 'Technical analysis and mastering remain available.', trackSummary: 'TRACK SUMMARY',
    masterRecommended: 'RECOMMENDED MASTER', recommendationApplied: 'This setup was applied automatically. You can adjust it below.',
    whyThisMaster: 'WHY THIS MASTER?', distributionReadiness: 'DISTRIBUTION READINESS', withinRange: 'Within range', needsAttention: 'Needs attention',
    atmosphere: 'Atmosphere', character: 'Character', confidence: 'Confidence', recommended: 'Recommended by Audio DNA',
    manualOverride: 'MANUAL OVERRIDE', inconclusive: 'Inconclusive analysis', reset: 'Reset to recommendation',
    spectral: 'Spectral profile', lowEnd: 'Low-end', stereo: 'Stereo image', transients: 'Transients', harshness: 'Harshness', dynamics: 'Dynamics',
    warmDark: 'Warm / dark-leaning', dark: 'Dark-leaning', bright: 'Bright / open', balanced: 'Balanced', strong: 'Strong', solid: 'Solid',
    restrained: 'Restrained', spacious: 'Spacious', focused: 'Focused', narrow: 'Narrow', pronounced: 'Pronounced', preserved: 'Preserved',
    soft: 'Soft', low: 'Low', controlled: 'Controlled', elevated: 'Elevated', open: 'Open', healthy: 'Healthy', compressed: 'Compressed',
    possibleDouble: 'Possible double-time', possibleHalf: 'Possible half-time', possibleAlternative: 'Possible alternative', key: 'Key',
    energy: 'Energy', danceability: 'Danceability', normalizedValue: 'Normalized value', duration: 'Duration', brightness: 'Brightness', warmth: 'Warmth',
    transientStrength: 'Transient strength', stereoWidth: 'Stereo width', lowEndDensity: 'Low-end density', dynamicDensity: 'Dynamic density', overallEnergy: 'Overall energy',
    confidenceLow: 'Low', confidenceMedium: 'Medium', confidenceHigh: 'High', levelLow: 'Low', levelModerate: 'Moderate', levelHigh: 'High',
    musicDna: 'MUSIC DNA', genre: 'Genre', astral: 'Astral', instruments: 'Instruments',
    semanticEvidence: 'Semantic evidence from the audio.', semanticUnavailable: 'Semantic analysis is unavailable. Technical mastering remains active.',
  },
  pt: {
    technicalEyebrow: 'RQS AUDIO DNA', technicalAnalysis: 'Análise técnica: RQS Audio DNA', technicalDetails: 'DETALHES TÉCNICOS',
    subtitle: 'Uma leitura qualitativa da evidência técnica medida no seu áudio final.',
    analyzing: 'Analisando características técnicas…', unavailableTitle: 'Audio DNA indisponível',
    unavailableBody: 'A análise técnica e a masterização continuam disponíveis.', trackSummary: 'RESUMO DA FAIXA',
    masterRecommended: 'MASTER RECOMENDADO', recommendationApplied: 'Esta configuração foi aplicada automaticamente. Você pode ajustá-la abaixo.',
    whyThisMaster: 'POR QUE ESTE MASTER?', distributionReadiness: 'PRONTIDÃO PARA DISTRIBUIÇÃO', withinRange: 'Dentro da faixa', needsAttention: 'Precisa de atenção',
    atmosphere: 'Atmosphere', character: 'Character', confidence: 'Confiança', recommended: 'Recomendado pelo Audio DNA',
    manualOverride: 'AJUSTE MANUAL', inconclusive: 'Análise inconclusiva', reset: 'Restaurar recomendação',
    spectral: 'Perfil espectral', lowEnd: 'Graves', stereo: 'Imagem estéreo', transients: 'Transientes', harshness: 'Aspereza', dynamics: 'Dinâmica',
    warmDark: 'Quente / tendendo ao escuro', dark: 'Tendendo ao escuro', bright: 'Brilhante / aberto', balanced: 'Equilibrado', strong: 'Forte', solid: 'Sólido',
    restrained: 'Contido', spacious: 'Espaçosa', focused: 'Focada', narrow: 'Estreita', pronounced: 'Pronunciados', preserved: 'Preservados',
    soft: 'Suaves', low: 'Baixa', controlled: 'Controlada', elevated: 'Elevada', open: 'Aberta', healthy: 'Saudável', compressed: 'Comprimida',
    possibleDouble: 'Possível double-time', possibleHalf: 'Possível half-time', possibleAlternative: 'Alternativa possível', key: 'Tonalidade',
    energy: 'Energia', danceability: 'Dançabilidade', normalizedValue: 'Valor normalizado', duration: 'Duração', brightness: 'Brilho', warmth: 'Calor',
    transientStrength: 'Força dos transientes', stereoWidth: 'Largura estéreo', lowEndDensity: 'Densidade dos graves', dynamicDensity: 'Densidade dinâmica', overallEnergy: 'Energia geral',
    confidenceLow: 'Baixa', confidenceMedium: 'Média', confidenceHigh: 'Alta', levelLow: 'Baixa', levelModerate: 'Moderada', levelHigh: 'Alta',
    musicDna: 'MUSIC DNA', genre: 'Gênero', astral: 'Astral', instruments: 'Instrumentos',
    semanticEvidence: 'Evidência semântica extraída do áudio.', semanticUnavailable: 'A análise semântica está indisponível. A masterização técnica permanece ativa.',
  },
  pl: {
    technicalEyebrow: 'RQS AUDIO DNA', technicalAnalysis: 'Analiza techniczna: RQS Audio DNA', technicalDetails: 'SZCZEGÓŁY TECHNICZNE',
    subtitle: 'Jakościowy opis danych technicznych zmierzonych w gotowym nagraniu.',
    analyzing: 'Analizowanie cech technicznych…', unavailableTitle: 'Audio DNA niedostępne',
    unavailableBody: 'Analiza techniczna i mastering pozostają dostępne.', trackSummary: 'PODSUMOWANIE UTWORU',
    masterRecommended: 'ZALECANY MASTER', recommendationApplied: 'Ta konfiguracja została zastosowana automatycznie. Możesz ją dostosować poniżej.',
    whyThisMaster: 'DLACZEGO TEN MASTER?', distributionReadiness: 'GOTOWOŚĆ DO DYSTRYBUCJI', withinRange: 'W zakresie', needsAttention: 'Wymaga uwagi',
    atmosphere: 'Atmosphere', character: 'Character', confidence: 'Pewność', recommended: 'Rekomendacja Audio DNA',
    manualOverride: 'USTAWIENIE RĘCZNE', inconclusive: 'Analiza niejednoznaczna', reset: 'Przywróć rekomendację',
    spectral: 'Profil widmowy', lowEnd: 'Niskie pasmo', stereo: 'Obraz stereo', transients: 'Transjenty', harshness: 'Ostrość', dynamics: 'Dynamika',
    warmDark: 'Ciepły / ciemniejszy', dark: 'Ciemniejszy', bright: 'Jasny / otwarty', balanced: 'Zrównoważony', strong: 'Mocne', solid: 'Stabilne',
    restrained: 'Powściągliwe', spacious: 'Przestrzenny', focused: 'Skupiony', narrow: 'Wąski', pronounced: 'Wyraźne', preserved: 'Zachowane',
    soft: 'Łagodne', low: 'Niska', controlled: 'Kontrolowana', elevated: 'Podwyższona', open: 'Otwarta', healthy: 'Zdrowa', compressed: 'Skompresowana',
    possibleDouble: 'Możliwe double-time', possibleHalf: 'Możliwe half-time', possibleAlternative: 'Możliwa alternatywa', key: 'Tonacja',
    energy: 'Energia', danceability: 'Taneczność', normalizedValue: 'Wartość znormalizowana', duration: 'Czas trwania', brightness: 'Jasność', warmth: 'Ciepło',
    transientStrength: 'Siła transjentów', stereoWidth: 'Szerokość stereo', lowEndDensity: 'Gęstość dołu', dynamicDensity: 'Gęstość dynamiczna', overallEnergy: 'Ogólna energia',
    confidenceLow: 'Niska', confidenceMedium: 'Średnia', confidenceHigh: 'Wysoka', levelLow: 'Niska', levelModerate: 'Umiarkowana', levelHigh: 'Wysoka',
    musicDna: 'MUSIC DNA', genre: 'Gatunek', astral: 'Astral', instruments: 'Instrumenty',
    semanticEvidence: 'Dane semantyczne wyodrębnione z audio.', semanticUnavailable: 'Analiza semantyczna jest niedostępna. Mastering techniczny pozostaje aktywny.',
  },
  fr: {
    technicalEyebrow: 'RQS AUDIO DNA', technicalAnalysis: 'Analyse technique : RQS Audio DNA', technicalDetails: 'DÉTAILS TECHNIQUES',
    subtitle: 'Une lecture qualitative des données techniques mesurées dans votre audio final.',
    analyzing: 'Analyse des caractéristiques techniques…', unavailableTitle: 'Audio DNA indisponible',
    unavailableBody: 'L’analyse technique et le mastering restent disponibles.', trackSummary: 'RÉSUMÉ DU TITRE',
    masterRecommended: 'MASTER RECOMMANDÉ', recommendationApplied: 'Cette configuration a été appliquée automatiquement. Vous pouvez l’ajuster ci-dessous.',
    whyThisMaster: 'POURQUOI CE MASTER ?', distributionReadiness: 'PRÊT POUR LA DISTRIBUTION', withinRange: 'Dans la plage', needsAttention: 'À vérifier',
    atmosphere: 'Atmosphere', character: 'Character', confidence: 'Confiance', recommended: 'Recommandé par Audio DNA',
    manualOverride: 'RÉGLAGE MANUEL', inconclusive: 'Analyse non concluante', reset: 'Restaurer la recommandation',
    spectral: 'Profil spectral', lowEnd: 'Graves', stereo: 'Image stéréo', transients: 'Transitoires', harshness: 'Agressivité', dynamics: 'Dynamique',
    warmDark: 'Chaud / plutôt sombre', dark: 'Plutôt sombre', bright: 'Brillant / ouvert', balanced: 'Équilibré', strong: 'Forts', solid: 'Solides',
    restrained: 'Retenus', spacious: 'Spacieuse', focused: 'Ciblée', narrow: 'Étroite', pronounced: 'Prononcées', preserved: 'Préservées',
    soft: 'Douces', low: 'Faible', controlled: 'Maîtrisée', elevated: 'Élevée', open: 'Ouverte', healthy: 'Saine', compressed: 'Compressée',
    possibleDouble: 'Double-time possible', possibleHalf: 'Half-time possible', possibleAlternative: 'Alternative possible', key: 'Tonalité',
    energy: 'Énergie', danceability: 'Dansabilité', normalizedValue: 'Valeur normalisée', duration: 'Durée', brightness: 'Brillance', warmth: 'Chaleur',
    transientStrength: 'Force des transitoires', stereoWidth: 'Largeur stéréo', lowEndDensity: 'Densité des graves', dynamicDensity: 'Densité dynamique', overallEnergy: 'Énergie globale',
    confidenceLow: 'Faible', confidenceMedium: 'Moyenne', confidenceHigh: 'Élevée', levelLow: 'Faible', levelModerate: 'Modérée', levelHigh: 'Élevée',
    musicDna: 'MUSIC DNA', genre: 'Genre', astral: 'Astral', instruments: 'Instruments',
    semanticEvidence: 'Données sémantiques extraites de l’audio.', semanticUnavailable: 'L’analyse sémantique est indisponible. Le mastering technique reste actif.',
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
  @Input() openAiMusicAnalyst: OpenAiMusicAnalystPayload | null = null;
  @Input() state: MasteringAnalysisState = 'empty';
  @Input() mode: 'summary' | 'technical' = 'summary';
  @Input() target: MasteringDeliveryTargetCapabilities | null = null;
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

  confidenceText(confidence: number): string {
    const level = this.confidenceLabel(confidence >= 0.75 ? 'high' : confidence >= 0.45 ? 'medium' : 'low');
    const language = this.lang.currentLang();
    if (language === 'pt') return `Confiança ${level.toLowerCase()}`;
    if (language === 'pl') return `Pewność: ${level.toLowerCase()}`;
    if (language === 'fr') return `Confiance ${level.toLowerCase()}`;
    return `${level} confidence`;
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

  musicFeatureLabel(value: number, provided?: 'low' | 'moderate' | 'high'): string {
    const level = provided ?? (value < 0.34 ? 'low' : value < 0.67 ? 'moderate' : 'high');
    if (level === 'high') return this.copy().levelHigh;
    if (level === 'moderate') return this.copy().levelModerate;
    return this.copy().levelLow;
  }

  semanticTagLine(category: SemanticAudioDnaCategory, limit = 3): string {
    const tags = this.audioDna?.semantic?.categories[category] ?? [];
    return tags
      .slice(0, limit)
      .map(({ tag }) => tag
        .split('-')
        .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : part)
        .join(' '))
      .join(' · ') || '—';
  }

  openAiInstrumentLine(limit = 3): string {
    return (this.openAiMusicAnalyst?.instruments ?? [])
      .slice(0, limit)
      .map(({ name }) => name)
      .join(' · ');
  }

  masterReasonLabels(): string[] {
    const language = this.lang.currentLang();
    const labels: Record<string, Record<UiLanguage, string>> = {
      WIDE_STEREO_IMAGE: { en: 'Wide stereo image', pt: 'Imagem estéreo ampla', pl: 'Szeroki obraz stereo', fr: 'Image stéréo large' },
      SPACIOUS_IMAGE: { en: 'Spacious stereo image', pt: 'Imagem estéreo espaçosa', pl: 'Przestrzenny obraz stereo', fr: 'Image stéréo spacieuse' },
      PRESERVED_TRANSIENTS: { en: 'Preserved transients', pt: 'Transientes preservados', pl: 'Zachowane transjenty', fr: 'Transitoires préservées' },
      LOW_HARSHNESS: { en: 'Low harshness', pt: 'Baixa aspereza', pl: 'Niska ostrość', fr: 'Faible agressivité' },
      WARM_SPECTRAL_BALANCE: { en: 'Warm tonal balance', pt: 'Balanço tonal quente', pl: 'Ciepła równowaga tonalna', fr: 'Équilibre tonal chaud' },
      MODERATE_ENERGY: { en: 'Moderate energy', pt: 'Energia moderada', pl: 'Umiarkowana energia', fr: 'Énergie modérée' },
      DENSE_LOW_END: { en: 'Strong low-end', pt: 'Graves fortes', pl: 'Mocne niskie pasmo', fr: 'Graves puissants' },
      HIGH_ENERGY: { en: 'High energy', pt: 'Energia alta', pl: 'Wysoka energia', fr: 'Énergie élevée' },
      HIGH_DYNAMIC_DENSITY: { en: 'Dense dynamics', pt: 'Dinâmica densa', pl: 'Gęsta dynamika', fr: 'Dynamique dense' },
      BRIGHT_SPECTRAL_BALANCE: { en: 'Bright tonal balance', pt: 'Balanço tonal brilhante', pl: 'Jasna równowaga tonalna', fr: 'Équilibre tonal brillant' },
      DENSE_SOURCE_RESTRAINT: { en: 'Dense source under control', pt: 'Fonte densa sob controle', pl: 'Gęste źródło pod kontrolą', fr: 'Source dense maîtrisée' },
      HIGH_LRA_RESTRAINT: { en: 'Wide dynamic range', pt: 'Amplitude dinâmica preservada', pl: 'Szeroki zakres dynamiki', fr: 'Large plage dynamique' },
      HARSH_SOURCE_RESTRAINT: { en: 'Harshness under control', pt: 'Aspereza sob controle', pl: 'Ostrość pod kontrolą', fr: 'Agressivité maîtrisée' },
      STRONG_TRANSIENT_RESTRAINT: { en: 'Strong transients protected', pt: 'Transientes fortes protegidos', pl: 'Silne transjenty chronione', fr: 'Transitoires fortes protégées' },
      INCONCLUSIVE_TECHNICAL_DNA: { en: 'Conservative adjustment', pt: 'Ajuste conservador', pl: 'Ostrożne ustawienie', fr: 'Réglage prudent' },
    };
    const reasons = (this.audioDna?.master_profile?.reasons ?? [])
      .map((reason) => labels[reason.code]?.[language])
      .filter((label): label is string => Boolean(label))
      .slice(0, 4);

    if (reasons.length) return reasons;
    const copy = this.copy();
    return [
      `${copy.lowEnd}: ${this.lowEndLabel()}`,
      `${copy.transients}: ${this.transientLabel()}`,
      `${copy.harshness}: ${this.harshnessLabel()}`,
    ];
  }

  loudnessWithinTarget(): boolean {
    const value = this.audioDna?.technical.lufs_integrated;
    if (value === undefined || !Number.isFinite(value)) return false;
    if (!this.target) return value >= -14.5 && value <= -9;
    return value >= this.target.min_lufs && value <= this.target.max_lufs;
  }

  truePeakWithinTarget(): boolean {
    const value = this.audioDna?.technical.true_peak_dbtp;
    if (value === undefined || !Number.isFinite(value)) return false;
    return value <= (this.target?.true_peak_ceiling_dbtp ?? -1);
  }

  loudnessReadinessLabel(): string {
    return this.loudnessWithinTarget() ? this.copy().withinRange : this.copy().needsAttention;
  }

  truePeakReadinessLabel(): string {
    return this.truePeakWithinTarget() ? this.copy().withinRange : this.copy().needsAttention;
  }

  normalizedPercent(value: number): number {
    return Math.round(Math.max(0, Math.min(1, value)) * 100);
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
