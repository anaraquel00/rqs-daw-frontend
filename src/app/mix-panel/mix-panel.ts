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

export type SetlistUploadState = 'idle' | 'uploading' | 'ready' | 'error';

export interface RQSTrack {
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
}

type LocalCopyKey =
  | 'metadataUnknown'
  | 'waveformNotAnalyzed'
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
    waveformNotAnalyzed: 'Waveform not analyzed — local playback preview only',
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
    waveformNotAnalyzed: 'Waveform não analisada — apenas preview local',
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
    waveformNotAnalyzed: 'Waveform nieanalizowany — tylko lokalny odsłuch',
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
    waveformNotAnalyzed: 'Waveform non analysée — aperçu local uniquement',
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

@Component({
  selector: 'app-mix-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
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

  tracks: RQSTrack[] = [];
  vignetteEnabled = false;
  vignetteTrack: RQSTrack | null = null;
  isProcessing = false;
  mixSuccess = false;
  setlistError: string | null = null;
  setlistName = 'THE_BLUEPRINT_SESSIONS_Vol_XYZ';

  activeCurve: SetlistCurve = 'equal-power';
  loudnessMatchMode: SetlistLoudnessMode = 'off';
  previewingIndex = -1;
  previewProgress = signal<number>(0);

  private audioCtx: AudioContext | null = null;
  private sourceNode1: MediaElementAudioSourceNode | null = null;
  private sourceNode2: MediaElementAudioSourceNode | null = null;
  private gainNode1!: GainNode;
  private gainNode2!: GainNode;
  private playerElement1: HTMLAudioElement | null = null;
  private playerElement2: HTMLAudioElement | null = null;
  private previewIntervalId: ReturnType<typeof setInterval> | null = null;
  private previousUserId: string | null = null;
  private activeRenderSubscription: Subscription | null = null;
  private renderAttempt = 0;
  private successResetTimer: ReturnType<typeof setTimeout> | null = null;

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
    this.sourceNode1.connect(this.gainNode1);
    this.sourceNode2.connect(this.gainNode2);
    this.gainNode1.connect(this.audioCtx.destination);
    this.gainNode2.connect(this.audioCtx.destination);
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

  private trackLimitSelectionMessage(): string {
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
    this.setlistError = validFiles.length > acceptedFiles.length
      ? this.trackLimitSelectionMessage()
      : null;
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
    this.disposeTrack(previous);
    const replacement = this.createTrack(file);
    replacement.crossfadeNext = previous.crossfadeNext;
    this.tracks[index] = replacement;
    this.tracks = [...this.tracks];
    this.uploadTrack(replacement);
  }

  private createTrack(file: File): RQSTrack {
    const rawUrl = URL.createObjectURL(file);
    const track: RQSTrack = {
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
    return this.tracks.slice(0, -1).reduce((sum, track) => sum + Number(track.crossfadeNext || 0), 0);
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
    if (!this.setlistName.trim()) return false;
    if (this.tracks.some((track) => track.uploadState !== 'ready' || !track.s3Key || track.duration <= 0)) {
      return false;
    }
    if (this.vignetteEnabled && (!this.vignetteTrack || this.vignetteTrack.uploadState !== 'ready' || !this.vignetteTrack.s3Key)) {
      return false;
    }
    return this.tracks.slice(0, -1).every((track, index) => {
      const fade = Number(track.crossfadeNext);
      const adjacentDuration = Math.min(track.duration, this.tracks[index + 1].duration);
      return Number.isFinite(fade) && fade >= 0.5 && fade <= 15 && fade < adjacentDuration;
    });
  }

  async previewTransition(index: number): Promise<void> {
    if (index >= this.tracks.length - 1) return;
    this.stopTransitionPreview();
    if (!this.initializeWebAudio() || !this.audioCtx || !this.playerElement1 || !this.playerElement2) return;
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();

    this.previewingIndex = index;
    this.previewProgress.set(0);
    const track1 = this.tracks[index];
    const track2 = this.tracks[index + 1];
    const fadeDuration = Number(track1.crossfadeNext);
    const previewLead = 12;
    const previewTail = 12;
    const totalDuration = previewLead + fadeDuration + previewTail;
    const startTimeTrack1 = Math.max(0, track1.duration - previewLead - fadeDuration);

    this.playerElement1.src = track1.rawUrl;
    this.playerElement2.src = track2.rawUrl;
    this.playerElement1.currentTime = startTimeTrack1;
    this.playerElement2.currentTime = 0;
    await this.playerElement1.play();

    const now = this.audioCtx.currentTime;
    this.gainNode1.gain.setValueAtTime(1, now);
    this.gainNode2.gain.setValueAtTime(0, now);
    let progressSeconds = 0;
    const intervalMs = 100;
    this.previewIntervalId = setInterval(async () => {
      progressSeconds += intervalMs / 1000;
      this.previewProgress.set((progressSeconds / totalDuration) * 100);
      if (progressSeconds >= previewLead && progressSeconds < previewLead + intervalMs / 1000) {
        await this.playerElement2?.play();
        this.applyCrossfadeCurve(fadeDuration);
      }
      if (progressSeconds >= totalDuration) this.stopTransitionPreview();
    }, intervalMs);
  }

  private applyCrossfadeCurve(duration: number): void {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    if (this.activeCurve === 'linear') {
      this.gainNode1.gain.setValueAtTime(1, now);
      this.gainNode1.gain.linearRampToValueAtTime(0, now + duration);
      this.gainNode2.gain.setValueAtTime(0, now);
      this.gainNode2.gain.linearRampToValueAtTime(1, now + duration);
    } else if (this.activeCurve === 'equal-power') {
      const steps = 100;
      const curve1 = new Float32Array(steps);
      const curve2 = new Float32Array(steps);
      for (let index = 0; index < steps; index += 1) {
        const ratio = index / (steps - 1);
        curve1[index] = Math.cos(ratio * Math.PI / 2);
        curve2[index] = Math.sin(ratio * Math.PI / 2);
      }
      this.gainNode1.gain.setValueCurveAtTime(curve1, now, duration);
      this.gainNode2.gain.setValueCurveAtTime(curve2, now, duration);
    } else {
      this.gainNode1.gain.setValueAtTime(1, now);
      this.gainNode1.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.3);
      this.gainNode2.gain.setValueAtTime(0.001, now);
      this.gainNode2.gain.exponentialRampToValueAtTime(1, now + duration);
    }
  }

  stopTransitionPreview(): void {
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

  igniteSetlist(): void {
    this.cancelActiveRender();
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
      crossfades: this.tracks.slice(0, -1).map((track) => Number(track.crossfadeNext)),
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
    this.cancelActiveRender();
    this.stopTransitionPreview();
    this.tracks.forEach((track) => this.disposeTrack(track));
    this.tracks = [];
    this.removeVignette();
    this.setlistError = null;
  }

  ngOnDestroy(): void {
    this.clearAllLocalAudio();
    if (this.audioCtx) void this.audioCtx.close();
    this.audioCtx = null;
  }
}
