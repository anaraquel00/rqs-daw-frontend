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
import { firstValueFrom, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import {
  DspService,
  type BuildV2CloudQuotaResponse,
  type BuildV2CloudProjectSummary,
  SetlistCurve,
  SetlistLoudnessMode,
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
  buildV2MinimumEffectiveDuration,
  createBuildV2TrackState,
  dbToLinearGain,
  hasBuildV2Adjustments,
  normalizeBuildV2TrackState,
  normalizeBuildV2TrimForTransitions,
} from './build-v2-track-state';
import {
  renderBuildV2FilesOffline,
} from './build-v2-local-render';
import {
  encodeBuildV2WavPcm24,
} from './build-v2-wav-encoder';
import {
  decodeBuildV2TrackFiles,
} from './build-v2-audio-decoder';
import type {
  BuildV2EngineFinalFade,
  BuildV2EngineTrack,
} from './build-v2-audio-engine';
import {
  BuildV2LiveAudioEngine,
} from './build-v2-live-audio-engine';
import {
  BuildV2TransportClock,
  type BuildV2TransportSnapshot,
} from './build-v2-live-transport';
import {
  buildV2GlobalSecondsToSource,
  buildV2SourceSecondsToGlobal,
  buildV2TimelineDurationSeconds,
  buildV2TrackTimelineStartSeconds,
} from './build-v2-track-playhead';
import {
  BUILD_V2_TRANSITION_MAX_SECONDS,
  BUILD_V2_TRANSITION_MIN_SECONDS,
  buildV2SharedTransitionMaxDuration,
  buildV2TransitionMaxDuration as calculateBuildV2TransitionMaxDuration,
  normalizeBuildV2TransitionCurve,
  normalizeBuildV2TransitionDuration,
} from './build-v2-transition-state';
import {
  BuildV2FinalFadeState,
  BUILD_V2_FINAL_FADE_MIN_SECONDS,
  buildV2FinalFadeMaxDuration,
  createBuildV2FinalFadeState,
  normalizeBuildV2FinalFadeState,
} from './build-v2-final-fade';
import type {
  BuildV2EngineVignette,
} from './build-v2-vignette';
import {
  buildBuildV2ProjectSnapshot,
  type BuildV2ProjectSaveSnapshot,
} from './build-v2-project-session';
import type {
  BuildV2ProjectDocumentV1,
} from './build-v2-project-schema';
import { parseBuildV2ProjectDocument } from './build-v2-project-schema';
import {
  buildBuildV2ProjectRestorePlan,
} from './build-v2-project-restore';
import {
  BuildV2ProjectStorage,
  type BuildV2LocalProjectSummary,
} from './build-v2-project-storage';
import {
  BuildV2CloudProjectRestoreService,
} from '../services/build-v2-cloud-project-restore.service';
import {
  BuildV2CloudAuthoringError,
  BuildV2CloudProjectAuthoringService,
} from '../services/build-v2-cloud-project-authoring.service';
import {
  ensureBuildV2ServerRenderSources,
  type BuildV2ServerRenderSource,
  type BuildV2ServerRenderSourceCandidate,
} from './build-v2-server-render-source';

export type SetlistUploadState = 'idle' | 'uploading' | 'ready' | 'error';

export interface RQSTrack {
  id: string;
  assetId: string;
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
    renderBlocked: 'Server render requires a valid signed-in BUILD V2 session with loudness normalization off.',
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
    renderBlocked: 'O render server exige uma sessão BUILD V2 válida e autenticada, com normalização de loudness desligada.',
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
    renderBlocked: 'Render serwerowy wymaga prawidłowej, zalogowanej sesji BUILD V2 z wyłączoną normalizacją głośności.',
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
    renderBlocked: 'Le rendu serveur exige une session BUILD V2 valide et connectée, avec la normalisation du volume désactivée.',
    trackLimitSelection: 'Votre offre autorise jusqu’à {max} pistes musicales. Les fichiers supplémentaires n’ont pas été téléversés.',
    trackLimitServer: 'La limite de pistes Setlist de votre compte a été dépassée. Actualisez le profil et réessayez.',
    serverError: 'La requête Setlist a échoué de façon sécurisée. Vérifiez les champs et réessayez.',
  },
};

const BUILD_V2_COPY = {
  en: {
    title: 'BUILD V2 preview lab',
    previewOnly: 'BUILD V2 active · Preview and local WAV export run on this device. GENERATE FINAL SETLIST uses the BUILD V2 server engine.',
    trimStart: 'Trim start',
    trimEnd: 'Trim end',
    gain: 'Gain',
    pan: 'Pan',
    effective: 'Effective clip',
    reset: 'Reset V2 controls',
    resetAll: 'Reset all V2 controls',
    renderBlocked: 'Server V2 currently supports loudness mode OFF. Disable normalization to render.',
    workspace: 'RQS BUILD V2',
    workflow: 'ARRANGE · MIX · TRANSITION · EXPORT',
    previewReady: 'LOCAL PREVIEW READY',
    timeline: 'SETLIST TIMELINE',
    selectedTrack: 'SELECTED TRACK',
    source: 'Source',
    bounceWav: 'EXPORT LOCAL WAV',
    bouncingWav: 'EXPORTING WAV…',
    downloadWav: 'DOWNLOAD LOCAL WAV',
    bounceFailed: 'Local WAV export failed safely. Review the project audio and retry.',
  },
  pt: {
    title: 'Laboratório de prévia BUILD V2',
    previewOnly: 'BUILD V2 ativo · A prévia e a exportação WAV local são processadas neste dispositivo. GERAR SETLIST FINAL usa o motor BUILD V2 server-side.',
    trimStart: 'Corte inicial',
    trimEnd: 'Corte final',
    gain: 'Ganho',
    pan: 'Pan',
    effective: 'Clipe efetivo',
    reset: 'Resetar controles V2',
    resetAll: 'Resetar todos os controles V2',
    renderBlocked: 'O servidor V2 aceita atualmente o modo de loudness OFF. Desative a normalização para renderizar.',
    workspace: 'RQS BUILD V2',
    workflow: 'ARRANJO · MIX · TRANSIÇÃO · EXPORTAÇÃO',
    previewReady: 'PRÉVIA LOCAL PRONTA',
    timeline: 'LINHA DO TEMPO DA SETLIST',
    selectedTrack: 'FAIXA SELECIONADA',
    source: 'Origem',
    bounceWav: 'EXPORTAR WAV LOCAL',
    bouncingWav: 'EXPORTANDO WAV…',
    downloadWav: 'BAIXAR WAV LOCAL',
    bounceFailed: 'A exportação WAV local falhou com segurança. Revise o áudio do projeto e tente novamente.',
  },
  pl: {
    title: 'Laboratorium podglądu BUILD V2',
    previewOnly: 'BUILD V2 aktywny · Podgląd i lokalny eksport WAV są przetwarzane na tym urządzeniu. GENERUJ FINALNĄ SETLISTĘ używa silnika BUILD V2 po stronie serwera.',
    trimStart: 'Początek cięcia',
    trimEnd: 'Koniec cięcia',
    gain: 'Wzmocnienie',
    pan: 'Panorama',
    effective: 'Efektywny klip',
    reset: 'Resetuj kontrolki V2',
    resetAll: 'Resetuj wszystkie kontrolki V2',
    renderBlocked: 'Serwer V2 obsługuje obecnie tryb głośności OFF. Wyłącz normalizację, aby renderować.',
    workspace: 'RQS BUILD V2',
    workflow: 'ARANŻACJA · MIKS · PRZEJŚCIA · EKSPORT',
    previewReady: 'PODGLĄD LOKALNY GOTOWY',
    timeline: 'OŚ CZASU SETLISTY',
    selectedTrack: 'WYBRANY UTWÓR',
    source: 'Źródło',
    bounceWav: 'EKSPORTUJ WAV LOKALNIE',
    bouncingWav: 'EKSPORTOWANIE WAV…',
    downloadWav: 'POBIERZ LOKALNY WAV',
    bounceFailed: 'Lokalny eksport WAV nie powiódł się bezpiecznie. Sprawdź dźwięk projektu i spróbuj ponownie.',
  },
  fr: {
    title: 'Laboratoire de préécoute BUILD V2',
    previewOnly: 'BUILD V2 actif · La préécoute et l’export WAV local sont traités sur cet appareil. GÉNÉRER LA SETLIST FINALE utilise le moteur BUILD V2 côté serveur.',
    trimStart: 'Début du trim',
    trimEnd: 'Fin du trim',
    gain: 'Gain',
    pan: 'Panoramique',
    effective: 'Clip effectif',
    reset: 'Réinitialiser les contrôles V2',
    resetAll: 'Réinitialiser tous les contrôles V2',
    renderBlocked: 'Le serveur V2 prend actuellement en charge le mode de volume OFF. Désactivez la normalisation pour effectuer le rendu.',
    workspace: 'RQS BUILD V2',
    workflow: 'ARRANGEMENT · MIX · TRANSITIONS · EXPORT',
    previewReady: 'PRÉÉCOUTE LOCALE PRÊTE',
    timeline: 'TIMELINE DE LA SETLIST',
    selectedTrack: 'PISTE SÉLECTIONNÉE',
    source: 'Source',
    bounceWav: 'EXPORTER LE WAV LOCAL',
    bouncingWav: 'EXPORT DU WAV…',
    downloadWav: 'TÉLÉCHARGER LE WAV LOCAL',
    bounceFailed: 'L’export WAV local a échoué sans risque. Vérifiez l’audio du projet et réessayez.',
  },
} as const;

