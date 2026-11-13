import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import {
  DspService,
  SetlistCurve,
  SetlistLoudnessMode,
  SetlistRenderRequest,
} from '../services/dsp';
import { LanguageService } from '../services/language.service';
import type { UiLanguage } from '../services/language.service';
import { AuthService } from '../services/auth.service';
import { AudioComparisonService } from '../services/audio-comparison.service';
import { AnalyticsService } from '../services/analytics.service';
import { PreviewWaveformComponent } from '../components/mastering-panel/preview-waveform';
import { PlanUpgradeCtaComponent } from '../components/plan-upgrade-cta/plan-upgrade-cta';
import {
  BuildV2TrackState,
  buildV2EffectiveRange,
  createBuildV2TrackState,
  dbToLinearGain,
  hasBuildV2Adjustments,
  normalizeBuildV2TrackState,
} from './build-v2-track-state';
import {
  renderBuildV2FilesOffline,
} from './build-v2-local-render';
import {
  decodeBuildV2TrackFiles,
} from './build-v2-audio-decoder';
import type {
  BuildV2EngineTrack,
} from './build-v2-audio-engine';
import {
  BuildV2LiveAudioEngine,
} from './build-v2-live-audio-engine';
import {
  BuildV2TransportClock,
  type BuildV2TransportSnapshot,
} from './build-v2-live-transport';

export type SetlistUploadState = 'idle' | 'uploading' | 'ready' | 'error';

export interface RQSTrack {
  id: string;
  file: File;
  name: string;
  crossfadeNext: number;
  previewUrl: SafeUrl;
  rawUrl: string;
  duration: number;
  s3Key: string | null;
  uploadState: SetlistUploadState;
  uploadError: string | null;
  uploadAttempt: number;
  v2: BuildV2TrackState;
}

export interface SetlistTransition {
  fromTrackId: string;
  toTrackId: string;
  duration: number;
  curve: SetlistCurve;
  usesDefault: boolean;
}

type LocalCopyKey =
  | 'metadataUnknown'
  | 'waveformLocal'
  | 'uploading'
  | 'ready'
  | 'uploadError'
  | 'retry'
  | 'replace'
  | 'vignette'
  | 'vignetteOff'
  | 'vignetteChoose'
  | 'renderBlocked'
  | 'trackLimitSelection'
  | 'trackLimitServer'
  | 'serverError';

const LOCAL_COPY: Record<UiLanguage, Record<LocalCopyKey, string>> = {
  en: {
    metadataUnknown: 'Duration measured locally · sample rate and bit depth not analyzed',
    waveformLocal: 'Local waveform · generated in this browser',
    uploading: 'Uploading securely…',
    ready: 'Secure upload ready',
    uploadError: 'Upload failed',
    retry: 'Retry',
    replace: 'Replace',
    vignette: 'Optional vignette / ID drop',
    vignetteOff: 'Off by default',
    vignetteChoose: 'Choose vignette',
    renderBlocked: 'Every music track must finish uploading before render.',
    trackLimitSelection: 'Your plan allows up to {max} music tracks. Extra files were not uploaded.',
    trackLimitServer: 'Your account Setlist track limit was exceeded. Refresh your profile and try again.',
    serverError: 'Setlist request failed safely. Review the highlighted inputs and retry.',
  },
  pt: {
    metadataUnknown: 'Duração medida localmente · sample rate e bit depth não analisados',
    waveformLocal: 'Forma de onda local · gerada neste navegador',
    uploading: 'Enviando com segurança…',
    ready: 'Upload seguro pronto',
    uploadError: 'Falha no upload',
    retry: 'Tentar novamente',
    replace: 'Substituir',
    vignette: 'Vinheta / ID drop opcional',
    vignetteOff: 'Desligada por padrão',
    vignetteChoose: 'Escolher vinheta',
    renderBlocked: 'Todas as faixas precisam concluir o upload antes do render.',
    trackLimitSelection: 'Seu plano permite até {max} faixas musicais. Os arquivos extras não foram enviados.',
    trackLimitServer: 'O limite de faixas da Setlist da sua conta foi excedido. Atualize o perfil e tente novamente.',
    serverError: 'A solicitação da setlist falhou com segurança. Revise os campos e tente novamente.',
  },
  pl: {
    metadataUnknown: 'Czas odczytany lokalnie · sample rate i bit depth nieanalizowane',
    waveformLocal: 'Lokalny przebieg fali · wygenerowany w tej przeglądarce',
    uploading: 'Bezpieczne wysyłanie…',
    ready: 'Bezpieczny upload gotowy',
    uploadError: 'Błąd uploadu',
    retry: 'Ponów',
    replace: 'Zastąp',
    vignette: 'Opcjonalna winieta / ID drop',
    vignetteOff: 'Domyślnie wyłączona',
    vignetteChoose: 'Wybierz winietę',
    renderBlocked: 'Każdy utwór musi zakończyć upload przed renderem.',
    trackLimitSelection: 'Twój plan pozwala na maksymalnie {max} utwory. Dodatkowe pliki nie zostały wysłane.',
    trackLimitServer: 'Przekroczono limit utworów Setlisty dla konta. Odśwież profil i spróbuj ponownie.',
    serverError: 'Żądanie setlisty bezpiecznie odrzucono. Sprawdź pola i spróbuj ponownie.',
  },
  fr: {
    metadataUnknown: 'Durée mesurée localement · fréquence et profondeur non analysées',
    waveformLocal: 'Forme d’onde locale · générée dans ce navigateur',
    uploading: 'Téléversement sécurisé…',
    ready: 'Téléversement sécurisé prêt',
    uploadError: 'Échec du téléversement',
    retry: 'Réessayer',
    replace: 'Remplacer',
    vignette: 'Vignette / ID drop facultatif',
    vignetteOff: 'Désactivée par défaut',
    vignetteChoose: 'Choisir une vignette',
    renderBlocked: 'Chaque piste doit terminer son téléversement avant le rendu.',
    trackLimitSelection: 'Votre offre autorise jusqu’à {max} pistes musicales. Les fichiers supplémentaires n’ont pas été téléversés.',
    trackLimitServer: 'La limite de pistes Setlist de votre compte a été dépassée. Actualisez le profil et réessayez.',
    serverError: 'La requête Setlist a échoué de façon sécurisée. Vérifiez les champs et réessayez.',
  },
};

