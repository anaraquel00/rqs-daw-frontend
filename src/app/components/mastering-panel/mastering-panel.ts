// src/app/components/mastering-panel/mastering-panel.component.ts

import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnDestroy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../services/language.service';
import { AuthService } from '../../services/auth.service';
import { AudioComparisonService, AudioVariant } from '../../services/audio-comparison.service';
import { MasteringService } from '../../services/mastering.service';

@Component({
  selector: 'app-mastering-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mastering-panel.html',
  styleUrls: ['./mastering-panel.scss']
})
export class MasteringPanelComponent implements OnChanges, OnDestroy {
  readonly lang = inject(LanguageService);
  readonly auth = inject(AuthService);
  readonly audioComparison = inject(AudioComparisonService);

  // Injeta o serviço unificado de DSP [5.3]
  private readonly masteringService = inject(MasteringService);
  joiningWaitlist = false;
  joinedWaitlist = false;
  waitlistError = false;

  @Input() originalFile: File | null = null;
  @Input() isProcessing = false;
  @Input() masteredAudioUrl: string | null = null;
  @Input() isFullMaster = false; // Sabe se o arquivo recebido é a prévia ou a master completa! [1.1.2]

  // Enriquecemos a assinatura do Output para repassar os customParams de DSP para o componente pai
  @Output() processMaster = new EventEmitter<{
    estilo: string,
    intensidade: string,
    preview: boolean,
    customParams?: any
  }>();
  @Output() estiloAlterado = new EventEmitter<string>();

  estiloSelecionado: string = 'clear_sky';
  intensidadeSelecionada: string = 'media';
  volumeMatch: boolean = true;

  // --- SIGNALS VINCULADOS AO SERVIÇO DE DSP [5.3] ---
  readonly lowCutoff = this.masteringService.lowCutoff;
  readonly highCutoff = this.masteringService.highCutoff;
  readonly stereoWidth = this.masteringService.stereoWidth;
  readonly satAmount = this.masteringService.satAmount;
  readonly monoBassHz = this.masteringService.monoBassHz;
  readonly ceiling = this.masteringService.ceiling;
  readonly threshold = this.masteringService.threshold;

  // Signal computado para a porcentagem de saturação
  readonly satAmountPercent = computed(() => Math.round(this.satAmount() * 100));

  readonly previewWindowString = computed(() => {
    const start = this.audioComparison.previewStart();
    const end = this.audioComparison.previewEnd();
    return `${this.formatarTempo(start)} – ${this.formatarTempo(end)}`;
  });

  // --- COMPORTAMENTOS DOS CONTROLES DO SLIDER ---
  updateLowCutoff(event: Event) {
    const value = +(event.target as HTMLInputElement).value;
    this.masteringService.setLowCutoff(value);
  }

  updateHighCutoff(event: Event) {
    const value = +(event.target as HTMLInputElement).value;
    this.masteringService.setHighCutoff(value);
  }

  updateStereoWidth(event: Event) {
    const value = +(event.target as HTMLInputElement).value;
    this.masteringService.setStereoWidth(value);
  }

  updateSatAmount(event: Event) {
    const value = +(event.target as HTMLInputElement).value / 100;
    this.masteringService.setSatAmount(value);
  }

  updateMonoBass(event: Event) {
    const value = +(event.target as HTMLInputElement).value;
    this.masteringService.setMonoBass(value);
  }

  updateCeiling(event: Event) {
    const value = +(event.target as HTMLInputElement).value;
    this.masteringService.setCeiling(value);
  }

  updateThreshold(event: Event) {
    const value = +(event.target as HTMLInputElement).value;
    this.masteringService.setThreshold(value);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['originalFile'] && this.originalFile) {
      const url = window.URL.createObjectURL(this.originalFile);
      this.audioComparison.setOriginalSrc(url);
    }

    if (changes['masteredAudioUrl'] && this.masteredAudioUrl) {
      // O S3 devolveu o áudio! Decide o modo com base na flag isFullMaster [1.1.2]
      const mode = this.isFullMaster ? 'full-track' : 'preview-15s';
      this.audioComparison.setMasterSrc(this.masteredAudioUrl, mode);
    }
  }

  selecionarEstilo(estilo: string) {
    this.estiloSelecionado = estilo;
    this.estiloAlterado.emit(estilo);
  }

  selecionarIntensidade(intensidade: string) {
    this.intensidadeSelecionada = intensidade;
  }

  alternarAudicao(variant: AudioVariant) {
    this.audioComparison.switchVariant(variant);
  }

  dispararPreview() {
    this.audioComparison.previewStatus.set('processing');
    this.processMaster.emit({
      estilo: this.estiloSelecionado,
      intensidade: this.intensidadeSelecionada,
      preview: true,
      customParams: this.masteringService.getMasteringPayload() // Passa o payload dinâmico ajustado
    });
  }

  dispararProcessamentoCompleto() {
    this.processMaster.emit({
      estilo: this.estiloSelecionado,
      intensidade: this.intensidadeSelecionada,
      preview: false,
      customParams: this.masteringService.getMasteringPayload() // Passa o payload dinâmico ajustado
    });
  }

  pararReproducao() {
    this.audioComparison.stopAndReset();
  }

  formatarTempo(segundos: number): string {
    if (isNaN(segundos)) return '00:00';
    const mins = Math.floor(segundos / 60);
    const secs = Math.floor(segundos % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  onScrubberChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const val = parseFloat(input.value);

    if (this.audioComparison.activeVariant() === 'master' && this.audioComparison.playbackMode() === 'preview-15s') {
      const targetInOriginal = this.audioComparison.previewStart() + val;
      this.audioComparison.seek(targetInOriginal);
    } else {
      this.audioComparison.seek(val);
    }
  }

  async joinProWaitlist(): Promise<void> {

  const email =
    this.auth.session()?.user?.email;

  if (!email) {
    this.waitlistError = true;
    return;
  }

  this.joiningWaitlist = true;
  this.waitlistError = false;

  try {

    const response = await fetch(
      '/api/waitlist',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          email,
          source: 'studio.raquelsynths.com',
          language: this.lang.currentLang(),
          website: ''
        })
      }
    );

    const result = await response.json();

    if (!response.ok || !result.success) {
      this.waitlistError = true;
      return;
    }

    this.joinedWaitlist = true;

  } catch {
    this.waitlistError = true;

  } finally {
    this.joiningWaitlist = false;
  }
}

  ngOnDestroy() {
    this.audioComparison.resetAll();
  }
}
