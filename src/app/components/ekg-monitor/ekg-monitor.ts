// src/app/components/ekg-monitor/ekg-monitor.component.ts
import { Component, Input, inject, ElementRef, ViewChild, OnChanges, SimpleChanges, OnDestroy, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-ekg-monitor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ekg-monitor.html',
  styleUrls: ['./ekg-monitor.scss']
})
export class EkgMonitorComponent implements OnChanges, OnDestroy, AfterViewInit {
  readonly lang = inject(LanguageService);

  @Input() audioUrl: string | null = null;

  @ViewChild('ekgCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;

  isPlaying = false;
  private audio: HTMLAudioElement | null = null;
  private animationId: number | null = null;

  // 🟢 MÓDULOS DA WEB AUDIO API PARA ANÁLISE REAL DE SINAL [1.2.1]
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['audioUrl'] && this.audioUrl) {
      this.cleanupAudio();

      // Inicializa o elemento de áudio com suporte a CORS para o seu bucket S3 [1.2.6]
      this.audio = new Audio();
      this.audio.crossOrigin = "anonymous"; // 🟢 Impedirá erros de CORS ao ler o áudio direto do S3!
      this.audio.src = this.audioUrl;
      this.audio.loop = true;
      this.isPlaying = false;

      this.audio.onended = () => {
        this.isPlaying = false;
      };
    }
  }

  ngAfterViewInit() {
    this.startCanvasAnimation();
  }

  ngOnDestroy() {
    this.cleanup();
    this.cleanupAudio();
  }

  togglePlay() {
    if (!this.audio) return;

    // 🟢 INICIALIZAÇÃO DO ANALISADOR SÔNICO NA PRIMEIRA INTERAÇÃO [1.2.1]
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256; // Tamanho de bloco curto garante máxima reatividade visual ao kick

      // Conecta o player de áudio diretamente ao analisador de espectro
      this.source = this.audioCtx.createMediaElementSource(this.audio);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
    }

    if (this.isPlaying) {
      this.audio.pause();
      this.isPlaying = false;
    } else {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      this.audio.play().then(() => {
        this.isPlaying = true;
      }).catch(err => {
        console.error("Falha ao reproduzir EKG físico:", err);
      });
    }
  }

  private startCanvasAnimation() {
    this.cleanup();
    this.draw();
  }

  // 🟢 RENDERIZADOR OSCILOSCÓPIO EM TEMPO REAL (CAPTURA AS ONDAS DA SUA MÚSICA) [1.2.1]
  private draw = () => {
    if (!this.canvasRef) {
      this.animationId = requestAnimationFrame(this.draw);
      return;
    }

    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    }

    // Efeito de rastro fosco verde analógico
    ctx.fillStyle = '#05080a';
    ctx.fillRect(0, 0, width, height);

    ctx.lineWidth = 1.8;
    ctx.strokeStyle = '#00ffcc';
    ctx.shadowBlur = 8;
    ctx.shadowColor = '#00ffcc';

    ctx.beginPath();

    const pointsCount = 120;

    // 🟢 SE ESTIVER TOCANDO, CONECTA A CANETA VISUAL ÀS ONDAS REAIS DO SEU WAV! [1.2.1]
    if (this.isPlaying && this.analyser) {
      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // Extrai os dados binários puros de domínio de tempo da música [1.2.1]
      this.analyser.getByteTimeDomainData(dataArray);

      const sliceWidth = width / (bufferLength - 1);
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        // Normaliza o byte (0-255) para ponto flutuante centralizado em Y
        const v = dataArray[i] / 128.0;
        const y = v * (height / 2);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }
    } else {
      // Se estiver pausado, exibe a linha plana com micro ruído estático de repouso
      const sliceWidth = width / (pointsCount - 1);
      let x = 0;
      const midY = height / 2;

      for (let i = 0; i < pointsCount; i++) {
        const noise = (Math.random() - 0.5) * 1.5;
        const y = midY + noise;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        x += sliceWidth;
      }
    }

    ctx.stroke();

    this.animationId = requestAnimationFrame(this.draw);
  };

  private cleanup() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  // 🧹 LIMPEZA COMPULSORIA DE RECURSOS AUDIO CONTEXT (Evita travamentos de som) [1.1.5]
  private cleanupAudio() {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}