const BUILD_V2_COPY = {
  en: {
    title: 'BUILD V2 preview lab',
    previewOnly: 'Local preview only · current server render stays V1 until the V2 engine contract is enabled.',
    trimStart: 'Trim start',
    trimEnd: 'Trim end',
    gain: 'Gain',
    pan: 'Pan',
    effective: 'Effective clip',
    reset: 'Reset V2 controls',
    resetAll: 'Reset all V2 controls',
    renderBlocked: 'BUILD V2 local adjustments are active. Reset them before using the current V1 server render.',
    workspace: 'RQS BUILD V2',
    workflow: 'ARRANGE · MIX · TRANSITION · BOUNCE',
    previewReady: 'LOCAL PREVIEW READY',
    timeline: 'SETLIST TIMELINE',
    selectedTrack: 'SELECTED TRACK',
    source: 'Source',
  },
  pt: {
    title: 'Laboratório de prévia BUILD V2',
    previewOnly: 'Somente prévia local · o render atual do servidor permanece V1 até o contrato do motor V2 ser ativado.',
    trimStart: 'Corte inicial',
    trimEnd: 'Corte final',
    gain: 'Ganho',
    pan: 'Pan',
    effective: 'Clipe efetivo',
    reset: 'Resetar controles V2',
    resetAll: 'Resetar todos os controles V2',
    renderBlocked: 'Há ajustes locais do BUILD V2 ativos. Resete-os antes de usar o render V1 atual do servidor.',
    workspace: 'RQS BUILD V2',
    workflow: 'ARRANJO · MIX · TRANSIÇÃO · BOUNCE',
    previewReady: 'PRÉVIA LOCAL PRONTA',
    timeline: 'LINHA DO TEMPO DA SETLIST',
    selectedTrack: 'FAIXA SELECIONADA',
    source: 'Origem',
  },
  pl: {
    title: 'Laboratorium podglądu BUILD V2',
    previewOnly: 'Tylko podgląd lokalny · bieżący render serwerowy pozostaje V1 do czasu włączenia kontraktu silnika V2.',
    trimStart: 'Początek cięcia',
    trimEnd: 'Koniec cięcia',
    gain: 'Wzmocnienie',
    pan: 'Panorama',
    effective: 'Efektywny klip',
    reset: 'Resetuj kontrolki V2',
    resetAll: 'Resetuj wszystkie kontrolki V2',
    renderBlocked: 'Lokalne ustawienia BUILD V2 są aktywne. Zresetuj je przed użyciem bieżącego renderu serwerowego V1.',
    workspace: 'RQS BUILD V2',
    workflow: 'ARANŻACJA · MIKS · PRZEJŚCIA · BOUNCE',
    previewReady: 'PODGLĄD LOKALNY GOTOWY',
    timeline: 'OŚ CZASU SETLISTY',
    selectedTrack: 'WYBRANY UTWÓR',
    source: 'Źródło',
  },
  fr: {
    title: 'Laboratoire de préécoute BUILD V2',
    previewOnly: 'Préécoute locale uniquement · le rendu serveur actuel reste en V1 jusqu’à l’activation du contrat du moteur V2.',
    trimStart: 'Début du trim',
    trimEnd: 'Fin du trim',
    gain: 'Gain',
    pan: 'Panoramique',
    effective: 'Clip effectif',
    reset: 'Réinitialiser les contrôles V2',
    resetAll: 'Réinitialiser tous les contrôles V2',
    renderBlocked: 'Des réglages locaux BUILD V2 sont actifs. Réinitialisez-les avant d’utiliser le rendu serveur V1 actuel.',
    workspace: 'RQS BUILD V2',
    workflow: 'ARRANGEMENT · MIX · TRANSITIONS · BOUNCE',
    previewReady: 'PRÉÉCOUTE LOCALE PRÊTE',
    timeline: 'TIMELINE DE LA SETLIST',
    selectedTrack: 'PISTE SÉLECTIONNÉE',
    source: 'Source',
  },
} as const;

const TRANSITION_COPY = {
  en: { defaults: 'Default transition', duration: 'Duration', curve: 'Curve', apply: 'Apply to all transitions', transition: 'Transition', edit: 'Edit', reset: 'Reset to default', inherited: 'Default', custom: 'Custom', limits: '0.5–15 seconds · shorter than both adjacent tracks' },
  pt: { defaults: 'Transição padrão', duration: 'Duração', curve: 'Curva', apply: 'Aplicar a todas as transições', transition: 'Transição', edit: 'Editar', reset: 'Restaurar padrão', inherited: 'Padrão', custom: 'Personalizada', limits: '0,5–15 segundos · menor que ambas as faixas adjacentes' },
  pl: { defaults: 'Domyślne przejście', duration: 'Czas', curve: 'Krzywa', apply: 'Zastosuj do wszystkich przejść', transition: 'Przejście', edit: 'Edytuj', reset: 'Przywróć domyślne', inherited: 'Domyślne', custom: 'Własne', limits: '0,5–15 sekund · krócej niż oba sąsiednie utwory' },
  fr: { defaults: 'Transition par défaut', duration: 'Durée', curve: 'Courbe', apply: 'Appliquer à toutes les transitions', transition: 'Transition', edit: 'Modifier', reset: 'Rétablir les valeurs par défaut', inherited: 'Par défaut', custom: 'Personnalisée', limits: '0,5–15 secondes · plus court que les deux pistes adjacentes' },
};

