// src/app/workspace/mix-panel.ts
import {
  Component,
  inject,
  OnDestroy,
  DestroyRef,
  signal,
  afterNextRender
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DspService } from '../services/dsp';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { LanguageService } from '../services/language.service';
import { AuthService } from '../services/auth.service';
import { AudioComparisonService } from '../services/audio-comparison.service';
import { AnalyticsService } from '../services/analytics.service';

export interface RQSTrack {
  file: File;
  name: string;
  crossfadeNext: number;
  previewUrl: SafeUrl;
  rawUrl: string;
  duration: number;
  s3Key: string | null;
  isUploadingS3: boolean;
}

export type CrossfadeCurve = 'linear' | 'equal-power' | 'fast-cut';
export type LoudnessMatchMode = 'off' | 'perceived' | 'normalize';

@Component({
  selector: 'app-mix-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mix-panel.html',
  styleUrls: ['./mix-panel.scss']
})
export class MixPanelComponent implements OnDestroy {
  private audioComparison = inject(AudioComparisonService);


  private dspService = inject(DspService);
  private sanitizer = inject(DomSanitizer);
  private destroyRef = inject(DestroyRef);

  readonly lang = inject(LanguageService);
  readonly auth = inject(AuthService);
  private readonly analytics = inject(AnalyticsService);

  tracks: RQSTrack[] = [];
  isProcessing = false;
  mixSuccess = false;
  setlistName = 'THE_BLUEPRINT_SESSIONS_Vol_XYZ';

  activeCurve: CrossfadeCurve = 'equal-power';
  loudnessMatchMode: LoudnessMatchMode = 'off';
  previewingIndex = -1;
  previewProgress = signal<number>(0);

  // Cache para que os picos da onda não precisem ser recalculados a cada alteração
  private peakCache = new Map<string, number[]>();

  // Nós de áudio do player unificado de transição
  private audioCtx!: AudioContext | null;
  private sourceNode1!: MediaElementAudioSourceNode | null;
  private sourceNode2!: MediaElementAudioSourceNode | null;
  private gainNode1!: GainNode;
  private gainNode2!: GainNode;
  private playerElement1!: HTMLAudioElement;
  private playerElement2!: HTMLAudioElement;
  private previewIntervalId: any;

  constructor() {
  afterNextRender(() => {
    this.inicializarPlayersDeTransicao();
  });
}

  private inicializarPlayersDeTransicao() {
    this.playerElement1 = new Audio();
    this.playerElement2 = new Audio();
  }

