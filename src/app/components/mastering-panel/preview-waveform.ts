import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-preview-waveform',
  standalone: true,
  templateUrl: './preview-waveform.html',
  styleUrls: ['./preview-waveform.scss'],
})
export class PreviewWaveformComponent implements AfterViewInit, OnChanges, OnDestroy {
  private static readonly peakCache = new WeakMap<File, number[]>();
  @Input() file: File | null = null;
  @Input() duration = 0;
  @Input() currentTime = 0;
  @Input() previewStart = 0;
  @Input() previewEnd = 15;
  @Input() disabled = false;

  @Output() rangeStartChange = new EventEmitter<number>();
  @Output() seekTo = new EventEmitter<number>();

  @ViewChild('waveformHost') private waveformHost?: ElementRef<HTMLDivElement>;
  @ViewChild('waveformCanvas') private waveformCanvas?: ElementRef<HTMLCanvasElement>;

  private peaks: number[] = [];
  private viewReady = false;
  private resizeObserver?: ResizeObserver;
  private decodeToken = 0;
  private dragging = false;
  private dragPointerId: number | null = null;
  private dragOffsetSeconds = 0;

  constructor(@Inject(PLATFORM_ID) private readonly platformId: object) {}

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (isPlatformBrowser(this.platformId) && typeof ResizeObserver !== 'undefined' && this.waveformHost) {
      this.resizeObserver = new ResizeObserver(() => this.drawWaveform());
      this.resizeObserver.observe(this.waveformHost.nativeElement);
    }
    void this.loadWaveform();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady) return;
    if (changes['file']) {
      void this.loadWaveform();
      return;
    }
    this.drawWaveform();
  }

  ngOnDestroy(): void {
    this.decodeToken += 1;
    this.resizeObserver?.disconnect();
  }

  previewLeftPercent(): number {
    if (this.duration <= 0) return 0;
    return Math.max(0, Math.min(100, (this.previewStart / this.duration) * 100));
  }

  previewWidthPercent(): number {
    if (this.duration <= 0) return 0;
    const length = Math.max(0, this.previewEnd - this.previewStart);
    return Math.max(0, Math.min(100, (length / this.duration) * 100));
  }

  playheadPercent(): number {
    if (this.duration <= 0) return 0;
    return Math.max(0, Math.min(100, (this.currentTime / this.duration) * 100));
  }

  rangeSeconds(): number {
    return Math.max(0, this.previewEnd - this.previewStart);
  }

  rangeLabel(): string {
    return `${this.rangeSeconds().toFixed(1)}s`;
  }

  onRegionPointerDown(event: PointerEvent): void {
    if (this.disabled || this.duration <= this.rangeSeconds() + 0.001 || !this.waveformHost) return;
    event.preventDefault();
    event.stopPropagation();

    const host = this.waveformHost.nativeElement;
    const pointerSeconds = this.secondsAtClientX(event.clientX);
    this.dragOffsetSeconds = Math.max(0, Math.min(this.rangeSeconds(), pointerSeconds - this.previewStart));
    this.dragging = true;
    this.dragPointerId = event.pointerId;
    host.setPointerCapture(event.pointerId);
  }

  onHostPointerMove(event: PointerEvent): void {
    if (!this.dragging || this.dragPointerId !== event.pointerId) return;
    event.preventDefault();
    const next = this.normalizeRangeStart(this.secondsAtClientX(event.clientX) - this.dragOffsetSeconds);
    if (Math.abs(next - this.previewStart) >= 0.005) this.rangeStartChange.emit(next);
  }

  onHostPointerUp(event: PointerEvent): void {
    if (!this.dragging || this.dragPointerId !== event.pointerId || !this.waveformHost) return;
    const host = this.waveformHost.nativeElement;
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
    this.dragging = false;
    this.dragPointerId = null;
  }

  onHostPointerDown(event: PointerEvent): void {
    if (this.disabled || this.dragging) return;
    this.seekTo.emit(this.secondsAtClientX(event.clientX));
  }

  private normalizeRangeStart(value: number): number {
    const range = this.rangeSeconds();
    const maxStart = Math.max(0, this.duration - range);
    return Math.max(0, Math.min(value, maxStart));
  }

  private secondsAtClientX(clientX: number): number {
    const rect = this.waveformHost?.nativeElement.getBoundingClientRect();
    if (!rect || rect.width <= 0 || this.duration <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return ratio * this.duration;
  }

  private async loadWaveform(): Promise<void> {
    if (!this.viewReady || !isPlatformBrowser(this.platformId) || !this.file) {
      this.peaks = [];
      this.drawWaveform();
      return;
    }

    const cached = PreviewWaveformComponent.peakCache.get(this.file);
    if (cached) {
      this.peaks = cached;
      this.drawWaveform();
      return;
    }

    const token = ++this.decodeToken;
    let context: AudioContext | null = null;
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) throw new Error('Web Audio API is unavailable.');
      context = new AudioContextCtor();
      const bytes = await this.file.arrayBuffer();
      const buffer = await context.decodeAudioData(bytes.slice(0));
      if (token !== this.decodeToken) return;
      this.peaks = this.buildPeaks(buffer, 900);
      PreviewWaveformComponent.peakCache.set(this.file, this.peaks);
    } catch (error) {
      if (token === this.decodeToken) {
        this.peaks = [];
        console.warn('[RQS WAVEFORM] Could not decode source waveform.', error);
      }
    } finally {
      if (context) void context.close();
    }
    this.drawWaveform();
  }

  private buildPeaks(buffer: AudioBuffer, bins: number): number[] {
    const length = buffer.length;
    if (length <= 0) return [];
    const count = Math.max(64, Math.min(bins, length));
    const channels = Math.max(1, Math.min(2, buffer.numberOfChannels));
    const data = Array.from({ length: channels }, (_, index) => buffer.getChannelData(index));
    const block = Math.max(1, Math.floor(length / count));
    const peaks = new Array<number>(count).fill(0);
    let globalMax = 0;

    for (let i = 0; i < count; i += 1) {
      const start = i * block;
      const end = i === count - 1 ? length : Math.min(length, start + block);
      const step = Math.max(1, Math.floor((end - start) / 96));
      let peak = 0;
      for (let frame = start; frame < end; frame += step) {
        for (let channel = 0; channel < channels; channel += 1) {
          peak = Math.max(peak, Math.abs(data[channel][frame] ?? 0));
        }
      }
      peaks[i] = peak;
      globalMax = Math.max(globalMax, peak);
    }

    if (globalMax <= 0) return peaks;
    return peaks.map((value) => value / globalMax);
  }

  private drawWaveform(): void {
    if (!this.viewReady || !isPlatformBrowser(this.platformId) || !this.waveformCanvas || !this.waveformHost) return;
    const canvas = this.waveformCanvas.nativeElement;
    const host = this.waveformHost.nativeElement;
    const rect = host.getBoundingClientRect();
    const cssWidth = Math.max(1, Math.floor(rect.width));
    const cssHeight = Math.max(1, Math.floor(rect.height));
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.floor(cssWidth * dpr);
    canvas.height = Math.floor(cssHeight * dpr);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const mid = cssHeight / 2;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(cssWidth, mid);
    ctx.stroke();

    if (this.peaks.length === 0) return;
    const stepX = cssWidth / this.peaks.length;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.72)';
    ctx.lineWidth = Math.max(1, stepX * 0.55);
    ctx.beginPath();
    for (let i = 0; i < this.peaks.length; i += 1) {
      const x = (i + 0.5) * stepX;
      const half = Math.max(1, this.peaks[i] * (cssHeight * 0.43));
      ctx.moveTo(x, mid - half);
      ctx.lineTo(x, mid + half);
    }
    ctx.stroke();
  }
}
