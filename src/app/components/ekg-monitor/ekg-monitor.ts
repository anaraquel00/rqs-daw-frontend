import { Component, ElementRef, Input, ViewChild, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SafeResourceUrl } from '@angular/platform-browser';
@Component({
  selector: 'app-ekg-monitor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ekg-monitor.html',
  styleUrls: ['./ekg-monitor.scss']
})
export class EkgMonitorComponent implements OnDestroy {
  @Input() audioUrl: SafeResourceUrl | string | null = null;
  @ViewChild('canvasElement') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('audioElement') audioRef!: ElementRef<HTMLAudioElement>;

  isPlaying = false;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private animationId: number = 0;
  private isInitialized = false;

  togglePlay() {
    const audio = this.audioRef.nativeElement;

    if (!this.isInitialized) {
      this.configurarMotorDeAudio(audio);
    }

    // Se o contexto foi suspenso pelo navegador, nós o acordamos
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }

    if (audio.paused) {
      audio.play();
      this.isPlaying = true;
      this.desenharOndaCardiaca();
    } else {
      audio.pause();
      this.isPlaying = false;
      cancelAnimationFrame(this.animationId);
    }
  }

  pararMonitor() {
    this.isPlaying = false;
    cancelAnimationFrame(this.animationId);
  }

  private configurarMotorDeAudio(audio: HTMLAudioElement) {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();

    const source = this.audioContext.createMediaElementSource(audio);
    source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);

    // Configura a precisão do radar (quanto maior, mais detalhado)
    this.analyser.fftSize = 2048;
    this.isInitialized = true;
  }

  private desenharOndaCardiaca() {
    if (!this.analyser || !this.canvasRef) return;

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d')!;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      this.animationId = requestAnimationFrame(draw);
      this.analyser!.getByteTimeDomainData(dataArray);

      // Limpa o frame anterior pintando de escuro transparente para criar rastro
      ctx.fillStyle = 'rgba(10, 15, 20, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#00ffcc'; // Verde-Neon RQS
      ctx.beginPath();

      const sliceWidth = canvas.width * 1.0 / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = v * (canvas.height / 2);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();
    };

    draw();
  }

  ngOnDestroy() {
    cancelAnimationFrame(this.animationId);
    if (this.audioContext) {
      this.audioContext.close();
    }
  }
}