  private iniciarWebAudio() {
    if (this.audioCtx) return;

    this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.sourceNode1 = this.audioCtx.createMediaElementSource(this.playerElement1);
    this.sourceNode2 = this.audioCtx.createMediaElementSource(this.playerElement2);

    this.gainNode1 = this.audioCtx.createGain();
    this.gainNode2 = this.audioCtx.createGain();

    this.sourceNode1.connect(this.gainNode1);
    this.sourceNode2.connect(this.gainNode2);

    this.gainNode1.connect(this.audioCtx.destination);
    this.gainNode2.connect(this.audioCtx.destination);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onFileDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files) {
      this.addFiles(Array.from(event.dataTransfer.files));
    }
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
    }
  }

  private addFiles(newFiles: File[]) {
    const validFiles = newFiles.filter(f => f.name.endsWith('.wav') || f.name.endsWith('.mp3'));

    validFiles.forEach(f => {
      const url = URL.createObjectURL(f);

      const track: RQSTrack = {
        file: f,
        name: f.name,
        crossfadeNext: 8.0,
        rawUrl: url,
        previewUrl: this.sanitizer.bypassSecurityTrustUrl(url),
        duration: 240,
        s3Key: null,
        isUploadingS3: false
      };

      this.tracks.push(track);
      this.uploadFaixaParaS3Silencioso(track);

      const tempAudio = new Audio(url);
      tempAudio.addEventListener('loadedmetadata', () => {
        track.duration = tempAudio.duration || 240;
        this.atualizarCrossoverVisivel();
      });
      tempAudio.load();
    });
  }

  private uploadFaixaParaS3Silencioso(track: RQSTrack) {
    track.isUploadingS3 = true;
    console.log(`[RQS SETLIST] Iniciando handshake S3 para a faixa: ${track.name}`);

    this.dspService.getPresignedUrl(track.file.name).subscribe({
      next: (s3Response) => {
        this.dspService.uploadToS3(s3Response.uploadUrl, track.file).subscribe({
          next: () => {
            track.isUploadingS3 = false;
            track.s3Key = s3Response.s3Key;
            console.log(`[RQS SETLIST] Faixa persistida com sucesso no S3. Chave: ${s3Response.s3Key}`);
          },
          error: (err) => {
            track.isUploadingS3 = false;
            console.error(`[CRITICAL] Falha ao enviar bytes de ${track.name} para o bunker S3.`);
          }
        });
      },
      error: (err) => {
        track.isUploadingS3 = false;
        console.error(`[CRITICAL] Gateway do S3 rejeitou a pré-assinatura de URL para ${track.name}`);
      }
    });
  }

  getWaveformBarArray(): number[] {
    return Array(80).fill(0);
  }

  getCachedPeaks(trackName: string): number[] {
    if (this.peakCache.has(trackName)) {
      return this.peakCache.get(trackName)!;
    }

    const peaks: number[] = [];
    let hash = 0;
    for (let i = 0; i < trackName.length; i++) {
      hash = trackName.charCodeAt(i) + ((hash << 5) - hash);
    }

    for (let i = 0; i < 80; i++) {
      const seed = Math.sin(hash + i) * 10000;
      const r = seed - Math.floor(seed);
      const baseHeight = 15 + Math.floor(r * 80);
      peaks.push(baseHeight);
    }

    this.peakCache.set(trackName, peaks);
    return peaks;
  }

  getWaveformBarStyles(trackIndex: number, barIndex: number, totalBars: number = 80): { [key: string]: string } {
    const track = this.tracks[trackIndex];
    const duration = track.duration || 240;
    const peak = this.getCachedPeaks(track.name)[barIndex];

    let opacity = 1.0;

    if (trackIndex > 0) {
      const prevTrack = this.tracks[trackIndex - 1];
      const prevCrossfade = prevTrack.crossfadeNext;
      const fadeInPercent = prevCrossfade / duration;
      const fadeInBars = totalBars * fadeInPercent;

      if (barIndex < fadeInBars) {
        opacity = barIndex / fadeInBars;
      }
    }

    if (trackIndex < this.tracks.length - 1) {
      const crossfade = track.crossfadeNext;
      const fadeOutPercent = crossfade / duration;
      const fadeOutBars = totalBars * fadeOutPercent;
      const fadeOutStartBar = totalBars - fadeOutBars;

      if (barIndex >= fadeOutStartBar) {
        opacity = (totalBars - barIndex) / fadeOutBars;
      }
    }

    const color = trackIndex % 2 === 0 ? '0, 240, 255' : '255, 0, 85';

    return {
      'height': `${peak}%`,
      'background-color': `rgba(${color}, ${0.15 + (opacity * 0.65)})`,
      'box-shadow': opacity > 0.4 ? `0 0 4px rgba(${color}, ${opacity * 0.15})` : 'none'
    };
  }

  detectarDiferentesSampleRates(): boolean {
    return this.tracks.length > 1 && this.tracks.some(t => t.name.includes('48k'));
  }

  detectarDiferentesBitDepths(): boolean {
    return this.tracks.length > 1 && this.tracks.some(t => t.name.includes('16bit'));
  }

  calcularTempoTotalFontes(): number {
    return this.tracks.reduce((acc, t) => acc + t.duration, 0);
  }

  calcularTotalCrossfades(): number {
    if (this.tracks.length < 2) return 0;
    return this.tracks.slice(0, -1).reduce((acc, t) => acc + t.crossfadeNext, 0);
  }

  calcularTempoEstimadoOutput(): number {
    return Math.max(0, this.calcularTempoTotalFontes() - this.calcularTotalCrossfades());
  }

  calcularTamanhoEstimadoMB(): number {
    const totalSegundos = this.calcularTempoEstimadoOutput();
    const bytesPorSegundo = 44100 * 3 * 2;
    const mb = (bytesPorSegundo * totalSegundos) / (1024 * 1024);
    return Math.round(mb);
  }

  setLoudnessMode(mode: LoudnessMatchMode) {
    this.loudnessMatchMode = mode;
    console.log(`[RQS SETLIST] Modo de Loudness alterado para: ${mode.toUpperCase()}`);
  }

  async ouvirTransicao(index: number) {
    if (index >= this.tracks.length - 1) return;
    this.pararPreviewDeTransicao();

    this.iniciarWebAudio();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    this.previewingIndex = index;
    this.previewProgress.set(0);

    const track1 = this.tracks[index];
    const track2 = this.tracks[index + 1];
    const fadeDuration = track1.crossfadeNext;

    const previewLead = 12.0;
    const previewTail = 12.0;
    const totalDuration = previewLead + fadeDuration + previewTail;

    const outPointTrack1 = track1.duration;
    const startTimeTrack1 = outPointTrack1 - previewLead - fadeDuration;

    this.playerElement1.src = track1.rawUrl;
    this.playerElement2.src = track2.rawUrl;

    this.playerElement1.currentTime = startTimeTrack1;
    this.playerElement2.currentTime = 0;

    await this.playerElement1.play();

    const now = this.audioCtx!.currentTime;
    this.gainNode1.gain.setValueAtTime(1.0, now);
    this.gainNode2.gain.setValueAtTime(0.0, now);

    let progressSecs = 0;
    const intervalMs = 100;

    this.previewIntervalId = setInterval(async () => {
      progressSecs += intervalMs / 1000;
      const percent = (progressSecs / totalDuration) * 100;
      this.previewProgress.set(percent);

      if (progressSecs >= previewLead && progressSecs < previewLead + (intervalMs / 1000)) {
        await this.playerElement2.play();
        this.aplicarCurvaDeCrossfade(fadeDuration);
      }

      if (progressSecs >= totalDuration) {
        this.pararPreviewDeTransicao();
      }
    }, intervalMs);
  }

  private aplicarCurvaDeCrossfade(duration: number) {
    const now = this.audioCtx!.currentTime;

    if (this.activeCurve === 'linear') {
      this.gainNode1.gain.setValueAtTime(1.0, now);
      this.gainNode1.gain.linearRampToValueAtTime(0.0, now + duration);

      this.gainNode2.gain.setValueAtTime(0.0, now);
      this.gainNode2.gain.linearRampToValueAtTime(1.0, now + duration);
    }
    else if (this.activeCurve === 'equal-power') {
      const steps = 100;
      const curve1 = new Float32Array(steps);
      const curve2 = new Float32Array(steps);
      for (let i = 0; i < steps; i++) {
        const ratio = i / (steps - 1);
        curve1[i] = Math.cos(ratio * Math.PI / 2);
        curve2[i] = Math.sin(ratio * Math.PI / 2);
      }
      this.gainNode1.gain.setValueCurveAtTime(curve1, now, duration);
      this.gainNode2.gain.setValueCurveAtTime(curve2, now, duration);
    }
    else if (this.activeCurve === 'fast-cut') {
      this.gainNode1.gain.setValueAtTime(1.0, now);
      this.gainNode1.gain.exponentialRampToValueAtTime(0.001, now + (duration * 0.3));

      this.gainNode2.gain.setValueAtTime(0.001, now);
      this.gainNode2.gain.exponentialRampToValueAtTime(1.0, now + duration);
    }
  }

  pararPreviewDeTransicao() {
    clearInterval(this.previewIntervalId);
    this.playerElement1.pause();
    this.playerElement2.pause();
    this.previewingIndex = -1;
    this.previewProgress.set(0);
  }

  moveUp(index: number) {
    if (index > 0) {
      const temp = this.tracks[index - 1];
      this.tracks[index - 1] = this.tracks[index];
      this.tracks[index] = temp;
    }
    this.pararPreviewDeTransicao();
  }

  moveDown(index: number) {
    if (index < this.tracks.length - 1) {
      const temp = this.tracks[index + 1];
      this.tracks[index + 1] = this.tracks[index];
      this.tracks[index] = temp;
    }
    this.pararPreviewDeTransicao();
  }

  removeTrack(index: number) {
    const track = this.tracks[index];
    if (track.rawUrl) {
      URL.revokeObjectURL(track.rawUrl);
    }
    this.tracks.splice(index, 1);
    this.pararPreviewDeTransicao();
  }

  igniteSetlist() {
    if (this.tracks.length < 2) return;

    this.isProcessing = true;
    this.mixSuccess = false;
    this.pararPreviewDeTransicao();

    const safeName = this.setlistName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'RQS_SETLIST_MASTER';
    this.audioComparison.audioProcessed.set(true);
    this.audioComparison.processedFilename.set(`${safeName}.wav`); // Now safeName is defined

    const crossfadesArray = this.tracks.slice(0, -1).map(track => {
      return track.crossfadeNext !== undefined ? track.crossfadeNext : 8.0;
    });

    const s3KeysArray = this.tracks.map(t => t.s3Key!);

    const payload = {
      s3Keys: s3KeysArray,
      crossfades: crossfadesArray,
      curva: this.activeCurve,
      loudness: this.loudnessMatchMode,
      exportName: this.setlistName
    };

    this.dspService.generateMixS3(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: any) => {
          this.isProcessing = false;
          this.mixSuccess = true;
          this.analytics.trackEvent('setlist_created');

          const a = document.createElement('a');
          a.href = response.downloadUrl;
          a.download = `${safeName}.wav`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          setTimeout(() => this.mixSuccess = false, 5000);
        },
        error: (err: any) => {
          this.isProcessing = false;
          console.error('Falha de Comunicação com a Matriz de Mixagem', err);
        }
      });
  }

  // 🟢 MÉTODO 1: FORMATAR TEMPO (GARANTIDO DENTRO DA CLASSE!) [1.1.2]
  formatarTempo(segundos: number): string {
    if (isNaN(segundos) || segundos < 0) return '00:00';
    const mins = Math.floor(segundos / 60);
    const secs = Math.floor(segundos % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  // 🟢 MÉTODO 2: ATUALIZAR CROSSOVER VISIVEL (GARANTIDO DENTRO DA CLASSE!) [1.1.2]
  atualizarCrossoverVisivel() {
    this.tracks = [...this.tracks];
  }

  ngOnDestroy() {
    this.pararPreviewDeTransicao();
    this.tracks.forEach(track => {
      if (track.rawUrl) {
        URL.revokeObjectURL(track.rawUrl);
      }
    });
    if (this.audioCtx) {
      this.audioCtx.close();
    }
  }
}
