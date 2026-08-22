import { Injectable, signal, computed, OnDestroy, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

export type AudioVariant = 'original' | 'master';
export type PreviewStatus = 'not-generated' | 'processing' | 'ready' | 'error';
export type PlaybackMode = 'full-track' | 'preview-15s';

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

  setOriginalSrc(url: string, preferredPreviewStart: number | null = null): void {
    this.resetAll();
    this.preferredPreviewStart = preferredPreviewStart;
    this.playbackMode.set('preview-15s');
    this.originalAudio.src = url;
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

  setMasterSrc(url: string, mode: PlaybackMode): void {
    this.masterAudio.src = url;
    this.masterAudio.load();
    this.playbackMode.set(mode);
    this.previewStatus.set('ready');
    this.stopAndReset();
  }

  clearMasterSrc(): void {
    this.pauseAll();
    this.masterAudio.removeAttribute('src');
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

    this.stopAndReset();
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
    this.iniciarContextoDeAudio();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    if (this.isPlaying()) {
      this.pauseAll();
    } else {
      await this.playActiveSource();
    }
  }

  private async playActiveSource(): Promise<void> {
    const isMasterReady = this.canUseMaster();
    const mode = this.playbackMode();

    if (mode === 'preview-15s') {
      const current = this.originalAudio.currentTime;
      if (current < this.previewStart() || current >= this.previewEnd()) {
        this.originalAudio.currentTime = this.previewStart();
        this.currentTime.set(this.previewStart());
      }
    }

    if (isMasterReady) {
      if (mode === 'preview-15s') {
        this.masterAudio.currentTime = Math.max(0, this.originalAudio.currentTime - this.previewStart());
      } else {
        this.masterAudio.currentTime = this.originalAudio.currentTime;
      }
    }

    try {
      await this.originalAudio.play();
      if (isMasterReady) {
        await this.masterAudio.play();
      }
      this.isPlaying.set(true);
      this.iniciarSincroniaFisica();
    } catch (err) {
      this.isPlaying.set(false);
      console.error('Falha ao tocar mídias:', err);
    }
  }

  stopAndReset(): void {
    this.pauseAll();
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

  private pauseAll(): void {
    this.originalAudio.pause();
    this.masterAudio.pause();
    this.isPlaying.set(false);
    if (this.syncIntervalId !== undefined) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = undefined;
    }
  }

  async switchVariant(variant: AudioVariant): Promise<void> {
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

  resetAll(): void {
    this.pauseAll();
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
    this.resetAll();
    if (this.audioCtx) {
      void this.audioCtx.close();
    }
  }
}