@Component({
  selector: 'app-mix-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, PreviewWaveformComponent, PlanUpgradeCtaComponent],
  templateUrl: './mix-panel.html',
  styleUrls: ['./mix-panel.scss'],
})
export class MixPanelComponent implements OnDestroy {
  private readonly audioComparison = inject(AudioComparisonService);
  private readonly dspService = inject(DspService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  readonly lang = inject(LanguageService);
  readonly auth = inject(AuthService);
  private readonly analytics = inject(AnalyticsService);

  private currentTracks: RQSTrack[] = [];
  selectedTrackId: string | null = null;
  transitions: SetlistTransition[] = [];
  defaultDuration = 8;
  expandedTransition: string | null = null;
  get tracks(): RQSTrack[] { return this.currentTracks; }
  set tracks(value: RQSTrack[]) {
    this.currentTracks = value;
    this.reconcileTransitions();
    this.reconcileSelectedTrack();
    this.invalidateBuildV2TransportPreview(true);
  }
  vignetteEnabled = false;
  vignetteTrack: RQSTrack | null = null;
  isProcessing = false;
  mixSuccess = false;
  setlistError: string | null = null;
  readonly pricingUpgradeRequired = signal(false);
  setlistName = 'THE_BLUEPRINT_SESSIONS_Vol_XYZ';

  activeCurve: SetlistCurve = 'equal-power';
  loudnessMatchMode: SetlistLoudnessMode = 'off';
  previewingIndex = -1;
  previewProgress = signal<number>(0);

  private buildV2TransportClock =
    new BuildV2TransportClock(0);

  readonly buildV2TransportSnapshot =
    signal<BuildV2TransportSnapshot>(
      this.buildV2TransportClock.snapshot(),
    );

  readonly buildV2TransportRendering =
    signal(false);

  private buildV2TransportAudioCtx:
    AudioContext | null = null;

  private buildV2LiveEngine:
    BuildV2LiveAudioEngine | null = null;

  private buildV2DecodedTracks:
    BuildV2EngineTrack[] | null = null;

  private buildV2TransportRafId:
    number | null = null;

  private buildV2TransportAttempt = 0;

  private audioCtx: AudioContext | null = null;
  private sourceNode1: MediaElementAudioSourceNode | null = null;
  private sourceNode2: MediaElementAudioSourceNode | null = null;
  private gainNode1!: GainNode;
  private gainNode2!: GainNode;
  private panNode1: StereoPannerNode | null = null;
  private panNode2: StereoPannerNode | null = null;
  private previewBaseGain1 = 1;
  private previewBaseGain2 = 1;
  private playerElement1: HTMLAudioElement | null = null;
  private playerElement2: HTMLAudioElement | null = null;
  private previewIntervalId: ReturnType<typeof setInterval> | null = null;
  private previousUserId: string | null = null;
  private activeRenderSubscription: Subscription | null = null;
  private renderAttempt = 0;
  private successResetTimer: ReturnType<typeof setTimeout> | null = null;
  private previewAttempt = 0;

  reconcileTransitions(): void {
    const previous = new Map(this.transitions.map(t => [this.transitionKey(t), t]));
    this.transitions = this.tracks.slice(0, -1).map((track, i) => {
      const pair = { fromTrackId: track.id, toTrackId: this.tracks[i + 1].id };
      return previous.get(this.transitionKey(pair)) ?? {
        ...pair, duration: this.defaultDuration, curve: this.activeCurve, usesDefault: true,
      };
    });
    if (!this.transitions.some(t => this.transitionKey(t) === this.expandedTransition)) {
      this.expandedTransition = null;
    }
  }

  private reconcileSelectedTrack(): void {
    if (
      this.selectedTrackId
      && this.tracks.some(track => track.id === this.selectedTrackId)
    ) {
      return;
    }

    this.selectedTrackId = this.tracks[0]?.id ?? null;
  }

  selectTrack(track: RQSTrack): void {
    this.selectedTrackId = track.id;
  }

  selectedTrack(): RQSTrack | null {
    return this.tracks.find(track => track.id === this.selectedTrackId)
      ?? this.tracks[0]
      ?? null;
  }

  selectedTrackIndex(): number {
    const selected = this.selectedTrack();
    return selected
      ? this.tracks.findIndex(track => track.id === selected.id)
      : -1;
  }

  trackHasBuildV2Adjustments(track: RQSTrack): boolean {
    return hasBuildV2Adjustments(track.v2, track.duration);
  }

  trimStartPercent(track: RQSTrack): number {
    if (!Number.isFinite(track.duration) || track.duration <= 0) return 0;
    return 100 * this.effectiveRange(track).start / track.duration;
  }

  trimEndPercent(track: RQSTrack): number {
    if (!Number.isFinite(track.duration) || track.duration <= 0) return 100;
    return 100 * this.effectiveRange(track).end / track.duration;
  }

  trackTimelineStartSeconds(index: number): number {
    if (index <= 0) return 0;

    let start = 0;

    for (let i = 0; i < index; i += 1) {
      const current = this.tracks[i];
      const next = this.tracks[i + 1];

      if (!current) break;

      start += Math.max(0, current.duration);

      const transition = this.transitions[i];

      if (transition && next) {
        const safeOverlap = Math.min(
          Math.max(0, transition.duration),
          Math.max(0, current.duration),
          Math.max(0, next.duration),
        );

        start -= safeOverlap;
      }
    }

    return Math.max(0, start);
  }

  trackTimelineLeftPercent(index: number): number {
    const total = this.calculateEstimatedOutputDuration();
    if (total <= 0) return 0;

    return Math.min(
      100,
      100 * this.trackTimelineStartSeconds(index) / total,
    );
  }

  trackTimelineWidthPercent(index: number): number {
    const track = this.tracks[index];
    const total = this.calculateEstimatedOutputDuration();

    if (!track || total <= 0 || track.duration <= 0) return 0;

    const left = this.trackTimelineLeftPercent(index);
    const width = 100 * track.duration / total;

    return Math.max(0, Math.min(width, 100 - left));
  }

  transitionKey(t: Pick<SetlistTransition, 'fromTrackId' | 'toTrackId'>): string {
    return `${t.fromTrackId}:${t.toTrackId}`;
  }

  transitionRegion(index: number, direction: 'in' | 'out') {
    const track = this.tracks[index];
    const transition = this.transitions[direction === 'in' ? index - 1 : index];
    if (!track || !transition || !Number.isFinite(track.duration) || track.duration <= 0
      || !Number.isFinite(transition.duration) || transition.duration <= 0
      || (direction === 'in' ? transition.toTrackId : transition.fromTrackId) !== track.id) return null;
    const range = this.effectiveRange(track);
    const seconds = Math.min(range.duration, transition.duration);
    const start = direction === 'in' ? range.start : range.end - seconds;
    const end = start + seconds;
    const labels = {
      en: { in: 'Transition in', out: 'Transition out' },
      pt: { in: 'Entrada da transição', out: 'Saída da transição' },
      pl: { in: 'Wejście przejścia', out: 'Wyjście przejścia' },
      fr: { in: 'Entrée de transition', out: 'Sortie de transition' },
    };
    const label = labels[this.lang.currentLang()][direction];
    return { start, end, seconds, left: 100 * start / track.duration,
      width: 100 * seconds / track.duration,
      label: `${label}: ${seconds} s · ${this.formatDuration(start)} → ${this.formatDuration(end)}` };
  }

  updateDefaults(duration: number, curve: SetlistCurve): void {
    this.stopTransitionPreview();
    this.defaultDuration = Number(duration);
    this.activeCurve = curve;
    this.transitions = this.transitions.map(t => t.usesDefault
      ? { ...t, duration: this.defaultDuration, curve } : t);
    this.invalidateBuildV2TransportPreview();
  }

  editTransition(index: number, duration: number, curve: SetlistCurve): void {
    if (!this.transitions[index]) return;
    this.stopTransitionPreview();
    this.transitions = this.transitions.map((t, i) => i === index
      ? { ...t, duration: Number(duration), curve, usesDefault: false } : t);
    this.invalidateBuildV2TransportPreview();
  }

  resetTransition(index: number): void {
    this.stopTransitionPreview();
    this.transitions = this.transitions.map((t, i) => i === index
      ? { ...t, duration: this.defaultDuration, curve: this.activeCurve, usesDefault: true } : t);
    this.invalidateBuildV2TransportPreview();
  }

  applyDefaultsToAll(): void {
    this.stopTransitionPreview();
    this.transitions = this.transitions.map(t => ({
      ...t, duration: this.defaultDuration, curve: this.activeCurve, usesDefault: true,
    }));
    this.invalidateBuildV2TransportPreview();
  }

  toggleTransition(t: SetlistTransition): void {
    const key = this.transitionKey(t);
    this.expandedTransition = this.expandedTransition === key ? null : key;
  }

  canPreviewTransition(index: number): boolean {
    const t = this.transitions[index];
    const a = this.tracks[index];
    const b = this.tracks[index + 1];
    return !this.isProcessing && !!t && !!a && !!b
      && t.fromTrackId === a.id && t.toTrackId === b.id
      && Number.isFinite(t.duration) && t.duration >= 0.5 && t.duration <= 15
      && t.duration < Math.min(this.effectiveRange(a).duration, this.effectiveRange(b).duration)
      && ['equal-power', 'linear', 'fast-cut'].includes(t.curve);
  }

  constructor() {
    afterNextRender(() => this.initializeTransitionPlayers());
    effect(() => {
      const userId = this.auth.session()?.user?.id ?? null;
      const previousUserId = this.previousUserId;
      if (previousUserId && previousUserId !== userId) {
        queueMicrotask(() => this.clearAllLocalAudio());
      }
      this.previousUserId = userId;
    });
  }

  localCopy(key: LocalCopyKey): string {
    return LOCAL_COPY[this.lang.currentLang()][key];
  }

  transitionCopy(key: keyof typeof TRANSITION_COPY.en): string {
    return TRANSITION_COPY[this.lang.currentLang()][key];
  }

  buildV2Copy(key: keyof typeof BUILD_V2_COPY.en): string {
    return BUILD_V2_COPY[this.lang.currentLang()][key];
  }

  effectiveRange(track: RQSTrack) {
    return buildV2EffectiveRange(track.v2, track.duration);
  }

  hasBuildV2Adjustments(): boolean {
    return this.tracks.some(track => hasBuildV2Adjustments(track.v2, track.duration));
  }

  updateBuildV2Track(index: number, patch: Partial<BuildV2TrackState>): void {
    const track = this.tracks[index];
    if (!track) return;

    const trimChanged =
      Object.prototype.hasOwnProperty.call(
        patch,
        'trimStartSeconds',
      )
      || Object.prototype.hasOwnProperty.call(
        patch,
        'trimEndSeconds',
      );

    track.v2 = normalizeBuildV2TrackState(
      {
        ...track.v2,
        ...patch,
      },
      track.duration,
    );

    /*
     * Do not use the tracks setter here.
     *
     * Gain/Pan must not invalidate or stop the live
     * transport. The Angular event itself triggers the
     * required view update.
     */
    this.currentTracks = [
      ...this.currentTracks,
    ];

    this.stopTransitionPreview();

    if (
      Object.prototype.hasOwnProperty.call(
        patch,
        'gainDb',
      )
    ) {
      this.buildV2LiveEngine?.updateGain(
        track.id,
        dbToLinearGain(
          track.v2.gainDb,
        ),
      );
    }

    if (
      Object.prototype.hasOwnProperty.call(
        patch,
        'pan',
      )
    ) {
      this.buildV2LiveEngine?.updatePan(
        track.id,
        track.v2.pan,
      );
    }

    if (trimChanged) {
      this.invalidateBuildV2TransportPreview(
        false,
      );
    }
  }

  resetBuildV2Track(index: number): void {
    const track = this.tracks[index];
    if (!track) return;

    track.v2 = createBuildV2TrackState();

    this.currentTracks = [
      ...this.currentTracks,
    ];

    this.stopTransitionPreview();

    /*
     * Reset can change Trim as well as Gain/Pan,
     * therefore the current scheduling plan is invalid.
     */
    this.invalidateBuildV2TransportPreview(
      false,
    );
  }

  resetAllBuildV2Tracks(): void {
    this.tracks.forEach(track => {
      track.v2 = createBuildV2TrackState();
    });

    this.currentTracks = [
      ...this.currentTracks,
    ];

    this.stopTransitionPreview();

    this.invalidateBuildV2TransportPreview(
      false,
    );
  }

  async renderBuildV2PocAudioBuffer(): Promise<AudioBuffer> {
    return renderBuildV2FilesOffline(
      this.tracks.map(track => ({
        id: track.id,
        file: track.file,
        state: {
          ...track.v2,
        },
      })),
      this.transitions.map(transition => ({
        duration: transition.duration,
        curve: transition.curve,
      })),
      {
        sampleRate: 48_000,
      },
    );
  }

  canPlayBuildV2Transport(): boolean {
    return (
      this.tracks.length > 0
      && this.buildV2TransportDurationSeconds() > 0
      && !this.buildV2TransportRendering()
    );
  }

  buildV2TransportDurationSeconds(): number {
    const duration =
      this.buildV2TransportSnapshot()
        .durationSeconds;

    return duration > 0
      ? duration
      : this.calculateBuildV2TransportEstimatedDuration();
  }

  private calculateBuildV2TransportEstimatedDuration():
    number {
    const clips = this.tracks.reduce(
      (sum, track) =>
        sum + this.effectiveRange(track).duration,
      0,
    );

    const overlaps = this.transitions.reduce(
      (sum, transition) =>
        sum + Math.max(0, transition.duration),
      0,
    );

    return Math.max(
      0,
      clips - overlaps,
    );
  }

  async playBuildV2Transport(): Promise<void> {
    if (!this.canPlayBuildV2Transport()) {
      return;
    }

    this.stopTransitionPreview();

    const attempt =
      ++this.buildV2TransportAttempt;

    this.setlistError = null;

    try {
      const context =
        this.ensureBuildV2TransportAudioContext();

      if (context.state === 'suspended') {
        await context.resume();
      }

      if (
        attempt
        !== this.buildV2TransportAttempt
      ) {
        return;
      }

      let decoded =
        this.buildV2DecodedTracks;

      if (!decoded) {
        this.buildV2TransportRendering.set(
          true,
        );

        decoded =
          await decodeBuildV2TrackFiles(
            this.tracks.map(track => ({
              id: track.id,
              file: track.file,
              state: {
                ...track.v2,
              },
            })),
            () => ({
              decodeAudioData:
                (data: ArrayBuffer) =>
                  context.decodeAudioData(data),
            }),
          );

        if (
          attempt
          !== this.buildV2TransportAttempt
        ) {
          return;
        }

        this.buildV2DecodedTracks = decoded;
      }

      const decodedById =
        new Map(
          decoded.map(track => [
            track.id,
            track,
          ]),
        );

      const liveTracks:
        BuildV2EngineTrack[] =
        this.tracks.map(track => {
          const decodedTrack =
            decodedById.get(track.id);

          if (!decodedTrack) {
            throw new Error(
              `BUILD_V2_LIVE_BUFFER_MISSING_${track.id}`,
            );
          }

          return {
            id: track.id,
            buffer: decodedTrack.buffer,
            state: {
              ...track.v2,
            },
          };
        });

      const engine =
        this.buildV2LiveEngine
        ?? new BuildV2LiveAudioEngine(
          context,
        );

      this.buildV2LiveEngine = engine;

      const plan = engine.prepare(
        liveTracks,
        this.transitions.map(
          transition => ({
            duration:
              transition.duration,
            curve:
              transition.curve,
          }),
        ),
        context.sampleRate,
      );

      this.cancelBuildV2TransportAnimation();

      this.buildV2TransportSnapshot.set(
        this.buildV2TransportClock.setDuration(
          plan.outputDurationSeconds,
          context.currentTime,
        ),
      );

      const snapshot =
        this.buildV2TransportClock.play(
          context.currentTime,
        );

      this.buildV2TransportSnapshot.set(
        snapshot,
      );

      engine.start(
        snapshot.positionSeconds,
      );

      this.startBuildV2TransportAnimation();
    } catch (error) {
      if (
        attempt
        === this.buildV2TransportAttempt
      ) {
        console.error(
          '[RQS BUILD V2 LIVE ENGINE] '
          + 'Local playback failed.',
          error,
        );

        const messages = {
          en: 'Could not start the BUILD V2 live preview.',
          pt: 'Não foi possível iniciar a prévia ao vivo do BUILD V2.',
          pl: 'Nie udało się uruchomić podglądu na żywo BUILD V2.',
          fr: 'Impossible de démarrer la préécoute en direct du BUILD V2.',
        };

        this.setlistError =
          messages[this.lang.currentLang()];
      }
    } finally {
      if (
        attempt
        === this.buildV2TransportAttempt
      ) {
        this.buildV2TransportRendering.set(
          false,
        );
      }
    }
  }

  pauseBuildV2Transport(): void {
    const context =
      this.buildV2TransportAudioCtx;

    if (
      !context
      || this.buildV2TransportSnapshot()
        .state !== 'playing'
    ) {
      return;
    }

    this.buildV2TransportSnapshot.set(
      this.buildV2TransportClock.pause(
        context.currentTime,
      ),
    );

    this.buildV2LiveEngine?.stop();
    this.cancelBuildV2TransportAnimation();
  }

  stopBuildV2Transport(): void {
    this.buildV2TransportAttempt += 1;
    this.buildV2TransportRendering.set(false);

    this.buildV2LiveEngine?.stop();
    this.cancelBuildV2TransportAnimation();

    this.buildV2TransportSnapshot.set(
      this.buildV2TransportClock.stop(),
    );
  }

  private invalidateBuildV2TransportPreview(
    dropDecoded = false,
  ): void {
    this.stopBuildV2Transport();

    this.buildV2LiveEngine?.clear();

    if (dropDecoded) {
      this.buildV2DecodedTracks = null;
    }

    this.buildV2TransportSnapshot.set(
      this.buildV2TransportClock.setDuration(
        this.calculateBuildV2TransportEstimatedDuration(),
      ),
    );
  }

  private ensureBuildV2TransportAudioContext():
    AudioContext {
    if (!this.buildV2TransportAudioCtx) {
      this.buildV2TransportAudioCtx =
        new (
          window.AudioContext
          || (window as any).webkitAudioContext
        )();
    }

    return this.buildV2TransportAudioCtx;
  }

  private startBuildV2TransportAnimation():
    void {
    const context =
      this.buildV2TransportAudioCtx;

    if (!context) {
      return;
    }

    this.cancelBuildV2TransportAnimation();

    const frame = () => {
      const snapshot =
        this.buildV2TransportClock.tick(
          context.currentTime,
        );

      this.buildV2TransportSnapshot.set(
        snapshot,
      );

      if (snapshot.state !== 'playing') {
        this.buildV2TransportRafId = null;

        if (snapshot.state === 'ended') {
          this.buildV2LiveEngine?.stop();
        }

        return;
      }

      this.buildV2TransportRafId =
        requestAnimationFrame(frame);
    };

    this.buildV2TransportRafId =
      requestAnimationFrame(frame);
  }

  private cancelBuildV2TransportAnimation():
    void {
    if (
      this.buildV2TransportRafId
      !== null
    ) {
      cancelAnimationFrame(
        this.buildV2TransportRafId,
      );
    }

    this.buildV2TransportRafId = null;
  }

  curveLabel(curve: SetlistCurve): string {
    const copy = this.lang.tr();
    return curve === 'linear' ? copy.CURVE_LINEAR
      : curve === 'fast-cut' ? copy.CURVE_FAST_CUT : copy.CURVE_EQUAL_POWER;
  }

  private initializeTransitionPlayers(): void {
    this.playerElement1 = new Audio();
    this.playerElement2 = new Audio();
  }

  private initializeWebAudio(): boolean {
    if (!this.playerElement1 || !this.playerElement2) return false;
    if (this.audioCtx) return true;
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.sourceNode1 = this.audioCtx.createMediaElementSource(this.playerElement1);
    this.sourceNode2 = this.audioCtx.createMediaElementSource(this.playerElement2);
    this.gainNode1 = this.audioCtx.createGain();
    this.gainNode2 = this.audioCtx.createGain();
    this.panNode1 = this.audioCtx.createStereoPanner();
    this.panNode2 = this.audioCtx.createStereoPanner();
    this.sourceNode1.connect(this.gainNode1);
    this.sourceNode2.connect(this.gainNode2);
    this.gainNode1.connect(this.panNode1);
    this.gainNode2.connect(this.panNode2);
    this.panNode1.connect(this.audioCtx.destination);
    this.panNode2.connect(this.audioCtx.destination);
    return true;
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files) this.addFiles(Array.from(event.dataTransfer.files));
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) this.addFiles(Array.from(input.files));
    input.value = '';
  }

  maxTrackCount(): number {
    return this.auth.userRole() === 'premium' ? 8 : 3;
  }

  trackLimitSelectionMessage(): string {
    return this.localCopy('trackLimitSelection').replace('{max}', String(this.maxTrackCount()));
  }

  private addFiles(newFiles: File[]): void {
    const validFiles = newFiles.filter((file) => /\.(wav|mp3)$/i.test(file.name));
    const remaining = Math.max(0, this.maxTrackCount() - this.tracks.length);
    const acceptedFiles = validFiles.slice(0, remaining);
    acceptedFiles.forEach((file) => {
      const track = this.createTrack(file);
      this.tracks.push(track);
      this.uploadTrack(track);
    });
    this.tracks = [...this.tracks];
    this.stopTransitionPreview();
    const planLimitReached = validFiles.length > acceptedFiles.length;
    this.pricingUpgradeRequired.set(planLimitReached);
    this.setlistError = planLimitReached ? this.trackLimitSelectionMessage() : null;
  }

  onVignetteSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file || !/\.(wav|mp3)$/i.test(file.name)) return;
    if (this.vignetteTrack) this.disposeTrack(this.vignetteTrack);
    this.vignetteEnabled = true;
    this.vignetteTrack = this.createTrack(file);
    this.uploadTrack(this.vignetteTrack);
  }

  onVignetteToggle(): void {
    if (!this.vignetteEnabled) this.removeVignette();
  }

  replaceTrackFile(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file || !/\.(wav|mp3)$/i.test(file.name) || !this.tracks[index]) return;
    const previous = this.tracks[index];
    this.stopTransitionPreview();
    this.disposeTrack(previous);
    const replacement = this.createTrack(file);
    replacement.id = previous.id;
    replacement.crossfadeNext = previous.crossfadeNext;
    this.tracks[index] = replacement;
    this.tracks = [...this.tracks];
    this.uploadTrack(replacement);
  }

  private createTrack(file: File): RQSTrack {
    const rawUrl = URL.createObjectURL(file);
    const track: RQSTrack = {
      id: crypto.randomUUID(),
      file,
      name: file.name,
      crossfadeNext: 8,
      rawUrl,
      previewUrl: this.sanitizer.bypassSecurityTrustUrl(rawUrl),
      duration: 0,
      s3Key: null,
      uploadState: 'idle',
      uploadError: null,
      uploadAttempt: 0,
      v2: createBuildV2TrackState(),
    };
    const audio = new Audio(rawUrl);
    const finish = () => {
      audio.removeAttribute('src');
      audio.load();
    };
    audio.addEventListener('loadedmetadata', () => {
      track.duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      this.tracks = [...this.tracks];
      finish();
    }, { once: true });
    audio.addEventListener('error', finish, { once: true });
    audio.load();
    return track;
  }

  private uploadTrack(track: RQSTrack): void {
    if (!this.hasAuthenticatedBuildSession()) return;
    const attempt = ++track.uploadAttempt;
    track.s3Key = null;
    track.uploadError = null;
    track.uploadState = 'uploading';
    this.dspService.getSetlistPresignedUrl(track.file.name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (presign) => {
          if (!this.isCurrentAttempt(track, attempt)) return;
          this.dspService.uploadToS3(presign.uploadUrl, track.file)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: () => {
                if (!this.isCurrentAttempt(track, attempt)) return;
                track.s3Key = presign.s3Key;
                track.uploadState = 'ready';
              },
              error: () => this.markUploadError(track, attempt),
            });
        },
        error: () => this.markUploadError(track, attempt),
      });
  }

  private hasAuthenticatedBuildSession(): boolean {
    const session = this.auth.session();
    if (session?.user?.id && session.access_token?.trim()) return true;
    this.auth.requestSignIn('general');
    return false;
  }

  private isCurrentAttempt(track: RQSTrack, attempt: number): boolean {
    return track.uploadAttempt === attempt
      && (this.tracks.includes(track) || this.vignetteTrack === track);
  }

  private markUploadError(track: RQSTrack, attempt: number): void {
    if (!this.isCurrentAttempt(track, attempt)) return;
    track.s3Key = null;
    track.uploadState = 'error';
    track.uploadError = this.localCopy('uploadError');
  }

  retryTrackUpload(index: number): void {
    const track = this.tracks[index];
    if (track) this.uploadTrack(track);
  }

  retryVignetteUpload(): void {
    if (this.vignetteTrack) this.uploadTrack(this.vignetteTrack);
  }

  uploadStatus(track: RQSTrack): string {
    if (track.uploadState === 'uploading') return this.localCopy('uploading');
    if (track.uploadState === 'ready') return this.localCopy('ready');
    if (track.uploadState === 'error') return this.localCopy('uploadError');
    return '';
  }

  calculateSourceDuration(): number {
    return this.tracks.reduce((sum, track) => sum + track.duration, 0);
  }

  calculateCrossfadeDuration(): number {
    return this.transitions.reduce((sum, transition) => sum + transition.duration, 0);
  }

  calculateEstimatedOutputDuration(): number {
    return Math.max(0, this.calculateSourceDuration() - this.calculateCrossfadeDuration());
  }

  calculateEstimatedSizeMb(): number {
    const bytesPerSecond = 48000 * 3 * 2;
    return Math.round((bytesPerSecond * this.calculateEstimatedOutputDuration()) / (1024 * 1024));
  }

  setLoudnessMode(mode: SetlistLoudnessMode): void {
    this.loudnessMatchMode = mode;
  }

  canIgniteSetlist(): boolean {
    if (this.isProcessing || this.tracks.length < 2 || this.tracks.length > this.maxTrackCount()) return false;
    if (this.hasBuildV2Adjustments()) return false;
    if (!this.setlistName.trim()) return false;
    if (this.tracks.some((track) => track.uploadState !== 'ready' || !track.s3Key || track.duration <= 0)) {
      return false;
    }
    if (this.vignetteEnabled && (!this.vignetteTrack || this.vignetteTrack.uploadState !== 'ready' || !this.vignetteTrack.s3Key)) {
      return false;
    }
    return this.transitions.length === this.tracks.length - 1
      && this.transitions.every((_, index) => this.canPreviewTransition(index));
  }

  async previewTransition(index: number): Promise<void> {
    if (!this.canPreviewTransition(index)) return;
    this.stopBuildV2Transport();
    this.stopTransitionPreview();
    const attempt = this.previewAttempt;
    const transition = { ...this.transitions[index] };
    const track1 = this.tracks[index];
    const track2 = this.tracks[index + 1];
    if (!this.initializeWebAudio() || !this.audioCtx || !this.playerElement1 || !this.playerElement2) return;
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
    if (attempt !== this.previewAttempt) return;

    this.previewingIndex = index;
    this.previewProgress.set(0);
    const fadeDuration = transition.duration;
    const range1 = this.effectiveRange(track1);
    const range2 = this.effectiveRange(track2);
    const previewLead = Math.min(12, Math.max(0, range1.duration - fadeDuration));
    const previewTail = Math.min(12, Math.max(0, range2.duration - fadeDuration));
    const totalDuration = previewLead + fadeDuration + previewTail;
    const startTimeTrack1 = Math.max(range1.start, range1.end - previewLead - fadeDuration);

    this.playerElement1.src = track1.rawUrl;
    this.playerElement2.src = track2.rawUrl;
    this.playerElement1.currentTime = startTimeTrack1;
    this.playerElement2.currentTime = range2.start;
    await this.playerElement1.play();
    if (attempt !== this.previewAttempt) return;

    const now = this.audioCtx.currentTime;
    this.previewBaseGain1 = dbToLinearGain(track1.v2.gainDb);
    this.previewBaseGain2 = dbToLinearGain(track2.v2.gainDb);
    this.panNode1?.pan.setValueAtTime(track1.v2.pan, now);
    this.panNode2?.pan.setValueAtTime(track2.v2.pan, now);
    this.gainNode1.gain.setValueAtTime(this.previewBaseGain1, now);
    this.gainNode2.gain.setValueAtTime(0, now);
    let progressSeconds = 0;
    const intervalMs = 100;
    this.previewIntervalId = setInterval(async () => {
      progressSeconds += intervalMs / 1000;
      this.previewProgress.set((progressSeconds / totalDuration) * 100);
      if (progressSeconds >= previewLead && progressSeconds < previewLead + intervalMs / 1000) {
        await this.playerElement2?.play();
        if (attempt !== this.previewAttempt) return;
        this.applyCrossfadeCurve(fadeDuration, transition.curve);
      }
      if (progressSeconds >= totalDuration) this.stopTransitionPreview();
    }, intervalMs);
  }

  private applyCrossfadeCurve(duration: number, curve: SetlistCurve): void {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    if (curve === 'linear') {
      this.gainNode1.gain.setValueAtTime(this.previewBaseGain1, now);
      this.gainNode1.gain.linearRampToValueAtTime(0, now + duration);
      this.gainNode2.gain.setValueAtTime(0, now);
      this.gainNode2.gain.linearRampToValueAtTime(this.previewBaseGain2, now + duration);
    } else if (curve === 'equal-power') {
      const steps = 100;
      const curve1 = new Float32Array(steps);
      const curve2 = new Float32Array(steps);
      for (let index = 0; index < steps; index += 1) {
        const ratio = index / (steps - 1);
        curve1[index] = Math.cos(ratio * Math.PI / 2) * this.previewBaseGain1;
        curve2[index] = Math.sin(ratio * Math.PI / 2) * this.previewBaseGain2;
      }
      this.gainNode1.gain.setValueCurveAtTime(curve1, now, duration);
      this.gainNode2.gain.setValueCurveAtTime(curve2, now, duration);
    } else {
      this.gainNode1.gain.setValueAtTime(this.previewBaseGain1, now);
      this.gainNode1.gain.exponentialRampToValueAtTime(
        Math.max(0.000001, this.previewBaseGain1 * 0.001),
        now + duration * 0.3,
      );
      this.gainNode2.gain.setValueAtTime(
        Math.max(0.000001, this.previewBaseGain2 * 0.001),
        now,
      );
      this.gainNode2.gain.exponentialRampToValueAtTime(this.previewBaseGain2, now + duration);
    }
  }

  stopTransitionPreview(): void {
    this.previewAttempt += 1;
    if (this.previewIntervalId) clearInterval(this.previewIntervalId);
    this.previewIntervalId = null;
    this.playerElement1?.pause();
    this.playerElement2?.pause();
    this.previewingIndex = -1;
    this.previewProgress.set(0);
  }

  moveUp(index: number): void {
    if (index > 0) [this.tracks[index - 1], this.tracks[index]] = [this.tracks[index], this.tracks[index - 1]];
    this.tracks = [...this.tracks];
    this.stopTransitionPreview();
  }

  moveDown(index: number): void {
    if (index < this.tracks.length - 1) [this.tracks[index + 1], this.tracks[index]] = [this.tracks[index], this.tracks[index + 1]];
    this.tracks = [...this.tracks];
    this.stopTransitionPreview();
  }

  removeTrack(index: number): void {
    const track = this.tracks[index];
    if (!track) return;
    this.disposeTrack(track);
    this.tracks.splice(index, 1);
    this.tracks = [...this.tracks];
    this.stopTransitionPreview();
  }

  removeVignette(): void {
    if (this.vignetteTrack) this.disposeTrack(this.vignetteTrack);
    this.vignetteTrack = null;
    this.vignetteEnabled = false;
  }

  private disposeTrack(track: RQSTrack): void {
    track.uploadAttempt += 1;
    track.s3Key = null;
    track.uploadState = 'idle';
    URL.revokeObjectURL(track.rawUrl);
  }

  private cancelActiveRender(): void {
    this.renderAttempt += 1;
    this.activeRenderSubscription?.unsubscribe();
    this.activeRenderSubscription = null;
    if (this.successResetTimer) clearTimeout(this.successResetTimer);
    this.successResetTimer = null;
    this.isProcessing = false;
    this.mixSuccess = false;
  }

  private isCurrentRender(attempt: number, userId: string | null): boolean {
    return this.renderAttempt === attempt
      && Boolean(userId)
      && this.auth.session()?.user?.id === userId;
  }

  private renderErrorMessage(error: unknown): string {
    const code = (error as { error?: { code?: unknown } })?.error?.code;
    return code === 'SETLIST_PLAN_LIMIT_EXCEEDED'
      ? this.localCopy('trackLimitServer')
      : this.localCopy('serverError');
  }

  private isPlanLimitError(error: unknown): boolean {
    return (error as { error?: { code?: unknown } })?.error?.code === 'SETLIST_PLAN_LIMIT_EXCEEDED';
  }

  igniteSetlist(): void {
    if (!this.hasAuthenticatedBuildSession()) return;
    this.stopBuildV2Transport();
    this.cancelActiveRender();
    if (this.hasBuildV2Adjustments()) {
      this.setlistError = this.buildV2Copy('renderBlocked');
      return;
    }
    if (!this.canIgniteSetlist()) {
      this.setlistError = this.localCopy('renderBlocked');
      return;
    }
    const trackKeys = this.tracks.map((track) => track.s3Key);
    if (trackKeys.some((key) => !key)) {
      this.setlistError = this.localCopy('renderBlocked');
      return;
    }

    const payload: SetlistRenderRequest = {
      tracks: trackKeys as string[],
      vignette: this.vignetteEnabled ? this.vignetteTrack?.s3Key ?? null : null,
      crossfades: this.transitions.map(t => t.duration),
      curves: this.transitions.map(t => t.curve),
      curve: this.activeCurve,
      loudness: this.loudnessMatchMode,
      exportName: this.setlistName,
      outputFormat: 'wav',
    };

    const userId = this.auth.session()?.user?.id ?? null;
    const attempt = ++this.renderAttempt;
    this.isProcessing = true;
    this.mixSuccess = false;
    this.setlistError = null;
    this.pricingUpgradeRequired.set(false);
    this.stopTransitionPreview();
    const subscription = this.dspService.generateMixS3(payload).subscribe({
      next: (response) => {
        if (!this.isCurrentRender(attempt, userId)) return;
        this.activeRenderSubscription = null;
        this.isProcessing = false;
        this.mixSuccess = true;
        this.audioComparison.audioProcessed.set(true);
        this.audioComparison.processedFilename.set(response.fileName);
        this.analytics.trackEvent('setlist_created');
        const anchor = document.createElement('a');
        anchor.href = response.downloadUrl;
        anchor.download = response.fileName;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        this.successResetTimer = setTimeout(() => {
          if (this.isCurrentRender(attempt, userId)) this.mixSuccess = false;
          this.successResetTimer = null;
        }, 5000);
      },
      error: (error) => {
        if (!this.isCurrentRender(attempt, userId)) return;
        this.activeRenderSubscription = null;
        this.isProcessing = false;
        this.pricingUpgradeRequired.set(this.isPlanLimitError(error));
        this.setlistError = this.renderErrorMessage(error);
      },
    });
    this.activeRenderSubscription = subscription.closed ? null : subscription;
  }

  formatDuration(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  updateCrossfadeView(): void {
    this.tracks = [...this.tracks];
  }

  private clearAllLocalAudio(): void {
    this.stopBuildV2Transport();
    this.cancelActiveRender();
    this.stopTransitionPreview();
    this.tracks.forEach((track) => this.disposeTrack(track));
    this.tracks = [];
    this.removeVignette();
    this.setlistError = null;
  }

  ngOnDestroy(): void {
    this.clearAllLocalAudio();

    if (this.audioCtx) {
      void this.audioCtx.close();
    }

    if (this.buildV2TransportAudioCtx) {
      void this.buildV2TransportAudioCtx.close();
    }

    this.audioCtx = null;
    this.buildV2TransportAudioCtx = null;
  }
}
