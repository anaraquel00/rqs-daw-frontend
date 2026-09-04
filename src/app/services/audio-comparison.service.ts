import { Injectable, signal, computed, OnDestroy, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

export type AudioVariant = 'original' | 'master';
export type PreviewStatus = 'not-generated' | 'processing' | 'ready' | 'error';
export type PlaybackMode = 'full-track' | 'preview-15s';

type Gate140Source = 'ORIGINAL' | 'MASTER' | 'SYSTEM';
type Gate140PlayStage = 'NONE' | 'ORIGINAL_PENDING' | 'ORIGINAL_RESOLVED' | 'MASTER_PENDING' | 'MASTER_RESOLVED';
type Gate140PlayResult = 'RESOLVE' | `REJECT:${string}` | 'NOT_CALLED' | 'PENDING';

interface Gate140SafeMediaState {
  readyState: number;
  networkState: number;
  paused: boolean;
  ended: boolean;
  currentTime: number | string;
  duration: number | string;
  mediaErrorCode: number | 'NONE';
  srcPresent: 'YES' | 'NO';
  srcKind: 'BLOB' | 'HTTP' | 'OTHER' | 'NONE';
}

interface Gate140DiagnosticEvent {
  eventId: number;
  relativeMs: number;
  playAttempt: number;
  source: Gate140Source;
  operation: string;
  callerOperation: string;
  playStage: Gate140PlayStage;
  originalPlayPending: boolean;
  masterPlayPending: boolean;
  state?: Gate140SafeMediaState;
  errorName?: string;
  errorMessage?: string;
}

interface Gate140DiagnosticApi {
  summary(): string;
  clear(): void;
}

declare global {
  interface Window {
    __RQS_GATE140_FIRST_PLAY_DIAG__?: Gate140DiagnosticApi;
  }
}

@Injectable({
  providedIn: 'root'
})
export class AudioComparisonService implements OnDestroy {
  readonly audioProcessed = signal<boolean>(false);
  readonly processedFilename = signal<string>('');

  private readonly platformId = inject(PLATFORM_ID);

  readonly activeVariant = signal<AudioVariant>('original');
  readonly previewStatus = signal<PreviewStatus>('not-generated');
  readonly playbackMode = signal<PlaybackMode>('full-track');
  readonly isPlaying = signal<boolean>(false);

  readonly currentTime = signal<number>(0);
  readonly duration = signal<number>(0);

  readonly previewStart = signal<number>(0);
  readonly previewEnd = signal<number>(15);

  private preferredPreviewStart: number | null = null;
  private originalAudio!: HTMLAudioElement;
  private masterAudio!: HTMLAudioElement;
  private audioCtx!: AudioContext | null;
  private gainOriginal!: GainNode;
  private gainMaster!: GainNode;
  private syncIntervalId: ReturnType<typeof setInterval> | undefined;

  private readonly gate140Events: Gate140DiagnosticEvent[] = [];
  private gate140StartedAt = 0;
  private gate140NextEventId = 1;
  private gate140PlayAttempt = 0;
  private gate140PlayStage: Gate140PlayStage = 'NONE';
  private gate140OriginalPlayPending = false;
  private gate140MasterPlayPending = false;
  private gate140FirstPlayResult = 'UNKNOWN';
  private gate140FailureStage: Gate140PlayStage = 'NONE';
  private gate140OriginalPlayResult: Gate140PlayResult = 'NOT_CALLED';
  private gate140MasterPlayResult: Gate140PlayResult = 'NOT_CALLED';
  private gate140OriginalStateBeforePlay: Gate140SafeMediaState | null = null;
  private gate140MasterStateBeforePlay: Gate140SafeMediaState | null = null;
  private readonly gate140DiagnosticApi: Gate140DiagnosticApi = {
    summary: () => this.gate140Summary(),
    clear: () => this.gate140Clear(),
  };

  readonly canUseMaster = computed(() => this.previewStatus() === 'ready');

  readonly displayDuration = computed(() => {
    if (this.playbackMode() === 'preview-15s') {
      return Math.max(0, this.previewEnd() - this.previewStart());
    }
    return this.duration();
  });

  readonly displayCurrentTime = computed(() => {
    if (this.playbackMode() === 'preview-15s') {
      return Math.max(0, Math.min(this.displayDuration(), this.currentTime() - this.previewStart()));
    }
    return this.currentTime();
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.inicializarMidias();
      this.gate140Clear();
      window.__RQS_GATE140_FIRST_PLAY_DIAG__ = this.gate140DiagnosticApi;
    }
  }

  private inicializarMidias(): void {
    this.originalAudio = new Audio();
    this.originalAudio.crossOrigin = 'anonymous';
    this.masterAudio = new Audio();
    this.masterAudio.crossOrigin = 'anonymous';

    this.originalAudio.addEventListener('durationchange', () => {
      const total = this.originalAudio.duration || 0;
      this.duration.set(total);

      const previewLength = Math.min(15, total);
      const defaultStart = Math.max(0, (total - previewLength) / 2);
      const start = this.preferredPreviewStart ?? defaultStart;
      this.setPreviewStart(start);

      // Keep the physical source aligned as soon as metadata resolves.
      // Without this, a very fast first Play can start at 0 before the
      // selected Preview window is known.
      this.originalAudio.currentTime = this.previewStart();
      this.currentTime.set(this.previewStart());
    });

    this.originalAudio.addEventListener('timeupdate', () => {
      this.currentTime.set(this.originalAudio.currentTime);
      this.verificarFimDaPrevia();
    });

    this.masterAudio.addEventListener('timeupdate', () => {
      this.verificarFimDaPrevia();
    });

    this.originalAudio.addEventListener('ended', () => this.handleAudioEnded());
    this.masterAudio.addEventListener('ended', () => this.handleAudioEnded());
  }

  private handleAudioEnded(): void {
    this.stopAndReset();
  }

  private iniciarContextoDeAudio(): void {
    if (this.audioCtx) return;
    this.audioCtx = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    const sourceOriginal = this.audioCtx.createMediaElementSource(this.originalAudio);
    const sourceMaster = this.audioCtx.createMediaElementSource(this.masterAudio);

    this.gainOriginal = this.audioCtx.createGain();
    this.gainMaster = this.audioCtx.createGain();

    sourceOriginal.connect(this.gainOriginal);
    sourceMaster.connect(this.gainMaster);

    this.gainOriginal.connect(this.audioCtx.destination);
    this.gainMaster.connect(this.audioCtx.destination);

    this.gainOriginal.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
    this.gainMaster.gain.setValueAtTime(0.0, this.audioCtx.currentTime);
  }

  setOriginalSrc(
    url: string,
    preferredPreviewStart: number | null = null,
    callerOperation = 'DIRECT_SET_ORIGINAL_SRC',
  ): void {
    this.gate140Record('SET_ORIGINAL_SRC_ENTER', 'ORIGINAL', this.originalAudio, callerOperation);
    this.resetAll(callerOperation);
    this.preferredPreviewStart = preferredPreviewStart;
    this.playbackMode.set('preview-15s');
    this.originalAudio.src = url;
    this.gate140Record('ORIGINAL_LOAD_CALL', 'ORIGINAL', this.originalAudio, callerOperation);
    this.originalAudio.load();
  }

  setPreviewStart(startSeconds: number): void {
    const total = this.duration();
    if (!Number.isFinite(startSeconds) || total <= 0) return;

    const previewLength = Math.min(15, total);
    const maxStart = Math.max(0, total - previewLength);
    const normalized = Math.max(0, Math.min(startSeconds, maxStart));
    this.preferredPreviewStart = normalized;
    this.previewStart.set(normalized);
    this.previewEnd.set(normalized + previewLength);
  }

  setMasterSrc(url: string, mode: PlaybackMode, callerOperation = 'DIRECT_SET_MASTER_SRC'): void {
    this.gate140Record('SET_MASTER_SRC_ENTER', 'MASTER', this.masterAudio, callerOperation);
    this.masterAudio.src = url;
    this.gate140Record('MASTER_LOAD_CALL', 'MASTER', this.masterAudio, callerOperation);
    this.masterAudio.load();
    this.playbackMode.set(mode);
    this.previewStatus.set('ready');
    this.stopAndReset(callerOperation);
  }

  clearMasterSrc(callerOperation = 'DIRECT_CLEAR_MASTER_SRC'): void {
    this.gate140Record('CLEAR_MASTER_SRC_ENTER', 'MASTER', this.masterAudio, callerOperation);
    this.pauseAll(callerOperation);
    this.masterAudio.removeAttribute('src');
    this.gate140Record('MASTER_LOAD_CALL', 'MASTER', this.masterAudio, callerOperation);
    this.masterAudio.load();
    this.previewStatus.set('not-generated');
    this.playbackMode.set('preview-15s');
    this.activeVariant.set('original');

    if (this.audioCtx && this.gainOriginal && this.gainMaster) {
      const now = this.audioCtx.currentTime;
      this.gainOriginal.gain.cancelScheduledValues(now);
      this.gainMaster.gain.cancelScheduledValues(now);
      this.gainOriginal.gain.setValueAtTime(1.0, now);
      this.gainMaster.gain.setValueAtTime(0.0, now);
    }

    this.stopAndReset(callerOperation);
  }

  private verificarFimDaPrevia(): void {
    if (this.playbackMode() === 'preview-15s') {
      const current = this.originalAudio.currentTime;
      if (current < this.previewStart() || current >= this.previewEnd()) {
        this.stopAndReset();
      }
    }
  }

  async togglePlayback(): Promise<void> {
    const nextAttempt = this.isPlaying() ? this.gate140PlayAttempt : this.gate140PlayAttempt + 1;
    this.gate140Record('TOGGLE_PLAYBACK_ENTER', 'SYSTEM', undefined, 'TOGGLE_PLAYBACK', undefined, nextAttempt);
    this.iniciarContextoDeAudio();
    this.gate140Record('AUDIO_CONTEXT_STATE_BEFORE', 'SYSTEM', undefined, this.audioCtx?.state ?? 'NONE', undefined, nextAttempt);
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.gate140Record('AUDIO_CONTEXT_RESUME_CALL', 'SYSTEM', undefined, 'TOGGLE_PLAYBACK', undefined, nextAttempt);
      await this.audioCtx.resume();
    }
    this.gate140Record('AUDIO_CONTEXT_STATE_AFTER', 'SYSTEM', undefined, this.audioCtx?.state ?? 'NONE', undefined, nextAttempt);

    if (this.isPlaying()) {
      this.pauseAll('TOGGLE_PLAYBACK_PAUSE');
    } else {
      await this.playActiveSource(nextAttempt);
    }
  }

  private async playActiveSource(attempt = this.gate140PlayAttempt + 1): Promise<void> {
    this.gate140BeginAttempt(attempt);
    const isMasterReady = this.canUseMaster();
    const mode = this.playbackMode();

    if (mode === 'preview-15s') {
      const current = this.originalAudio.currentTime;
      if (current < this.previewStart() || current >= this.previewEnd()) {
        this.originalAudio.currentTime = this.previewStart();
        this.currentTime.set(this.previewStart());
      }
    }
    this.gate140Record('ORIGINAL_CURRENTTIME_ALIGN', 'ORIGINAL', this.originalAudio, 'PLAY_ACTIVE_SOURCE');

    if (isMasterReady) {
      if (mode === 'preview-15s') {
        this.masterAudio.currentTime = Math.max(0, this.originalAudio.currentTime - this.previewStart());
      } else {
        this.masterAudio.currentTime = this.originalAudio.currentTime;
      }
      this.gate140Record('MASTER_CURRENTTIME_ALIGN', 'MASTER', this.masterAudio, 'PLAY_ACTIVE_SOURCE');
    }

    try {
      this.gate140OriginalStateBeforePlay = this.gate140SafeMediaState(this.originalAudio);
      this.gate140Record('ORIGINAL_STATE_BEFORE_PLAY', 'ORIGINAL', this.originalAudio, 'PLAY_ACTIVE_SOURCE');
      this.gate140PlayStage = 'ORIGINAL_PENDING';
      this.gate140OriginalPlayPending = true;
      this.gate140OriginalPlayResult = 'PENDING';
      this.gate140Record('ORIGINAL_PLAY_CALL', 'ORIGINAL', this.originalAudio, 'PLAY_ACTIVE_SOURCE');
      await this.originalAudio.play();
      this.gate140OriginalPlayPending = false;
      this.gate140OriginalPlayResult = 'RESOLVE';
      this.gate140PlayStage = 'ORIGINAL_RESOLVED';
      this.gate140Record('ORIGINAL_PLAY_RESOLVE', 'ORIGINAL', this.originalAudio, 'PLAY_ACTIVE_SOURCE');
      if (isMasterReady) {
        this.gate140MasterStateBeforePlay = this.gate140SafeMediaState(this.masterAudio);
        this.gate140Record('MASTER_STATE_BEFORE_PLAY', 'MASTER', this.masterAudio, 'PLAY_ACTIVE_SOURCE');
        this.gate140PlayStage = 'MASTER_PENDING';
        this.gate140MasterPlayPending = true;
        this.gate140MasterPlayResult = 'PENDING';
        this.gate140Record('MASTER_PLAY_CALL', 'MASTER', this.masterAudio, 'PLAY_ACTIVE_SOURCE');
        await this.masterAudio.play();
        this.gate140MasterPlayPending = false;
        this.gate140MasterPlayResult = 'RESOLVE';
        this.gate140PlayStage = 'MASTER_RESOLVED';
        this.gate140Record('MASTER_PLAY_RESOLVE', 'MASTER', this.masterAudio, 'PLAY_ACTIVE_SOURCE');
      }
      this.isPlaying.set(true);
      this.gate140Record('IS_PLAYING_SET_TRUE', 'SYSTEM', undefined, 'PLAY_ACTIVE_SOURCE');
      if (attempt === 1) this.gate140FirstPlayResult = 'PASS';
      this.gate140Record('SYNC_START', 'SYSTEM', undefined, 'PLAY_ACTIVE_SOURCE');
      this.iniciarSincroniaFisica();
    } catch (err) {
      const errorName = this.gate140ErrorName(err);
      const failureStage = this.gate140PlayStage;
      if (failureStage === 'ORIGINAL_PENDING') {
        this.gate140OriginalPlayResult = `REJECT:${errorName}`;
        this.gate140Record('ORIGINAL_PLAY_REJECT', 'ORIGINAL', this.originalAudio, 'PLAY_ACTIVE_SOURCE', err);
      } else if (failureStage === 'MASTER_PENDING') {
        this.gate140MasterPlayResult = `REJECT:${errorName}`;
        this.gate140Record('MASTER_PLAY_REJECT', 'MASTER', this.masterAudio, 'PLAY_ACTIVE_SOURCE', err);
      }
      this.gate140OriginalPlayPending = false;
      this.gate140MasterPlayPending = false;
      this.gate140FailureStage = failureStage;
      if (attempt === 1) this.gate140FirstPlayResult = `FAIL:${errorName}`;
      this.gate140Record('CATCH_ENTER', 'SYSTEM', undefined, 'PLAY_ACTIVE_SOURCE', err);
      this.isPlaying.set(false);
      this.gate140Record('IS_PLAYING_SET_FALSE', 'SYSTEM', undefined, 'PLAY_ACTIVE_SOURCE');
      console.error('Falha ao tocar mídias:', err);
    }
  }

  stopAndReset(callerOperation = 'DIRECT_STOP_RESET'): void {
    this.gate140Record('STOP_RESET_ENTER', 'SYSTEM', undefined, callerOperation);
    this.pauseAll(callerOperation);
    if (this.playbackMode() === 'preview-15s') {
      this.originalAudio.currentTime = this.previewStart();
      this.masterAudio.currentTime = 0;
      this.currentTime.set(this.previewStart());
    } else {
      this.originalAudio.currentTime = 0;
      this.masterAudio.currentTime = 0;
      this.currentTime.set(0);
    }
  }

  private pauseAll(callerOperation = 'DIRECT_PAUSE_ALL'): void {
    this.gate140Record('PAUSE_ALL_ENTER', 'SYSTEM', undefined, callerOperation);
    this.gate140Record('ORIGINAL_PAUSE_CALL', 'ORIGINAL', this.originalAudio, callerOperation);
    this.originalAudio.pause();
    this.gate140Record('MASTER_PAUSE_CALL', 'MASTER', this.masterAudio, callerOperation);
    this.masterAudio.pause();
    this.isPlaying.set(false);
    if (this.syncIntervalId !== undefined) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = undefined;
    }
  }

  async switchVariant(variant: AudioVariant, callerOperation = 'DIRECT_SWITCH_VARIANT'): Promise<void> {
    this.gate140Record('SWITCH_VARIANT_ENTER', 'SYSTEM', undefined, callerOperation);
    if (variant === 'master' && !this.canUseMaster()) return;
    if (variant === this.activeVariant()) return;

    this.iniciarContextoDeAudio();
    const now = this.audioCtx ? this.audioCtx.currentTime : 0;

    if (this.audioCtx && this.gainOriginal && this.gainMaster) {
      if (variant === 'original') {
        this.gainOriginal.gain.setValueAtTime(this.gainOriginal.gain.value, now);
        this.gainOriginal.gain.linearRampToValueAtTime(1.0, now + 0.030);
        this.gainMaster.gain.setValueAtTime(this.gainMaster.gain.value, now);
        this.gainMaster.gain.linearRampToValueAtTime(0.0, now + 0.030);
      } else {
        this.gainOriginal.gain.setValueAtTime(this.gainOriginal.gain.value, now);
        this.gainOriginal.gain.linearRampToValueAtTime(0.0, now + 0.030);
        this.gainMaster.gain.setValueAtTime(this.gainMaster.gain.value, now);
        this.gainMaster.gain.linearRampToValueAtTime(1.0, now + 0.030);
      }
    } else if (variant === 'original') {
      this.masterAudio.pause();
      this.originalAudio.currentTime = this.playbackMode() === 'preview-15s'
        ? this.masterAudio.currentTime + this.previewStart()
        : this.masterAudio.currentTime;
      if (this.isPlaying()) void this.originalAudio.play();
    } else {
      this.originalAudio.pause();
      this.masterAudio.currentTime = this.playbackMode() === 'preview-15s'
        ? Math.max(0, this.originalAudio.currentTime - this.previewStart())
        : this.originalAudio.currentTime;
      if (this.isPlaying()) void this.masterAudio.play();
    }

    this.activeVariant.set(variant);
  }

  private iniciarSincroniaFisica(): void {
    if (this.syncIntervalId !== undefined) clearInterval(this.syncIntervalId);
    if (!this.canUseMaster()) return;

    this.syncIntervalId = setInterval(() => {
      const mode = this.playbackMode();
      if (mode === 'preview-15s') {
        const mappedMasterTime = this.masterAudio.currentTime + this.previewStart();
        const diff = Math.abs(this.originalAudio.currentTime - mappedMasterTime);
        if (diff > 0.015) {
          if (this.activeVariant() === 'original') {
            this.masterAudio.currentTime = Math.max(0, this.originalAudio.currentTime - this.previewStart());
          } else {
            this.originalAudio.currentTime = this.masterAudio.currentTime + this.previewStart();
          }
        }
      } else {
        const diff = Math.abs(this.originalAudio.currentTime - this.masterAudio.currentTime);
        if (diff > 0.015) {
          if (this.activeVariant() === 'original') {
            this.masterAudio.currentTime = this.originalAudio.currentTime;
          } else {
            this.originalAudio.currentTime = this.masterAudio.currentTime;
          }
        }
      }
    }, 100);
  }

  seek(seconds: number): void {
    if (this.playbackMode() === 'preview-15s') {
      const target = Math.max(this.previewStart(), Math.min(seconds, this.previewEnd()));
      this.originalAudio.currentTime = target;
      if (this.canUseMaster()) {
        this.masterAudio.currentTime = Math.max(0, Math.min(target - this.previewStart(), this.displayDuration()));
      }
      this.currentTime.set(target);
      return;
    }

    const target = Math.max(0, Math.min(seconds, this.duration()));
    this.originalAudio.currentTime = target;
    if (this.canUseMaster()) this.masterAudio.currentTime = target;
    this.currentTime.set(target);
  }

  resetAll(callerOperation = 'DIRECT_RESET_ALL'): void {
    this.gate140Record('RESET_ALL_ENTER', 'SYSTEM', undefined, callerOperation);
    this.pauseAll(callerOperation);
    this.originalAudio.removeAttribute('src');
    this.masterAudio.removeAttribute('src');
    this.previewStatus.set('not-generated');
    this.playbackMode.set('full-track');
    this.activeVariant.set('original');
    this.currentTime.set(0);
    this.duration.set(0);
    this.previewStart.set(0);
    this.previewEnd.set(15);
    this.preferredPreviewStart = null;
  }

  ngOnDestroy(): void {
    this.resetAll('AUDIO_COMPARISON_SERVICE_DESTROY');
    if (this.audioCtx) {
      void this.audioCtx.close();
    }
    if (isPlatformBrowser(this.platformId) && window.__RQS_GATE140_FIRST_PLAY_DIAG__ === this.gate140DiagnosticApi) {
      delete window.__RQS_GATE140_FIRST_PLAY_DIAG__;
    }
  }

  private gate140BeginAttempt(attempt: number): void {
    this.gate140PlayAttempt = attempt;
    this.gate140PlayStage = 'NONE';
    this.gate140OriginalPlayPending = false;
    this.gate140MasterPlayPending = false;
    this.gate140FailureStage = 'NONE';
    this.gate140OriginalPlayResult = 'NOT_CALLED';
    this.gate140MasterPlayResult = 'NOT_CALLED';
    this.gate140OriginalStateBeforePlay = null;
    this.gate140MasterStateBeforePlay = null;
  }

  private gate140Record(
    operation: string,
    source: Gate140Source,
    media: HTMLMediaElement | undefined,
    callerOperation: string,
    error?: unknown,
    attempt = this.gate140PlayAttempt,
  ): void {
    const event: Gate140DiagnosticEvent = {
      eventId: this.gate140NextEventId++,
      relativeMs: Math.round((performance.now() - this.gate140StartedAt) * 1000) / 1000,
      playAttempt: attempt,
      source,
      operation,
      callerOperation: this.gate140SafeLabel(callerOperation),
      playStage: this.gate140PlayStage,
      originalPlayPending: this.gate140OriginalPlayPending,
      masterPlayPending: this.gate140MasterPlayPending,
    };

    if (media) event.state = this.gate140SafeMediaState(media);
    if (error !== undefined) {
      event.errorName = this.gate140ErrorName(error);
      event.errorMessage = this.gate140ErrorMessage(error);
    }

    if (this.gate140Events.length >= 200) this.gate140Events.shift();
    this.gate140Events.push(event);
  }

  private gate140SafeMediaState(media: HTMLMediaElement): Gate140SafeMediaState {
    const source = media.currentSrc || media.getAttribute('src') || '';
    let srcKind: Gate140SafeMediaState['srcKind'] = 'NONE';
    if (source) {
      if (/^blob:/i.test(source)) srcKind = 'BLOB';
      else if (/^https?:/i.test(source)) srcKind = 'HTTP';
      else srcKind = 'OTHER';
    }

    return {
      readyState: media.readyState,
      networkState: media.networkState,
      paused: media.paused,
      ended: media.ended,
      currentTime: this.gate140SafeNumber(media.currentTime),
      duration: this.gate140SafeNumber(media.duration),
      mediaErrorCode: media.error?.code ?? 'NONE',
      srcPresent: source ? 'YES' : 'NO',
      srcKind,
    };
  }

  private gate140SafeNumber(value: number): number | string {
    if (Number.isFinite(value)) return Math.round(value * 1000) / 1000;
    return Number.isNaN(value) ? 'NaN' : value > 0 ? 'Infinity' : '-Infinity';
  }

  private gate140ErrorName(error: unknown): string {
    const value = error instanceof Error && error.name ? error.name : 'UnknownError';
    return this.gate140SafeLabel(value) || 'UnknownError';
  }

  private gate140ErrorMessage(error: unknown): string {
    const value = error instanceof Error ? error.message : String(error);
    return value
      .replace(/https?:\/\/\S+/gi, '[REDACTED_URL]')
      .replace(/blob:\S+/gi, '[REDACTED_BLOB_URL]')
      .replace(/\beyJ[A-Za-z0-9._-]+/g, '[REDACTED_JWT]')
      .replace(/\bbearer\s+\S+/gi, 'bearer=[REDACTED]')
      .replace(/\b(authorization|bearer|token|jwt|cookie|apikey)\b\s*[:=]?\s*\S*/gi, '$1=[REDACTED]')
      .replace(/[\r\n\t]+/g, ' ')
      .slice(0, 180);
  }

  private gate140SafeLabel(value: string): string {
    return value.replace(/[^A-Za-z0-9_.:/ -]/g, '_').slice(0, 96);
  }

  private gate140StateText(state: Gate140SafeMediaState): string {
    return [
      `readyState=${state.readyState}`,
      `networkState=${state.networkState}`,
      `paused=${state.paused ? 'YES' : 'NO'}`,
      `ended=${state.ended ? 'YES' : 'NO'}`,
      `currentTime=${state.currentTime}`,
      `duration=${state.duration}`,
      `mediaErrorCode=${state.mediaErrorCode}`,
      `SRC_PRESENT=${state.srcPresent}`,
      `SRC_KIND=${state.srcKind}`,
    ].join(',');
  }

  private gate140Summary(): string {
    const interruptionOperations = this.gate140Events
      .filter((event) =>
        (event.originalPlayPending || event.masterPlayPending)
        && /^(PAUSE_ALL_ENTER|ORIGINAL_PAUSE_CALL|MASTER_PAUSE_CALL|STOP_RESET_ENTER|RESET_ALL_ENTER|SET_ORIGINAL_SRC_ENTER|SET_MASTER_SRC_ENTER|CLEAR_MASTER_SRC_ENTER|ORIGINAL_LOAD_CALL|MASTER_LOAD_CALL)$/.test(event.operation),
      )
      .map((event) => `${event.operation}[${event.callerOperation}]`);
    const interruptions = [...new Set(interruptionOperations)].join(' > ') || 'NONE';
    const orderedEvents = this.gate140Events.map((event) => {
      const state = event.state ? ` state={${this.gate140StateText(event.state)}}` : '';
      const error = event.errorName
        ? ` errorName=${event.errorName} errorMessage=${event.errorMessage ?? ''}`
        : '';
      return `#${event.eventId}@${event.relativeMs}ms attempt=${event.playAttempt} source=${event.source} operation=${event.operation} caller=${event.callerOperation} stage=${event.playStage} originalPending=${event.originalPlayPending ? 'YES' : 'NO'} masterPending=${event.masterPlayPending ? 'YES' : 'NO'}${state}${error}`;
    }).join(' | ');
    const originalBefore = this.gate140OriginalStateBeforePlay;
    const masterBefore = this.gate140MasterStateBeforePlay;

    return [
      'RQS_GATE140_FIRST_PLAY_DIAGNOSTIC',
      `PLAY_ATTEMPT = ${this.gate140PlayAttempt}`,
      `FIRST_PLAY_RESULT = ${this.gate140FirstPlayResult}`,
      `PLAY_STAGE_AT_FAILURE = ${this.gate140FailureStage}`,
      `ORIGINAL_PLAY_RESULT = ${this.gate140OriginalPlayResult}`,
      `MASTER_PLAY_RESULT = ${this.gate140MasterPlayResult}`,
      `ORIGINAL_READY_STATE_BEFORE_PLAY = ${originalBefore?.readyState ?? 'NOT_REACHED'}`,
      `ORIGINAL_NETWORK_STATE_BEFORE_PLAY = ${originalBefore?.networkState ?? 'NOT_REACHED'}`,
      `MASTER_READY_STATE_BEFORE_PLAY = ${masterBefore?.readyState ?? 'NOT_REACHED'}`,
      `MASTER_NETWORK_STATE_BEFORE_PLAY = ${masterBefore?.networkState ?? 'NOT_REACHED'}`,
      `INTERRUPTION_WHILE_PLAY_PENDING = ${interruptions}`,
      `ORDERED_EVENTS = ${orderedEvents || 'NONE'}`,
      `FINAL_ORIGINAL_STATE = ${this.gate140StateText(this.gate140SafeMediaState(this.originalAudio))}`,
      `FINAL_MASTER_STATE = ${this.gate140StateText(this.gate140SafeMediaState(this.masterAudio))}`,
      'SECRET_OR_URL_CONTENT_INCLUDED = NO',
    ].join('\n');
  }

  private gate140Clear(): void {
    this.gate140Events.length = 0;
    this.gate140StartedAt = performance.now();
    this.gate140NextEventId = 1;
    this.gate140PlayAttempt = 0;
    this.gate140PlayStage = 'NONE';
    this.gate140OriginalPlayPending = false;
    this.gate140MasterPlayPending = false;
    this.gate140FirstPlayResult = 'UNKNOWN';
    this.gate140FailureStage = 'NONE';
    this.gate140OriginalPlayResult = 'NOT_CALLED';
    this.gate140MasterPlayResult = 'NOT_CALLED';
    this.gate140OriginalStateBeforePlay = null;
    this.gate140MasterStateBeforePlay = null;
  }
}