const TRANSITION_COPY = {
  en: { defaults: 'Default transition', duration: 'Duration', curve: 'Curve', apply: 'Apply to all transitions', transition: 'Transition', edit: 'Edit', reset: 'Reset to default', inherited: 'Default', custom: 'Custom', limits: '0.5–15 seconds · shorter than both adjacent tracks' },
  pt: { defaults: 'Transição padrão', duration: 'Duração', curve: 'Curva', apply: 'Aplicar a todas as transições', transition: 'Transição', edit: 'Editar', reset: 'Restaurar padrão', inherited: 'Padrão', custom: 'Personalizada', limits: '0,5–15 segundos · menor que ambas as faixas adjacentes' },
  pl: { defaults: 'Domyślne przejście', duration: 'Czas', curve: 'Krzywa', apply: 'Zastosuj do wszystkich przejść', transition: 'Przejście', edit: 'Edytuj', reset: 'Przywróć domyślne', inherited: 'Domyślne', custom: 'Własne', limits: '0,5–15 sekund · krócej niż oba sąsiednie utwory' },
  fr: { defaults: 'Transition par défaut', duration: 'Durée', curve: 'Courbe', apply: 'Appliquer à toutes les transitions', transition: 'Transition', edit: 'Modifier', reset: 'Rétablir les valeurs par défaut', inherited: 'Par défaut', custom: 'Personnalisée', limits: '0,5–15 secondes · plus court que les deux pistes adjacentes' },
};

