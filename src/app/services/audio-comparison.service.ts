// src/app/services/audio-comparison.service.ts
import { Injectable, signal, computed, OnDestroy, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

export type AudioVariant = 'original' | 'master';
export type PreviewStatus = 'not-generated' | 'processing' | 'ready' | 'error';
export type PlaybackMode = 'full-track' | 'preview-15s'; // 🟢 NOVO: Diferencia prévia de faixa inteira

@Injectable({
  providedIn: 'root'
})
export class AudioComparisonService implements OnDestroy {
  private platformId = inject(PLATFORM_ID);

  readonly activeVariant = signal<AudioVariant>('original');
  readonly previewStatus = signal<PreviewStatus>('not-generated');
  readonly playbackMode = signal<PlaybackMode>('full-track'); // 🟢 Inicia no modo de faixa cheia
  readonly isPlaying = signal<boolean>(false);

  readonly currentTime = signal<number>(0);
  readonly duration = signal<number>(0);

  readonly previewStart = signal<number>(0);
  readonly previewEnd = signal<number>(15);

  private originalAudio!: HTMLAudioElement;
  private masterAudio!: HTMLAudioElement;
  private audioCtx!: AudioContext | null;
  private gainOriginal!: GainNode;
  private gainMaster!: GainNode;
  private syncIntervalId: any;

  readonly canUseMaster = computed(() => this.previewStatus() === 'ready');

  // 🟢 CALCULA A LARGURA REATIVA DO PLAYER E DOS TIMERS DEPENDENDO DO MODO ATIVO [1.1.2]
  readonly displayDuration = computed(() => {
    if (this.canUseMaster() && this.playbackMode() === 'preview-15s') {
      return 15; // Exibe limite de 15s no modo prévia
    }
    return this.duration(); // Exibe a duração total nos modos de faixa cheia (original ou master completa)
  });

  readonly displayCurrentTime = computed(() => {
    if (this.canUseMaster() && this.playbackMode() === 'preview-15s') {
      return Math.max(0, Math.min(15, this.currentTime() - this.previewStart()));
    }
    return this.currentTime();
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.inicializarMídias();
    }
  }

  private inicializarMídias() {
    this.originalAudio = new Audio();
    this.masterAudio = new Audio();

    this.originalAudio.addEventListener('durationchange', () => {
      const total = this.originalAudio.duration || 0;
      this.duration.set(total);

      const start = Math.max(0, (total - 15) / 2);
      const end = start + 15;
      this.previewStart.set(start);
      this.previewEnd.set(end);
    });

    this.originalAudio.addEventListener('timeupdate', () => {
      this.currentTime.set(this.originalAudio.currentTime);
      this.verificarLoopDePrevia();
    });

    this.masterAudio.addEventListener('timeupdate', () => {
      this.verificarLoopDePrevia();
    });

    this.originalAudio.addEventListener('ended', () => this.handleAudioEnded());
    this.masterAudio.addEventListener('ended', () => this.handleAudioEnded());
  }

  private handleAudioEnded() {
    this.stopAndReset();
  }

  private iniciarContextoDeAudio() {
    if (this.audioCtx) return;
    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

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

  setOriginalSrc(url: string) {
    this.resetAll(); // 🟢 GARANTE O CLEAR COMPULSÓRIO DE MEMÓRIA E ESTADOS ANTERIORES
    this.originalAudio.src = url;
    this.originalAudio.load();
  }

  setMasterSrc(url: string, mode: PlaybackMode) {
    this.masterAudio.src = url;
    this.masterAudio.load();
    this.playbackMode.set(mode); // Define se é prévia ou master completa
    this.previewStatus.set('ready');
    this.stopAndReset();
  }

  // 🟢 TRAVA DINÂMICA: Para a prévia quando os 15s acabarem (Sem loops fantasmas) [1.1.2]
  private verificarLoopDePrevia() {
    if (this.canUseMaster() && this.playbackMode() === 'preview-15s') {
      const relativeTime = this.currentTime() - this.previewStart();
      if (relativeTime >= 15.0 || this.originalAudio.currentTime >= this.previewEnd()) {
        this.stopAndReset(); // Para a reprodução e zera o botão de Play
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

    if (isMasterReady) {
      if (mode === 'preview-15s') {
        const current = this.originalAudio.currentTime;
        if (current < this.previewStart() || current > this.previewEnd()) {
          this.originalAudio.currentTime = this.previewStart();
        }
        this.masterAudio.currentTime = this.originalAudio.currentTime - this.previewStart();
      } else {
        // 🟢 MODO COMPLETO: Sincronia direta 1:1 de tempo [1.1.2]
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
      console.error("Falha ao tocar mídias:", err);
    }
  }

  stopAndReset() {
    this.pauseAll();
    if (this.canUseMaster() && this.playbackMode() === 'preview-15s') {
      this.originalAudio.currentTime = this.previewStart();
      this.masterAudio.currentTime = 0;
      this.currentTime.set(this.previewStart());
    } else {
      this.originalAudio.currentTime = 0;
      this.masterAudio.currentTime = 0;
      this.currentTime.set(0);
    }
  }

  private pauseAll() {
    this.originalAudio.pause();
    this.masterAudio.pause();
    this.isPlaying.set(false);
    clearInterval(this.syncIntervalId);
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
    } else {
      // Fallback
      if (variant === 'original') {
        this.masterAudio.pause();
        if (this.playbackMode() === 'preview-15s') {
          this.originalAudio.currentTime = this.masterAudio.currentTime + this.previewStart();
        } else {
          this.originalAudio.currentTime = this.masterAudio.currentTime;
        }
        if (this.isPlaying()) this.originalAudio.play();
      } else {
        this.originalAudio.pause();
        if (this.playbackMode() === 'preview-15s') {
          this.masterAudio.currentTime = this.originalAudio.currentTime - this.previewStart();
        } else {
          this.masterAudio.currentTime = this.originalAudio.currentTime;
        }
        if (this.isPlaying()) this.masterAudio.play();
      }
    }

    this.activeVariant.set(variant);
  }

  private iniciarSincroniaFisica() {
    clearInterval(this.syncIntervalId);
    if (!this.canUseMaster()) return;

    this.syncIntervalId = setInterval(() => {
      const mode = this.playbackMode();
      if (mode === 'preview-15s') {
        const currentMasterTimeMapped = this.masterAudio.currentTime + this.previewStart();
        const diff = Math.abs(this.originalAudio.currentTime - currentMasterTimeMapped);
        if (diff > 0.015) {
          if (this.activeVariant() === 'original') {
            this.masterAudio.currentTime = this.originalAudio.currentTime - this.previewStart();
          } else {
            this.originalAudio.currentTime = this.masterAudio.currentTime + this.previewStart();
          }
        }
      } else {
        // 🟢 Sincronia direta 1:1 sem offsets para a masterização completa [1.1.2]
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

  seek(seconds: number) {
    const target = Math.max(0, Math.min(seconds, this.duration()));
    this.originalAudio.currentTime = target;
    if (this.canUseMaster()) {
      if (this.playbackMode() === 'preview-15s') {
        this.masterAudio.currentTime = target - this.previewStart();
      } else {
        this.masterAudio.currentTime = target;
      }
    }
    this.currentTime.set(target);
  }

  resetAll() {
    this.pauseAll();
    this.originalAudio.src = '';
    this.masterAudio.src = '';
    this.previewStatus.set('not-generated');
    this.playbackMode.set('full-track'); // 🟢 Reseta obrigatoriamente para o modo de faixa cheia
    this.activeVariant.set('original');
    this.currentTime.set(0);
    this.duration.set(0);
  }

  ngOnDestroy() {
    this.resetAll();
    if (this.audioCtx) {
      this.audioCtx.close();
    }
  }
}