const CLOUD_PROJECT_COPY = {
  en: {
    title: 'CLOUD PROJECTS', refresh: 'REFRESH', open: 'OPEN CLOUD', empty: 'NO CLOUD PROJECTS',
    select: 'SELECT CLOUD PROJECT', loading: 'LOADING CLOUD PROJECTS…', opened: 'CLOUD PROJECT RESTORED',
    active: 'ACTIVE', save: 'SAVE CLOUD', saveAsNew: 'SAVE AS NEW CLOUD', delete: 'DELETE CLOUD', saving: 'SAVING TO CLOUD…',
    saved: 'CLOUD PROJECT SAVED', upToDate: 'CLOUD PROJECT IS UP TO DATE', conflict: 'THIS CLOUD PROJECT CHANGED ELSEWHERE · YOUR SESSION WAS PRESERVED',
    deleting: 'DELETING CLOUD PROJECT…', deleted: 'CLOUD PROJECT DELETED', cleanupPending: 'CLOUD PROJECT DELETED · CLEANUP PENDING',
    projectQuota: 'CLOUD PROJECT LIMIT REACHED', storageQuota: 'CLOUD STORAGE LIMIT REACHED',
    saveError: 'CLOUD SAVE FAILED', deleteError: 'CLOUD DELETE FAILED', confirmDelete: 'Delete this cloud project? Local audio will stay open.',
    error: 'CLOUD RESTORE FAILED', revision: 'REVISION', signedOut: 'SIGN IN TO USE CLOUD PROJECTS',
  },
  pt: {
    title: 'PROJETOS NA NUVEM', refresh: 'ATUALIZAR', open: 'ABRIR DA NUVEM', empty: 'NENHUM PROJETO NA NUVEM',
    select: 'SELECIONE UM PROJETO NA NUVEM', loading: 'CARREGANDO PROJETOS NA NUVEM…', opened: 'PROJETO DA NUVEM RESTAURADO',
    active: 'ATIVO', save: 'SALVAR NA NUVEM', saveAsNew: 'SALVAR COMO NOVO NA NUVEM', delete: 'EXCLUIR DA NUVEM', saving: 'SALVANDO NA NUVEM…',
    saved: 'PROJETO SALVO NA NUVEM', upToDate: 'PROJETO NA NUVEM JÁ ESTÁ ATUALIZADO', conflict: 'ESTE PROJETO MUDOU EM OUTRO LOCAL · SUA SESSÃO FOI PRESERVADA',
    deleting: 'EXCLUINDO PROJETO DA NUVEM…', deleted: 'PROJETO DA NUVEM EXCLUÍDO', cleanupPending: 'PROJETO EXCLUÍDO · LIMPEZA PENDENTE',
    projectQuota: 'LIMITE DE PROJETOS NA NUVEM ATINGIDO', storageQuota: 'LIMITE DE ARMAZENAMENTO NA NUVEM ATINGIDO',
    saveError: 'FALHA AO SALVAR NA NUVEM', deleteError: 'FALHA AO EXCLUIR DA NUVEM', confirmDelete: 'Excluir este projeto da nuvem? O áudio local permanecerá aberto.',
    error: 'FALHA AO RESTAURAR DA NUVEM', revision: 'REVISÃO', signedOut: 'ENTRE PARA USAR PROJETOS NA NUVEM',
  },
  pl: {
    title: 'PROJEKTY W CHMURZE', refresh: 'ODŚWIEŻ', open: 'OTWÓRZ Z CHMURY', empty: 'BRAK PROJEKTÓW W CHMURZE',
    select: 'WYBIERZ PROJEKT W CHMURZE', loading: 'ŁADOWANIE PROJEKTÓW W CHMURZE…', opened: 'PROJEKT Z CHMURY PRZYWRÓCONY',
    active: 'AKTYWNY', save: 'ZAPISZ W CHMURZE', saveAsNew: 'ZAPISZ JAKO NOWY W CHMURZE', delete: 'USUŃ Z CHMURY', saving: 'ZAPISYWANIE W CHMURZE…',
    saved: 'PROJEKT ZAPISANY W CHMURZE', upToDate: 'PROJEKT W CHMURZE JEST AKTUALNY', conflict: 'TEN PROJEKT ZMIENIŁ SIĘ GDZIE INDZIEJ · TWOJA SESJA ZOSTAŁA ZACHOWANA',
    deleting: 'USUWANIE PROJEKTU Z CHMURY…', deleted: 'PROJEKT USUNIĘTY Z CHMURY', cleanupPending: 'PROJEKT USUNIĘTY · OCZEKIWANIE NA CZYSZCZENIE',
    projectQuota: 'OSIĄGNIĘTO LIMIT PROJEKTÓW W CHMURZE', storageQuota: 'OSIĄGNIĘTO LIMIT PAMIĘCI W CHMURZE',
    saveError: 'NIE UDAŁO SIĘ ZAPISAĆ W CHMURZE', deleteError: 'NIE UDAŁO SIĘ USUNĄĆ Z CHMURY', confirmDelete: 'Usunąć ten projekt z chmury? Lokalne audio pozostanie otwarte.',
    error: 'NIE UDAŁO SIĘ PRZYWRÓCIĆ Z CHMURY', revision: 'WERSJA', signedOut: 'ZALOGUJ SIĘ, ABY UŻYWAĆ PROJEKTÓW W CHMURZE',
  },
  fr: {
    title: 'PROJETS CLOUD', refresh: 'ACTUALISER', open: 'OUVRIR DEPUIS LE CLOUD', empty: 'AUCUN PROJET CLOUD',
    select: 'SÉLECTIONNER UN PROJET CLOUD', loading: 'CHARGEMENT DES PROJETS CLOUD…', opened: 'PROJET CLOUD RESTAURÉ',
    active: 'ACTIF', save: 'ENREGISTRER DANS LE CLOUD', saveAsNew: 'ENREGISTRER COMME NOUVEAU DANS LE CLOUD', delete: 'SUPPRIMER DU CLOUD', saving: 'ENREGISTREMENT DANS LE CLOUD…',
    saved: 'PROJET ENREGISTRÉ DANS LE CLOUD', upToDate: 'LE PROJET CLOUD EST À JOUR', conflict: 'CE PROJET A ÉTÉ MODIFIÉ AILLEURS · VOTRE SESSION A ÉTÉ PRÉSERVÉE',
    deleting: 'SUPPRESSION DU PROJET CLOUD…', deleted: 'PROJET CLOUD SUPPRIMÉ', cleanupPending: 'PROJET SUPPRIMÉ · NETTOYAGE EN ATTENTE',
    projectQuota: 'LIMITE DE PROJETS CLOUD ATTEINTE', storageQuota: 'LIMITE DE STOCKAGE CLOUD ATTEINTE',
    saveError: 'ÉCHEC DE L’ENREGISTREMENT CLOUD', deleteError: 'ÉCHEC DE LA SUPPRESSION CLOUD', confirmDelete: 'Supprimer ce projet cloud ? L’audio local restera ouvert.',
    error: 'ÉCHEC DE LA RESTAURATION CLOUD', revision: 'RÉVISION', signedOut: 'CONNECTEZ-VOUS POUR UTILISER LES PROJETS CLOUD',
  },
} as const;

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
  private readonly cloudProjectRestore = inject(BuildV2CloudProjectRestoreService);
  private readonly cloudProjectAuthoring = inject(BuildV2CloudProjectAuthoringService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  readonly lang = inject(LanguageService);
  readonly auth = inject(AuthService);
  private readonly analytics = inject(AnalyticsService);

  private readonly buildV2ProjectStorage =
    new BuildV2ProjectStorage();

  localProjects:
    BuildV2LocalProjectSummary[] = [];

  selectedLocalProjectId = '';

  activeLocalProjectId:
    string | null = null;

  activeLocalProjectCreatedAt:
    string | null = null;

  buildV2ProjectStorageBusy = false;

  buildV2ProjectStatus:
    'idle'
    | 'saved'
    | 'opened'
    | 'error' =
    'idle';

  cloudProjects: BuildV2CloudProjectSummary[] = [];

  selectedCloudProjectId = '';

  activeCloudProjectId: string | null = null;

  activeCloudProjectRevision: number | null = null;

  activeCloudProjectBaseline: BuildV2ProjectDocumentV1 | null = null;

  buildV2CloudQuota: BuildV2CloudQuotaResponse | null = null;

  buildV2CloudBusy = false;

  buildV2CloudStatus:
    | 'idle'
    | 'opened'
    | 'saving'
    | 'saved'
    | 'upToDate'
    | 'conflict'
    | 'deleting'
    | 'deleted'
    | 'cleanupPending'
    | 'projectQuota'
    | 'storageQuota'
    | 'saveError'
    | 'deleteError'
    | 'error' = 'idle';

  private buildV2CloudRestoreAttempt = 0;

  private buildV2CloudListAttempt = 0;

  private buildV2CloudMutationAttempt = 0;

  private buildV2CloudReadOperation: 'none' | 'list' | 'restore' = 'none';

  private currentTracks: RQSTrack[] = [];
  selectedTrackId: string | null = null;
  transitions: SetlistTransition[] = [];
  defaultDuration = 8;

  finalFade:
    BuildV2FinalFadeState =
    createBuildV2FinalFadeState();

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

  readonly buildV2BounceRendering =
    signal(false);

  buildV2BounceDownloadUrl: string | null = null;

  buildV2BounceDownloadName = '';

  private buildV2TransportAudioCtx:
    AudioContext | null = null;

  private buildV2LiveEngine:
    BuildV2LiveAudioEngine | null = null;

  private buildV2DecodedTracks:
    BuildV2EngineTrack[] | null = null;

  private buildV2DecodedVignette:
    BuildV2EngineVignette | null = null;

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
  private readonly renderOnlyProjectId = crypto.randomUUID();
  private readonly renderOnlyProjectCreatedAt = new Date().toISOString();
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

  private buildV2EffectiveDurations():
    number[] {
    return this.tracks.map(
      track =>
        this.effectiveRange(track).duration,
    );
  }

  private buildV2TransitionDurations():
    number[] {
    return this.transitions.map(
      transition =>
        transition.duration,
    );
  }

  private buildV2UnifiedTimelineDurationSeconds():
    number {
    return buildV2TimelineDurationSeconds(
      this.buildV2EffectiveDurations(),
      this.buildV2TransitionDurations(),
    );
  }

  private buildV2TrackAudioTimelineStartSeconds(
    index: number,
  ): number {
    return buildV2TrackTimelineStartSeconds(
      this.buildV2EffectiveDurations(),
      this.buildV2TransitionDurations(),
      index,
    );
  }

  trackLocalPlayheadSeconds(
    index: number,
  ): number {
    const track = this.tracks[index];

    if (!track) {
      return 0;
    }

    const range =
      this.effectiveRange(track);

    return (
      buildV2GlobalSecondsToSource(
        this.buildV2TransportSnapshot()
          .positionSeconds,
        this.buildV2TrackAudioTimelineStartSeconds(
          index,
        ),
        range.start,
        range.end,
      )
      ?? 0
    );
  }

  trackLocalPlayheadVisible(
    index: number,
  ): boolean {
    const track = this.tracks[index];

    if (!track) {
      return false;
    }

    const range =
      this.effectiveRange(track);

    return (
      buildV2GlobalSecondsToSource(
        this.buildV2TransportSnapshot()
          .positionSeconds,
        this.buildV2TrackAudioTimelineStartSeconds(
          index,
        ),
        range.start,
        range.end,
      )
      !== null
    );
  }

  seekBuildV2Track(
    index: number,
    sourceSeconds: number,
  ): void {
    const track = this.tracks[index];

    if (!track) {
      return;
    }

    this.selectTrack(track);

    const range =
      this.effectiveRange(track);

    const timelineStart =
      this.buildV2TrackAudioTimelineStartSeconds(
        index,
      );

    const globalSeconds =
      Math.min(
        this.buildV2TransportDurationSeconds(),
        buildV2SourceSecondsToGlobal(
          timelineStart,
          sourceSeconds,
          range.start,
          range.end,
        ),
      );

    const current =
      this.buildV2TransportSnapshot();

    if (current.state === 'playing') {
      const context =
        this.buildV2TransportAudioCtx;

      const engine =
        this.buildV2LiveEngine;

      if (!context || !engine) {
        return;
      }

      const next =
        this.buildV2TransportClock.seek(
          globalSeconds,
          context.currentTime,
        );

      this.buildV2TransportSnapshot.set(
        next,
      );

      if (next.state === 'playing') {
        engine.start(
          next.positionSeconds,
        );
      } else {
        engine.stop();
        this.cancelBuildV2TransportAnimation();
      }

      return;
    }

    this.buildV2TransportSnapshot.set(
      this.buildV2TransportClock.seek(
        globalSeconds,
      ),
    );
  }

  trackTimelineStartSeconds(
    index: number,
  ): number {
    return this.buildV2TrackAudioTimelineStartSeconds(
      index,
    );
  }

  trackTimelineLeftPercent(
    index: number,
  ): number {
    const total =
      this.buildV2UnifiedTimelineDurationSeconds();

    if (total <= 0) {
      return 0;
    }

    return Math.min(
      100,
      (
        this.trackTimelineStartSeconds(index)
        / total
      ) * 100,
    );
  }

  trackTimelineWidthPercent(
    index: number,
  ): number {
    const track = this.tracks[index];

    const total =
      this.buildV2UnifiedTimelineDurationSeconds();

    if (!track || total <= 0) {
      return 0;
    }

    const effectiveDuration =
      this.effectiveRange(track).duration;

    if (effectiveDuration <= 0) {
      return 0;
    }

    const left =
      this.trackTimelineLeftPercent(index);

    const width =
      (
        effectiveDuration
        / total
      ) * 100;

    return Math.max(
      0,
      Math.min(
        width,
        100 - left,
      ),
    );
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
    const seconds = Math.min(
      range.duration,
      transition.duration,
    );

    const start =
      direction === 'in'
        ? range.start
        : range.end - seconds;

    const end = start + seconds;

    const localStart =
      direction === 'in'
        ? 0
        : Math.max(
            0,
            range.duration - seconds,
          );
    const labels = {
      en: { in: 'Transition in', out: 'Transition out' },
      pt: { in: 'Entrada da transição', out: 'Saída da transição' },
      pl: { in: 'Wejście przejścia', out: 'Wyjście przejścia' },
      fr: { in: 'Entrée de transition', out: 'Sortie de transition' },
    };
    const label = labels[this.lang.currentLang()][direction];
    return {
      start,
      end,
      seconds,
      left:
        range.duration > 0
          ? (
            localStart
            / range.duration
          ) * 100
          : 0,
      width:
        range.duration > 0
          ? (
            seconds
            / range.duration
          ) * 100
          : 0,
      label:
        `${label}: ${seconds} s · `
        + `${this.formatDuration(start)} → `
        + `${this.formatDuration(end)}`,
    };
  }

  buildV2TransitionMaxDuration(
    index: number,
  ): number {
    const left =
      this.tracks[index];

    const right =
      this.tracks[index + 1];

    if (!left || !right) {
      return (
        BUILD_V2_TRANSITION_MAX_SECONDS
      );
    }

    const leftIncoming =
      index > 0
        ? (
          this.transitions[index - 1]
            ?.duration
          ?? 0
        )
        : 0;

    const rightOutgoing =
      index + 1
        < this.transitions.length
        ? (
          this.transitions[index + 1]
            ?.duration
          ?? 0
        )
        : 0;

    return Math.max(
      BUILD_V2_TRANSITION_MIN_SECONDS,
      calculateBuildV2TransitionMaxDuration(
        this.effectiveRange(left).duration,
        this.effectiveRange(right).duration,
        leftIncoming,
        rightOutgoing,
      ),
    );
  }

  private buildV2BulkTransitionMaxDuration(
    applyToAll: boolean,
  ): number {
    return Math.max(
      BUILD_V2_TRANSITION_MIN_SECONDS,
      buildV2SharedTransitionMaxDuration(
        this.buildV2EffectiveDurations(),
        this.transitions.map(
          transition =>
            transition.duration,
        ),
        this.transitions.map(
          transition =>
            applyToAll
            || transition.usesDefault,
        ),
      ),
    );
  }

  buildV2DefaultDurationMaxSeconds():
    number {
    return this.buildV2BulkTransitionMaxDuration(
      false,
    );
  }

  private commitBuildV2TransitionMutation(
    nextTransitions:
      SetlistTransition[],
    previous:
      BuildV2TransportSnapshot,
  ): boolean {
    const oldTransitions =
      this.transitions;

    const oldFinalFade = {
      ...this.finalFade,
    };

    this.transitions =
      nextTransitions;

    this.normalizeCurrentBuildV2FinalFade();

    const success =
      this.rescheduleBuildV2TransportAfterStructuralEdit(
        previous,
      );

    if (!success) {
      this.transitions =
        oldTransitions;

      this.finalFade =
        oldFinalFade;

      return false;
    }

    return true;
  }

  updateDefaults(
    duration: number,
    curve: SetlistCurve,
  ): void {
    this.stopTransitionPreview();

    const previous =
      this.captureBuildV2TransportSnapshot();

    const previousDefaultDuration =
      this.defaultDuration;

    const previousActiveCurve =
      this.activeCurve;

    const normalizedCurve =
      normalizeBuildV2TransitionCurve(
        curve,
        this.activeCurve,
      );

    const maximum =
      this.buildV2BulkTransitionMaxDuration(
        false,
      );

    const normalizedDuration =
      normalizeBuildV2TransitionDuration(
        duration,
        this.defaultDuration,
        maximum,
      );

    if (normalizedDuration === null) {
      return;
    }

    this.defaultDuration =
      normalizedDuration;

    this.activeCurve =
      normalizedCurve;

    const nextTransitions =
      this.transitions.map(
        transition =>
          transition.usesDefault
            ? {
                ...transition,
                duration:
                  normalizedDuration,
                curve:
                  normalizedCurve,
              }
            : transition,
      );

    if (
      !this.commitBuildV2TransitionMutation(
        nextTransitions,
        previous,
      )
    ) {
      this.defaultDuration =
        previousDefaultDuration;

      this.activeCurve =
        previousActiveCurve;
    }
  }

  editTransition(
    index: number,
    duration: number,
    curve: SetlistCurve,
  ): void {
    const current =
      this.transitions[index];

    if (!current) {
      return;
    }

    this.stopTransitionPreview();

    const previous =
      this.captureBuildV2TransportSnapshot();

    const maximum =
      this.buildV2TransitionMaxDuration(
        index,
      );

    const normalizedDuration =
      normalizeBuildV2TransitionDuration(
        duration,
        current.duration,
        maximum,
      );

    if (normalizedDuration === null) {
      return;
    }

    const normalizedCurve =
      normalizeBuildV2TransitionCurve(
        curve,
        current.curve,
      );

    const nextTransitions =
      this.transitions.map(
        (transition, transitionIndex) =>
          transitionIndex === index
            ? {
                ...transition,
                duration:
                  normalizedDuration,
                curve:
                  normalizedCurve,
                usesDefault: false,
              }
            : transition,
      );

    this.commitBuildV2TransitionMutation(
      nextTransitions,
      previous,
    );
  }

  resetTransition(
    index: number,
  ): void {
    const current =
      this.transitions[index];

    if (!current) {
      return;
    }

    this.stopTransitionPreview();

    const previous =
      this.captureBuildV2TransportSnapshot();

    const maximum =
      this.buildV2TransitionMaxDuration(
        index,
      );

    const normalizedDuration =
      normalizeBuildV2TransitionDuration(
        this.defaultDuration,
        current.duration,
        maximum,
      );

    if (normalizedDuration === null) {
      return;
    }

    const nextTransitions =
      this.transitions.map(
        (transition, transitionIndex) =>
          transitionIndex === index
            ? {
                ...transition,
                duration:
                  normalizedDuration,
                curve:
                  this.activeCurve,
                usesDefault: true,
              }
            : transition,
      );

    this.commitBuildV2TransitionMutation(
      nextTransitions,
      previous,
    );
  }

  applyDefaultsToAll(): void {
    if (
      this.transitions.length === 0
    ) {
      return;
    }

    this.stopTransitionPreview();

    const previous =
      this.captureBuildV2TransportSnapshot();

    const previousDefaultDuration =
      this.defaultDuration;

    const maximum =
      this.buildV2BulkTransitionMaxDuration(
        true,
      );

    const normalizedDuration =
      normalizeBuildV2TransitionDuration(
        this.defaultDuration,
        this.defaultDuration,
        maximum,
      );

    if (normalizedDuration === null) {
      return;
    }

    this.defaultDuration =
      normalizedDuration;

    const nextTransitions =
      this.transitions.map(
        transition => ({
          ...transition,
          duration:
            normalizedDuration,
          curve:
            this.activeCurve,
          usesDefault: true,
        }),
      );

    if (
      !this.commitBuildV2TransitionMutation(
        nextTransitions,
        previous,
      )
    ) {
      this.defaultDuration =
        previousDefaultDuration;
    }
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
    afterNextRender(() => {
      this.initializeTransitionPlayers();

      void this.refreshBuildV2LocalProjects();
    });
    effect(() => {
      const userId = this.auth.session()?.user?.id ?? null;
      const previousUserId = this.previousUserId;
      if (previousUserId !== userId) {
        this.resetBuildV2CloudState();
        if (previousUserId) {
          queueMicrotask(() => this.clearAllLocalAudio());
        }
        if (userId) {
          queueMicrotask(() => void this.refreshBuildV2CloudProjects());
        }
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

  cloudProjectCopy(key: keyof typeof CLOUD_PROJECT_COPY.en): string {
    return CLOUD_PROJECT_COPY[this.lang.currentLang()][key];
  }

  buildV2ProjectSaveSnapshot(
    projectId: string,
    createdAt: string,
    updatedAt =
      new Date().toISOString(),
  ): BuildV2ProjectSaveSnapshot {
    return buildBuildV2ProjectSnapshot({
      projectId,

      projectName:
        this.setlistName,

      createdAt,
      updatedAt,

      tracks:
        this.tracks.map(
          track => ({
            trackId:
              track.id,

            assetId:
              track.assetId,

            file:
              track.file,

            durationSeconds:
              track.duration,

            state: {
              ...track.v2,
            },
          }),
        ),

      transitions:
        this.transitions.map(
          transition => ({
            fromTrackId:
              transition.fromTrackId,

            toTrackId:
              transition.toTrackId,

            durationSeconds:
              transition.duration,

            curve:
              transition.curve,

            usesDefault:
              transition.usesDefault,
          }),
        ),

      transitionDefaults: {
        durationSeconds:
          this.defaultDuration,

        curve:
          this.activeCurve,
      },

      finalFade: {
        ...this.finalFade,
      },

      vignette: {
        enabled:
          this.vignetteEnabled,

        assetId:
          this.vignetteEnabled
          && this.vignetteTrack
            ? this.vignetteTrack
                .assetId
            : null,

        file:
          this.vignetteEnabled
          && this.vignetteTrack
            ? this.vignetteTrack
                .file
            : null,

        durationSeconds:
          this.vignetteEnabled
          && this.vignetteTrack
            ? this.vignetteTrack
                .duration
            : 0,
      },

      render: {
        exportName:
          this.setlistName,

        loudnessMode:
          this.loudnessMatchMode,
      },
    });
  }


  restoreBuildV2Project(
    project:
      BuildV2ProjectDocumentV1,
    files:
      ReadonlyMap<string, File>,
  ): void {
    const plan =
      buildBuildV2ProjectRestorePlan(
        project,
        files,
      );

    /*
     * Tear down the previous runtime only after the
     * restore plan has passed canonical validation.
     */
    this.clearAllLocalAudio();

    this.defaultDuration =
      plan.transitionDefaults
        .durationSeconds;

    this.activeCurve =
      plan.transitionDefaults.curve;

    this.setlistName =
      plan.render.exportName;

    this.loudnessMatchMode =
      plan.render.loudnessMode;

    this.currentTracks =
      plan.tracks.map(
        track =>
          this.createRestoredTrack(
            track.file,
            track.trackId,
            track.assetId,
            track.durationSeconds,
            track.state,
          ),
      );

    this.transitions =
      plan.transitions.map(
        transition => ({
          fromTrackId:
            transition.fromTrackId,

          toTrackId:
            transition.toTrackId,

          duration:
            transition.durationSeconds,

          curve:
            transition.curve,

          usesDefault:
            transition.usesDefault,
        }),
      );

    this.finalFade = {
      ...plan.finalFade,
    };

    this.vignetteEnabled =
      plan.vignette.enabled;

    this.vignetteTrack =
      plan.vignette.enabled
      && plan.vignette.file
      && plan.vignette.assetId
        ? this.createRestoredTrack(
            plan.vignette.file,
            `vignette:${plan.vignette.assetId}`,
            plan.vignette.assetId,
            plan.vignette.durationSeconds,
            createBuildV2TrackState(),
          )
        : null;

    this.selectedTrackId =
      this.currentTracks[0]?.id
      ?? null;

    this.expandedTransition =
      null;

    this.buildV2DecodedTracks =
      null;

    this.buildV2DecodedVignette =
      null;

    this.pricingUpgradeRequired.set(
      false,
    );

    this.setlistError =
      null;

    this.invalidateBuildV2TransportPreview(
      true,
    );
  }


  canSaveBuildV2Project(): boolean {
    return (
      !this.buildV2ProjectStorageBusy
      && this.tracks.length > 0
      && this.setlistName.trim().length > 0
    );
  }


  canOpenBuildV2Project(): boolean {
    return (
      !this.buildV2ProjectStorageBusy
      && this.selectedLocalProjectId
        .trim()
        .length > 0
    );
  }


  async refreshBuildV2LocalProjects():
    Promise<void> {
    try {
      const projects =
        await this.buildV2ProjectStorage
          .list();

      this.localProjects =
        projects;

      const currentStillExists =
        projects.some(
          project =>
            project.projectId
            === this.selectedLocalProjectId,
        );

      if (
        !currentStillExists
      ) {
        const preferred =
          this.activeLocalProjectId
          && projects.some(
            project =>
              project.projectId
              === this.activeLocalProjectId,
          )
            ? this.activeLocalProjectId
            : projects[0]
                ?.projectId
              ?? '';

        this.selectedLocalProjectId =
          preferred;
      }
    } catch (error) {
      console.warn(
        '[RQS BUILD V2 PROJECT LIST]',
        error,
      );

      this.buildV2ProjectStatus =
        'error';
    }
  }


  canOpenBuildV2CloudProject(): boolean {
    return (
      !!this.auth.session()?.user?.id
      && this.selectedCloudProjectId.trim().length > 0
    );
  }


  canSaveBuildV2CloudProject(): boolean {
    return (
      !!this.auth.session()?.user?.id
      && this.tracks.length > 0
      && this.setlistName.trim().length > 0
      && !this.buildV2CloudBusy
      && !this.buildV2ProjectStorageBusy
    );
  }


  canDeleteBuildV2CloudProject(): boolean {
    return (
      !!this.auth.session()?.user?.id
      && this.selectedCloudProjectId.trim().length > 0
      && this.cloudProjects.some(
        project => project.projectId === this.selectedCloudProjectId,
      )
      && !this.buildV2CloudBusy
    );
  }


  async refreshBuildV2CloudProjects(): Promise<void> {
    const userId = this.auth.session()?.user?.id ?? null;
    if (!userId || this.buildV2CloudBusy) return;

    const attempt = ++this.buildV2CloudListAttempt;
    this.buildV2CloudBusy = true;
    this.buildV2CloudReadOperation = 'list';
    this.buildV2CloudStatus = 'idle';
    try {
      const response = await firstValueFrom(
        this.dspService.listBuildV2CloudProjects(),
      );
      if (
        attempt !== this.buildV2CloudListAttempt
        || this.auth.session()?.user?.id !== userId
      ) {
        return;
      }
      this.cloudProjects = response.projects;
      const selectedStillExists = response.projects.some(
        project => project.projectId === this.selectedCloudProjectId,
      );
      if (!selectedStillExists) {
        this.selectedCloudProjectId = response.projects[0]?.projectId ?? '';
      }
    } catch (error) {
      if (
        attempt === this.buildV2CloudListAttempt
        && this.auth.session()?.user?.id === userId
      ) {
        console.warn('[RQS BUILD V2 CLOUD PROJECT LIST]', error);
        this.cloudProjects = [];
        this.selectedCloudProjectId = '';
        this.buildV2CloudStatus = 'error';
      }
    } finally {
      if (attempt === this.buildV2CloudListAttempt) {
        this.buildV2CloudReadOperation = 'none';
        this.buildV2CloudBusy = false;
      }
    }
  }


  async openBuildV2CloudProject(): Promise<void> {
    if (
      !this.canOpenBuildV2CloudProject()
      || (
        this.buildV2CloudBusy
        && this.buildV2CloudReadOperation !== 'restore'
      )
    ) return;

    const projectId = this.selectedCloudProjectId;
    const userId = this.auth.session()?.user?.id ?? null;
    if (!userId) return;

    const attempt = ++this.buildV2CloudRestoreAttempt;
    this.buildV2CloudBusy = true;
    this.buildV2CloudReadOperation = 'restore';
    this.buildV2CloudStatus = 'idle';
    try {
      const bundle = await firstValueFrom(
        this.cloudProjectRestore.restoreBuildV2CloudProject(projectId),
      );
      if (
        attempt !== this.buildV2CloudRestoreAttempt
        || this.auth.session()?.user?.id !== userId
      ) {
        return;
      }

      this.restoreBuildV2Project(bundle.project, bundle.files);
      this.activeCloudProjectId = bundle.project.projectId;
      this.activeCloudProjectRevision = bundle.revision;
      this.activeCloudProjectBaseline = parseBuildV2ProjectDocument(bundle.project);
      this.activeLocalProjectId = null;
      this.activeLocalProjectCreatedAt = null;
      this.buildV2CloudStatus = 'opened';
    } catch (error) {
      if (
        attempt === this.buildV2CloudRestoreAttempt
        && this.auth.session()?.user?.id === userId
      ) {
        console.warn('[RQS BUILD V2 CLOUD PROJECT OPEN]', error);
        this.buildV2CloudStatus = 'error';
      }
    } finally {
      if (attempt === this.buildV2CloudRestoreAttempt) {
        this.buildV2CloudReadOperation = 'none';
        this.buildV2CloudBusy = false;
      }
    }
  }


  async saveBuildV2CloudProject(saveAsNew = false): Promise<void> {
    if (!this.canSaveBuildV2CloudProject()) return;

    const userId = this.auth.session()?.user?.id ?? null;
    if (!userId) return;

    const attempt = ++this.buildV2CloudMutationAttempt;
    const updatesActiveProject = !saveAsNew
      && !!this.activeCloudProjectId
      && !!this.activeCloudProjectBaseline
      && this.activeCloudProjectRevision !== null;
    const now = new Date().toISOString();
    const projectId = updatesActiveProject
      ? this.activeCloudProjectId as string
      : crypto.randomUUID();
    const baseline = updatesActiveProject
      ? this.activeCloudProjectBaseline
      : null;
    const expectedRevision = updatesActiveProject
      ? this.activeCloudProjectRevision
      : null;
    const snapshot = this.buildV2ProjectSaveSnapshot(
      projectId,
      baseline?.createdAt ?? now,
      baseline?.updatedAt ?? now,
    );

    this.buildV2CloudBusy = true;
    this.buildV2CloudStatus = 'saving';
    this.pricingUpgradeRequired.set(false);
    try {
      const result = await firstValueFrom(
        this.cloudProjectAuthoring.save({
          snapshot,
          baseline,
          expectedRevision,
        }),
      );
      if (!this.isCurrentBuildV2CloudMutation(attempt, userId)) return;

      if (result.kind === 'upToDate') {
        this.buildV2CloudStatus = 'upToDate';
        return;
      }

      const response = result.response;
      if (!response) {
        throw new Error('BUILD_CLOUD_SAVE_RESPONSE_MISSING');
      }

      this.activeCloudProjectId = result.project.projectId;
      this.activeCloudProjectRevision = response.project.revision;
      this.activeCloudProjectBaseline = parseBuildV2ProjectDocument(result.project);
      this.selectedCloudProjectId = result.project.projectId;
      this.activeLocalProjectId = null;
      this.activeLocalProjectCreatedAt = null;
      this.buildV2CloudQuota = result.quota;
      this.upsertBuildV2CloudProject(response.project);
      this.buildV2CloudStatus = 'saved';
      await this.refreshBuildV2CloudInventory(userId, attempt);
    } catch (error) {
      if (!this.isCurrentBuildV2CloudMutation(attempt, userId)) return;
      const code = this.buildV2CloudErrorCode(error);
      if (code === 'BUILD_PROJECT_REVISION_CONFLICT') {
        this.buildV2CloudStatus = 'conflict';
      } else if (this.isBuildV2CloudProjectQuotaError(error, code)) {
        this.pricingUpgradeRequired.set(true);
        this.buildV2CloudStatus = 'projectQuota';
      } else if (this.isBuildV2CloudStorageQuotaError(error, code)) {
        this.pricingUpgradeRequired.set(true);
        this.buildV2CloudStatus = 'storageQuota';
      } else {
        console.warn('[RQS BUILD V2 CLOUD PROJECT SAVE]', error);
        this.buildV2CloudStatus = 'saveError';
      }
    } finally {
      if (attempt === this.buildV2CloudMutationAttempt) {
        this.buildV2CloudBusy = false;
      }
    }
  }


  async deleteBuildV2CloudProject(): Promise<void> {
    if (!this.canDeleteBuildV2CloudProject()) return;

    const selected = this.cloudProjects.find(
      project => project.projectId === this.selectedCloudProjectId,
    );
    const userId = this.auth.session()?.user?.id ?? null;
    if (!selected || !userId) return;
    if (!window.confirm(this.cloudProjectCopy('confirmDelete'))) return;

    const attempt = ++this.buildV2CloudMutationAttempt;
    this.buildV2CloudBusy = true;
    this.buildV2CloudStatus = 'deleting';
    this.pricingUpgradeRequired.set(false);
    try {
      const result = await firstValueFrom(
        this.cloudProjectAuthoring.delete(selected.projectId, selected.revision),
      );
      if (!this.isCurrentBuildV2CloudMutation(attempt, userId)) return;

      this.cloudProjects = this.cloudProjects.filter(
        project => project.projectId !== selected.projectId,
      );
      this.selectedCloudProjectId = this.cloudProjects[0]?.projectId ?? '';
      if (this.activeCloudProjectId === selected.projectId) {
        this.activeCloudProjectId = null;
        this.activeCloudProjectRevision = null;
        this.activeCloudProjectBaseline = null;
      }
      this.buildV2CloudStatus = result.cleanupComplete
        ? 'deleted'
        : 'cleanupPending';
      await this.refreshBuildV2CloudInventory(userId, attempt);
    } catch (error) {
      if (!this.isCurrentBuildV2CloudMutation(attempt, userId)) return;
      if (this.buildV2CloudErrorCode(error) === 'BUILD_PROJECT_REVISION_CONFLICT') {
        this.buildV2CloudStatus = 'conflict';
      } else {
        console.warn('[RQS BUILD V2 CLOUD PROJECT DELETE]', error);
        this.buildV2CloudStatus = 'deleteError';
      }
    } finally {
      if (attempt === this.buildV2CloudMutationAttempt) {
        this.buildV2CloudBusy = false;
      }
    }
  }


  private isCurrentBuildV2CloudMutation(attempt: number, userId: string): boolean {
    return (
      attempt === this.buildV2CloudMutationAttempt
      && this.auth.session()?.user?.id === userId
    );
  }


  private buildV2CloudErrorCode(error: unknown): string | null {
    if (!error || typeof error !== 'object') return null;
    const directCode = 'code' in error ? error.code : null;
    if (typeof directCode === 'string') return directCode;
    const response = 'error' in error ? error.error : null;
    if (response && typeof response === 'object' && 'code' in response) {
      return typeof response.code === 'string' ? response.code : null;
    }
    return null;
  }


  private isBuildV2CloudProjectQuotaError(
    error: unknown,
    code: string | null,
  ): boolean {
    return (
      (
        error instanceof BuildV2CloudAuthoringError
        && error.code === 'BUILD_CLOUD_PROJECT_QUOTA_EXCEEDED'
      )
      || code === 'BUILD_PROJECT_QUOTA_EXCEEDED'
    );
  }


  private isBuildV2CloudStorageQuotaError(
    error: unknown,
    code: string | null,
  ): boolean {
    return (
      (
        error instanceof BuildV2CloudAuthoringError
        && error.code === 'BUILD_CLOUD_STORAGE_QUOTA_EXCEEDED'
      )
      || code === 'BUILD_STORAGE_QUOTA_EXCEEDED'
    );
  }


  private async refreshBuildV2CloudInventory(
    userId: string,
    mutationAttempt: number,
  ): Promise<void> {
    try {
      const [projects, quota] = await Promise.all([
        firstValueFrom(this.dspService.listBuildV2CloudProjects()),
        firstValueFrom(this.dspService.getBuildV2CloudQuota()),
      ]);
      if (!this.isCurrentBuildV2CloudMutation(mutationAttempt, userId)) return;

      this.cloudProjects = projects.projects;
      this.buildV2CloudQuota = quota;
      const selectedStillExists = projects.projects.some(
        project => project.projectId === this.selectedCloudProjectId,
      );
      if (!selectedStillExists) {
        this.selectedCloudProjectId = this.activeCloudProjectId
          && projects.projects.some(
            project => project.projectId === this.activeCloudProjectId,
          )
          ? this.activeCloudProjectId
          : projects.projects[0]?.projectId ?? '';
      }
    } catch (error) {
      if (this.isCurrentBuildV2CloudMutation(mutationAttempt, userId)) {
        console.warn('[RQS BUILD V2 CLOUD INVENTORY REFRESH]', error);
      }
    }
  }


  private upsertBuildV2CloudProject(
    project: BuildV2CloudProjectSummary,
  ): void {
    this.cloudProjects = [
      project,
      ...this.cloudProjects.filter(
        current => current.projectId !== project.projectId,
      ),
    ];
  }


  private resetBuildV2CloudState(): void {
    this.buildV2CloudRestoreAttempt += 1;
    this.buildV2CloudListAttempt += 1;
    this.buildV2CloudMutationAttempt += 1;
    this.cloudProjects = [];
    this.selectedCloudProjectId = '';
    this.activeCloudProjectId = null;
    this.activeCloudProjectRevision = null;
    this.activeCloudProjectBaseline = null;
    this.buildV2CloudQuota = null;
    this.buildV2CloudReadOperation = 'none';
    this.buildV2CloudBusy = false;
    this.buildV2CloudStatus = 'idle';
  }


  async saveBuildV2Project():
    Promise<void> {
    if (
      !this.canSaveBuildV2Project()
    ) {
      return;
    }

    this.buildV2CloudRestoreAttempt += 1;
    this.buildV2CloudMutationAttempt += 1;
    this.buildV2CloudBusy = false;
    this.buildV2CloudReadOperation = 'none';
    this.buildV2CloudStatus = 'idle';

    this.buildV2ProjectStorageBusy =
      true;

    this.buildV2ProjectStatus =
      'idle';

    const now =
      new Date().toISOString();

    const projectId =
      this.activeLocalProjectId
      ?? crypto.randomUUID();

    const createdAt =
      this.activeLocalProjectCreatedAt
      ?? now;

    try {
      const snapshot =
        this.buildV2ProjectSaveSnapshot(
          projectId,
          createdAt,
          now,
        );

      await this.buildV2ProjectStorage
        .save(
          snapshot.project,
          snapshot.assets,
        );

      /*
       * Identity becomes active only after the
       * IndexedDB transaction has committed.
       */
      this.activeLocalProjectId =
        snapshot.project.projectId;

      this.activeLocalProjectCreatedAt =
        snapshot.project.createdAt;

      this.activeCloudProjectId =
        null;

      this.activeCloudProjectRevision =
        null;

      this.activeCloudProjectBaseline =
        null;

      this.selectedLocalProjectId =
        snapshot.project.projectId;

      this.localProjects =
        await this.buildV2ProjectStorage
          .list();

      this.buildV2ProjectStatus =
        'saved';
    } catch (error) {
      console.warn(
        '[RQS BUILD V2 PROJECT SAVE]',
        error,
      );

      this.buildV2ProjectStatus =
        'error';
    } finally {
      this.buildV2ProjectStorageBusy =
        false;
    }
  }


  async openBuildV2Project():
    Promise<void> {
    if (
      !this.canOpenBuildV2Project()
    ) {
      return;
    }

    this.buildV2CloudRestoreAttempt += 1;
    this.buildV2CloudMutationAttempt += 1;
    this.buildV2CloudBusy = false;
    this.buildV2CloudReadOperation = 'none';

    const projectId =
      this.selectedLocalProjectId;

    this.buildV2ProjectStorageBusy =
      true;

    this.buildV2ProjectStatus =
      'idle';

    try {
      const loaded =
        await this.buildV2ProjectStorage
          .load(
            projectId,
          );

      if (!loaded) {
        throw new Error(
          'BUILD_V2_LOCAL_PROJECT_NOT_FOUND',
        );
      }

      /*
       * restoreBuildV2Project validates everything
       * before replacing the current runtime.
       */
      this.restoreBuildV2Project(
        loaded.project,
        loaded.files,
      );

      this.activeLocalProjectId =
        loaded.project.projectId;

      this.activeLocalProjectCreatedAt =
        loaded.project.createdAt;

      this.activeCloudProjectId =
        null;

      this.activeCloudProjectRevision =
        null;

      this.activeCloudProjectBaseline =
        null;

      this.buildV2CloudStatus =
        'idle';

      this.selectedLocalProjectId =
        loaded.project.projectId;

      this.buildV2ProjectStatus =
        'opened';
    } catch (error) {
      console.warn(
        '[RQS BUILD V2 PROJECT OPEN]',
        error,
      );

      this.buildV2ProjectStatus =
        'error';
    } finally {
      this.buildV2ProjectStorageBusy =
        false;
    }
  }


  newBuildV2Project(): void {
    if (
      this.buildV2ProjectStorageBusy
    ) {
      return;
    }

    this.clearAllLocalAudio();

    this.activeLocalProjectId =
      null;

    this.activeLocalProjectCreatedAt =
      null;

    this.activeCloudProjectId =
      null;

    this.activeCloudProjectRevision =
      null;

    this.activeCloudProjectBaseline =
      null;

    this.buildV2CloudRestoreAttempt +=
      1;

    this.buildV2CloudMutationAttempt +=
      1;

    this.buildV2CloudBusy =
      false;

    this.buildV2CloudReadOperation =
      'none';

    this.buildV2CloudStatus =
      'idle';

    this.selectedLocalProjectId =
      '';

    this.buildV2ProjectStatus =
      'idle';
  }


  effectiveRange(track: RQSTrack) {
    return buildV2EffectiveRange(track.v2, track.duration);
  }

  hasBuildV2Adjustments(): boolean {
    return (
      this.finalFade.enabled
      || this.tracks.some(
        track =>
          hasBuildV2Adjustments(
            track.v2,
            track.duration,
          ),
      )
    );
  }

  private buildV2IncomingTransitionSeconds(
    index: number,
  ): number {
    return index > 0
      ? Math.max(
          0,
          this.transitions[index - 1]
            ?.duration
          ?? 0,
        )
      : 0;
  }

  private buildV2OutgoingTransitionSeconds(
    index: number,
  ): number {
    return Math.max(
      0,
      this.transitions[index]
        ?.duration
      ?? 0,
    );
  }

  private buildV2MinimumTrackDuration(
    index: number,
  ): number {
    return buildV2MinimumEffectiveDuration(
      this.buildV2IncomingTransitionSeconds(
        index,
      ),
      this.buildV2OutgoingTransitionSeconds(
        index,
      ),
    );
  }

  buildV2TrimStartMaxSeconds(
    index: number,
  ): number {
    const track = this.tracks[index];

    if (!track) {
      return 0;
    }

    const end =
      track.v2.trimEndSeconds
      ?? track.duration;

    return Math.max(
      0,
      end
      - this.buildV2MinimumTrackDuration(
        index,
      ),
    );
  }

  buildV2TrimEndMinSeconds(
    index: number,
  ): number {
    const track = this.tracks[index];

    if (!track) {
      return 0;
    }

    return Math.min(
      track.duration,
      track.v2.trimStartSeconds
      + this.buildV2MinimumTrackDuration(
        index,
      ),
    );
  }

  private buildV2FinalFadeIncomingSeconds():
    number {
    return this.transitions.at(-1)
      ?.duration
      ?? 0;
  }

  buildV2FinalFadeMaxSeconds():
    number {
    const lastTrack =
      this.tracks.at(-1);

    if (!lastTrack) {
      return 0;
    }

    return buildV2FinalFadeMaxDuration(
      this.effectiveRange(
        lastTrack,
      ).duration,
      this.buildV2FinalFadeIncomingSeconds(),
    );
  }

  private normalizeCurrentBuildV2FinalFade():
    void {
    this.finalFade =
      normalizeBuildV2FinalFadeState(
        this.finalFade,
        this.buildV2FinalFadeMaxSeconds(),
      );
  }

  private buildV2CurrentEngineFinalFade():
    BuildV2EngineFinalFade | null {
    const normalized =
      normalizeBuildV2FinalFadeState(
        this.finalFade,
        this.buildV2FinalFadeMaxSeconds(),
      );

    if (!normalized.enabled) {
      return null;
    }

    return {
      duration: normalized.duration,
      curve: normalized.curve,
    };
  }

  finalFadeRegion(
    index: number,
  ) {
    if (
      index !== this.tracks.length - 1
      || !this.finalFade.enabled
    ) {
      return null;
    }

    const track =
      this.tracks[index];

    if (!track) {
      return null;
    }

    const range =
      this.effectiveRange(track);

    if (range.duration <= 0) {
      return null;
    }

    const normalized =
      normalizeBuildV2FinalFadeState(
        this.finalFade,
        this.buildV2FinalFadeMaxSeconds(),
      );

    if (!normalized.enabled) {
      return null;
    }

    const duration =
      Math.min(
        normalized.duration,
        range.duration,
      );

    return {
      left:
        (
          (
            range.duration - duration
          )
          / range.duration
        ) * 100,
      width:
        (
          duration
          / range.duration
        ) * 100,
      duration,
    };
  }

  updateBuildV2FinalFade(
    patch:
      Partial<BuildV2FinalFadeState>,
  ): void {
    if (this.tracks.length === 0) {
      return;
    }

    const previous =
      this.captureBuildV2TransportSnapshot();

    const previousFade = {
      ...this.finalFade,
    };

    this.finalFade =
      normalizeBuildV2FinalFadeState(
        {
          ...this.finalFade,
          ...patch,
        },
        this.buildV2FinalFadeMaxSeconds(),
      );

    const success =
      this.rescheduleBuildV2TransportAfterStructuralEdit(
        previous,
      );

    if (!success) {
      this.finalFade =
        previousFade;
    }
  }

  private captureBuildV2TransportSnapshot():
    BuildV2TransportSnapshot {
    const current =
      this.buildV2TransportSnapshot();

    const context =
      this.buildV2TransportAudioCtx;

    if (
      current.state === 'playing'
      && context
    ) {
      const precise =
        this.buildV2TransportClock.snapshot(
          context.currentTime,
        );

      this.buildV2TransportSnapshot.set(
        precise,
      );

      return precise;
    }

    return current;
  }

  updateBuildV2Track(index: number, patch: Partial<BuildV2TrackState>): void {
    const track = this.tracks[index];
    if (!track) return;

    const trimStartChanged =
      Object.prototype.hasOwnProperty.call(
        patch,
        'trimStartSeconds',
      );

    const trimEndChanged =
      Object.prototype.hasOwnProperty.call(
        patch,
        'trimEndSeconds',
      );

    const trimChanged =
      trimStartChanged || trimEndChanged;

    const previousState = {
      ...track.v2,
    };

    const transportBefore =
      trimChanged
        ? this.captureBuildV2TransportSnapshot()
        : null;

    const proposedState = {
      ...track.v2,
      ...patch,
    };

    track.v2 =
      trimChanged
        ? normalizeBuildV2TrimForTransitions(
            proposedState,
            track.duration,
            this.buildV2IncomingTransitionSeconds(
              index,
            ),
            this.buildV2OutgoingTransitionSeconds(
              index,
            ),
            trimStartChanged
              ? 'start'
              : 'end',
          )
        : normalizeBuildV2TrackState(
            proposedState,
            track.duration,
          );

    const previousFinalFade =
      trimChanged
      && index === this.tracks.length - 1
        ? {
            ...this.finalFade,
          }
        : null;

    if (
      trimChanged
      && index === this.tracks.length - 1
    ) {
      this.normalizeCurrentBuildV2FinalFade();
    }

    /*
     * Do not use the tracks setter here.
     *
     * Gain/Pan stay live and Trim now performs an
     * in-place timeline replan instead of stopping the
     * Transport.
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

    if (
      trimChanged
      && transportBefore
    ) {
      const rescheduled =
        this.rescheduleBuildV2TransportAfterStructuralEdit(
          transportBefore,
        );

      if (!rescheduled) {
        track.v2 = previousState;

        if (previousFinalFade) {
          this.finalFade =
            previousFinalFade;
        }

        this.currentTracks = [
          ...this.currentTracks,
        ];
      }
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

    this.finalFade =
      createBuildV2FinalFadeState();

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
        finalFade:
          this.buildV2CurrentEngineFinalFade(),
        vignette:
          this.vignetteEnabled
          && this.vignetteTrack
            ? {
                id:
                  this.vignetteTrack.id,
                file:
                  this.vignetteTrack.file,
              }
            : null,
      },
    );
  }

  async bounceBuildV2Wav(): Promise<void> {
    if (
      this.tracks.length === 0
      || this.buildV2BounceRendering()
      || this.buildV2TransportRendering()
    ) {
      return;
    }

    this.stopBuildV2Transport();
    this.clearBuildV2BounceDownload();
    this.buildV2BounceRendering.set(true);
    this.setlistError = null;

    try {
      const rendered =
        await this.renderBuildV2PocAudioBuffer();

      const wav =
        encodeBuildV2WavPcm24(rendered);

      this.buildV2BounceDownloadUrl = URL.createObjectURL(
        new Blob(
          [wav.buffer as ArrayBuffer],
          { type: 'audio/wav' },
        ),
      );

      const normalizedName =
        this.setlistName
          .trim()
          .replace(/[^a-zA-Z0-9._-]+/g, '_')
          .replace(/^_+|_+$/g, '')
        || 'RQS_SETLIST';

      this.buildV2BounceDownloadName =
        `${normalizedName}.wav`;

      this.analytics.trackEvent(
        'build_v2_local_wav_bounced',
      );
    } catch {
      this.clearBuildV2BounceDownload();
      this.setlistError =
        this.buildV2Copy('bounceFailed');
    } finally {
      this.buildV2BounceRendering.set(false);
    }
  }

  private clearBuildV2BounceDownload(): void {
    if (this.buildV2BounceDownloadUrl) {
      URL.revokeObjectURL(
        this.buildV2BounceDownloadUrl,
      );
    }

    this.buildV2BounceDownloadUrl = null;
    this.buildV2BounceDownloadName = '';
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
    return this.buildV2UnifiedTimelineDurationSeconds();
  }

  private buildV2CurrentLiveTracks():
    BuildV2EngineTrack[] | null {
    const decoded =
      this.buildV2DecodedTracks;

    if (!decoded) {
      return null;
    }

    const decodedById =
      new Map(
        decoded.map(track => [
          track.id,
          track,
        ]),
      );

    return this.tracks.map(track => {
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
  }

  private buildV2CurrentEngineVignette():
    BuildV2EngineVignette | null {
    if (
      !this.vignetteEnabled
      || !this.vignetteTrack
    ) {
      return null;
    }

    const decoded =
      this.buildV2DecodedVignette;

    if (
      !decoded
      || decoded.id
        !== this.vignetteTrack.id
    ) {
      return null;
    }

    return decoded;
  }

  private buildV2CurrentEngineTransitions() {
    return this.transitions.map(
      transition => ({
        duration:
          transition.duration,
        curve:
          transition.curve,
      }),
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

      if (
        this.vignetteEnabled
        && this.vignetteTrack
      ) {
        const vignetteTrack =
          this.vignetteTrack;

        const cachedVignette =
          this.buildV2DecodedVignette;

        if (
          !cachedVignette
          || cachedVignette.id
            !== vignetteTrack.id
        ) {
          this.buildV2TransportRendering.set(
            true,
          );

          const decodedVignetteTracks =
            await decodeBuildV2TrackFiles(
              [
                {
                  id:
                    vignetteTrack.id,
                  file:
                    vignetteTrack.file,
                  state:
                    createBuildV2TrackState(),
                },
              ],
              () => ({
                decodeAudioData:
                  (data: ArrayBuffer) =>
                    context.decodeAudioData(
                      data,
                    ),
              }),
            );

          if (
            attempt
            !== this.buildV2TransportAttempt
          ) {
            return;
          }

          const decodedVignette =
            decodedVignetteTracks[0];

          if (!decodedVignette) {
            throw new Error(
              'BUILD_V2_VIGNETTE_DECODE_UNAVAILABLE',
            );
          }

          this.buildV2DecodedVignette = {
            id:
              decodedVignette.id,
            buffer:
              decodedVignette.buffer,
          };
        }
      } else {
        this.buildV2DecodedVignette =
          null;
      }

      const liveTracks =
        this.buildV2CurrentLiveTracks();

      if (!liveTracks) {
        throw new Error(
          'BUILD_V2_LIVE_TRACKS_UNAVAILABLE',
        );
      }

      const engine =
        this.buildV2LiveEngine
        ?? new BuildV2LiveAudioEngine(
          context,
        );

      this.buildV2LiveEngine = engine;

      const plan = engine.prepare(
        liveTracks,
        this.buildV2CurrentEngineTransitions(),
        context.sampleRate,
        this.buildV2CurrentEngineFinalFade(),
        this.buildV2CurrentEngineVignette(),
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

  private rescheduleBuildV2TransportAfterStructuralEdit(
    previous:
      BuildV2TransportSnapshot,
  ): boolean {
    const newEstimatedDuration =
      this.calculateBuildV2TransportEstimatedDuration();

    const context =
      this.buildV2TransportAudioCtx;

    const engine =
      this.buildV2LiveEngine;

    const liveTracks =
      this.buildV2CurrentLiveTracks();

    /*
     * No decoded/live engine yet:
     * update geometry + transport duration only.
     */
    if (
      !context
      || !engine
      || !liveTracks
    ) {
      this.buildV2TransportClock.setDuration(
        newEstimatedDuration,
      );

      const next =
        this.buildV2TransportClock.seek(
          Math.min(
            previous.positionSeconds,
            newEstimatedDuration,
          ),
        );

      this.buildV2TransportSnapshot.set(
        next,
      );

      return true;
    }

    try {
      const plan = engine.prepare(
        liveTracks,
        this.buildV2CurrentEngineTransitions(),
        context.sampleRate,
        this.buildV2CurrentEngineFinalFade(),
        this.buildV2CurrentEngineVignette(),
      );

      /*
       * Preserve the absolute global position.
       *
       * Geometry before/after Trim or Crossfade may
       * differ, but the setlist clock never jumps back
       * to zero.
       */
      this.buildV2TransportClock.setDuration(
        plan.outputDurationSeconds,
      );

      const position = Math.min(
        previous.positionSeconds,
        plan.outputDurationSeconds,
      );

      const next =
        this.buildV2TransportClock.seek(
          position,
          previous.state === 'playing'
            ? context.currentTime
            : undefined,
        );

      this.buildV2TransportSnapshot.set(
        next,
      );

      if (
        previous.state === 'playing'
        && next.state === 'playing'
      ) {
        engine.start(
          next.positionSeconds,
        );

        /*
         * The existing RAF normally remains alive.
         * Restart defensively if a previous edge case
         * already cleared it.
         */
        if (
          this.buildV2TransportRafId
          === null
        ) {
          this.startBuildV2TransportAnimation();
        }
      } else {
        engine.stop();

        if (
          next.state === 'ended'
        ) {
          this.cancelBuildV2TransportAnimation();
        }
      }

      return true;
    } catch (error) {
      /*
       * prepare() is atomic: the currently audible
       * sources remain alive if planning fails.
       */
      console.warn(
        '[RQS BUILD V2 STRUCTURAL EDIT] '
        + 'Live replan rejected; restoring previous state.',
        error,
      );

      return false;
    }
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
    if (!this.ensureBuildFileIngressAuth()) return;
    if (event.dataTransfer?.files) this.addFiles(Array.from(event.dataTransfer.files));
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!this.ensureBuildFileIngressAuth()) {
      input.value = '';
      return;
    }
    if (input.files) this.addFiles(Array.from(input.files));
    input.value = '';
  }

  requestFileSelection(input: HTMLInputElement): void {
    if (!this.ensureBuildFileIngressAuth()) return;
    input.click();
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
    });
    this.tracks = [...this.tracks];
    this.stopTransitionPreview();
    const planLimitReached = validFiles.length > acceptedFiles.length;
    this.pricingUpgradeRequired.set(planLimitReached);
    this.setlistError = planLimitReached ? this.trackLimitSelectionMessage() : null;
  }

  onVignetteSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!this.ensureBuildFileIngressAuth()) {
      input.value = '';
      return;
    }
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file || !/\.(wav|mp3)$/i.test(file.name)) return;

    this.stopTransitionPreview();

    this.buildV2DecodedVignette =
      null;

    this.invalidateBuildV2TransportPreview(
      false,
    );

    if (this.vignetteTrack) {
      this.disposeTrack(
        this.vignetteTrack,
      );
    }

    this.vignetteEnabled = true;
    this.vignetteTrack = this.createTrack(file);
  }

  onVignetteToggle(): void {
    if (!this.vignetteEnabled) this.removeVignette();
  }

  replaceTrackFile(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!this.ensureBuildFileIngressAuth()) {
      input.value = '';
      return;
    }
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
  }

  private ensureBuildFileIngressAuth(): boolean {
    if (this.auth.session()?.user) return true;
    this.auth.requestSignIn('build');
    return false;
  }

  private createRestoredTrack(
    file: File,
    trackId: string,
    assetId: string,
    duration: number,
    state: BuildV2TrackState,
  ): RQSTrack {
    const rawUrl =
      URL.createObjectURL(
        file,
      );

    return {
      id:
        trackId,

      assetId,

      file,

      name:
        file.name,

      crossfadeNext:
        this.defaultDuration,

      rawUrl,

      previewUrl:
        this.sanitizer
          .bypassSecurityTrustUrl(
            rawUrl,
          ),

      duration,

      /*
       * Local restore deliberately does not pretend that
       * an S3 upload still exists.
       *
       * Local BUILD V2 playback/bounce works from File.
       * Server V1 render remains unavailable until upload.
       */
      s3Key:
        null,

      uploadState:
        'idle',

      uploadError:
        null,

      uploadAttempt:
        0,

      v2: {
        ...state,
      },
    };
  }


  private createTrack(file: File): RQSTrack {
    const rawUrl = URL.createObjectURL(file);
    const track: RQSTrack = {
      id: crypto.randomUUID(),
      assetId: crypto.randomUUID(),
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
      track.duration =
        Number.isFinite(audio.duration)
          ? audio.duration
          : 0;

      if (
        this.vignetteTrack
        !== track
      ) {
        this.tracks = [
          ...this.tracks,
        ];
      }

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
    return this.buildV2UnifiedTimelineDurationSeconds();
  }

  calculateEstimatedSizeMb(): number {
    const bytesPerSecond = 48000 * 3 * 2;
    return Math.round((bytesPerSecond * this.calculateEstimatedOutputDuration()) / (1024 * 1024));
  }

  setLoudnessMode(mode: SetlistLoudnessMode): void {
    this.loudnessMatchMode = mode;
  }

  canIgniteSetlist(): boolean {
    const session = this.auth.session();
    if (
      !session?.user?.id
      || !session.access_token?.trim()
      || this.isProcessing
      || this.tracks.length < 2
      || this.tracks.length > this.maxTrackCount()
      || this.loudnessMatchMode !== 'off'
    ) {
      return false;
    }
    try {
      this.buildV2ProjectSaveSnapshot(
        this.renderOnlyProjectId,
        this.renderOnlyProjectCreatedAt,
      );
      return true;
    } catch {
      return false;
    }
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
    const hadVignette =
      Boolean(
        this.vignetteTrack
        || this.buildV2DecodedVignette,
      );

    if (this.vignetteTrack) {
      this.disposeTrack(
        this.vignetteTrack,
      );
    }

    this.vignetteTrack = null;
    this.vignetteEnabled = false;

    this.buildV2DecodedVignette =
      null;

    if (hadVignette) {
      this.invalidateBuildV2TransportPreview(
        false,
      );
    }
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

  private buildV2ServerRenderTracks(): RQSTrack[] {
    return [
      ...this.tracks,
      ...(
        this.vignetteEnabled
        && this.vignetteTrack
          ? [this.vignetteTrack]
          : []
      ),
    ];
  }

  private async uploadBuildV2ServerRenderTrack(
    track: RQSTrack,
    renderAttempt: number,
    userId: string,
  ): Promise<string> {
    if (
      track.uploadState === 'ready'
      && track.s3Key
    ) {
      return track.s3Key;
    }

    const uploadAttempt =
      ++track.uploadAttempt;

    track.s3Key = null;
    track.uploadError = null;
    track.uploadState = 'uploading';

    try {
      const presign = await firstValueFrom(
        this.dspService
          .getSetlistPresignedUrl(
            track.file.name,
          ),
      );

      if (
        !this.isCurrentRender(
          renderAttempt,
          userId,
        )
        || !this.isCurrentAttempt(
          track,
          uploadAttempt,
        )
      ) {
        throw new Error(
          'BUILD_V2_RENDER_ATTEMPT_STALE',
        );
      }

      await firstValueFrom(
        this.dspService.uploadToS3(
          presign.uploadUrl,
          track.file,
        ),
      );

      if (
        !this.isCurrentRender(
          renderAttempt,
          userId,
        )
        || !this.isCurrentAttempt(
          track,
          uploadAttempt,
        )
      ) {
        throw new Error(
          'BUILD_V2_RENDER_ATTEMPT_STALE',
        );
      }

      track.s3Key = presign.s3Key;
      track.uploadState = 'ready';
      return presign.s3Key;
    } catch (error) {
      if (
        this.isCurrentRender(
          renderAttempt,
          userId,
        )
        && this.isCurrentAttempt(
          track,
          uploadAttempt,
        )
      ) {
        this.markUploadError(
          track,
          uploadAttempt,
        );
      }
      throw error;
    }
  }

  async igniteSetlist(): Promise<void> {
    if (!this.hasAuthenticatedBuildSession()) return;
    this.stopBuildV2Transport();
    this.cancelActiveRender();
    if (this.loudnessMatchMode !== 'off') {
      this.setlistError = this.buildV2Copy('renderBlocked');
      return;
    }
    if (!this.canIgniteSetlist()) {
      this.setlistError = this.localCopy('renderBlocked');
      return;
    }

    const userId = this.auth.session()?.user?.id ?? null;
    const attempt = ++this.renderAttempt;
    this.isProcessing = true;
    this.mixSuccess = false;
    this.setlistError = null;
    this.pricingUpgradeRequired.set(false);
    this.stopTransitionPreview();

    let sources: BuildV2ServerRenderSource[];
    try {
      const renderTracks =
        this.buildV2ServerRenderTracks();

      sources =
        await ensureBuildV2ServerRenderSources(
          renderTracks as BuildV2ServerRenderSourceCandidate[],
          candidate => {
            const track = renderTracks.find(
              item =>
                item.assetId
                === candidate.assetId,
            );
            if (!track || !userId) {
              throw new Error(
                'BUILD_V2_RENDER_SOURCE_SET_INVALID',
              );
            }
            return this.uploadBuildV2ServerRenderTrack(
              track,
              attempt,
              userId,
            );
          },
          3,
        );

      if (!this.isCurrentRender(attempt, userId)) {
        return;
      }
    } catch (error) {
      if (this.isCurrentRender(attempt, userId)) {
        this.isProcessing = false;
        this.setlistError = this.renderErrorMessage(error);
      }
      return;
    }

    const now = new Date().toISOString();
    let snapshot: BuildV2ProjectSaveSnapshot;
    try {
      snapshot = this.buildV2ProjectSaveSnapshot(
        this.renderOnlyProjectId,
        this.renderOnlyProjectCreatedAt,
        now,
      );
      if (
        snapshot.project.assets.length
          !== sources.length
        || snapshot.project.assets.some(
          (asset, index) =>
            asset.assetId
            !== sources[index]?.assetId,
        )
      ) {
        throw new Error(
          'BUILD_V2_RENDER_SOURCE_SET_INVALID',
        );
      }
    } catch (error) {
      if (this.isCurrentRender(attempt, userId)) {
        this.isProcessing = false;
        this.setlistError = this.renderErrorMessage(error);
      }
      return;
    }

    const subscription = this.dspService
      .renderDeployBuildV2Setlist({
        project: snapshot.project,
        sources,
      })
      .subscribe({
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
    this.clearBuildV2BounceDownload();
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
