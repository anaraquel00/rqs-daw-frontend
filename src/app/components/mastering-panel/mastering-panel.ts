// src/app/components/mastering-panel/mastering-panel.component.ts
import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnDestroy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../services/language.service';
import { AuthService } from '../../services/auth.service';
import { AudioComparisonService, AudioVariant } from '../../services/audio-comparison.service';

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

  @Input() originalFile: File | null = null;
  @Input() isProcessing = false;
  @Input() masteredAudioUrl: string | null = null;
  @Input() isFullMaster = false; // 🟢 NOVO: Sabe se o arquivo recebido é a prévia ou a master completa! [1.1.2]

  @Output() processMaster = new EventEmitter<{estilo: string, intensidade: string, preview: boolean}>();
  @Output() estiloAlterado = new EventEmitter<string>();

  estiloSelecionado: string = 'clear_sky';
  intensidadeSelecionada: string = 'media';
  volumeMatch: boolean = true;

  readonly previewWindowString = computed(() => {
    const start = this.audioComparison.previewStart();
    const end = this.audioComparison.previewEnd();
    return `${this.formatarTempo(start)} – ${this.formatarTempo(end)}`;
  });

  ngOnChanges(changes: SimpleChanges) {
    if (changes['originalFile'] && this.originalFile) {
      const url = window.URL.createObjectURL(this.originalFile);
      this.audioComparison.setOriginalSrc(url);
    }

    if (changes['masteredAudioUrl'] && this.masteredAudioUrl) {
      // 🟢 O S3 devolveu o áudio! Decide o modo com base na flag isFullMaster [1.1.2]
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
      preview: true
    });
  }

  dispararProcessamentoCompleto() {
    this.processMaster.emit({
      estilo: this.estiloSelecionado,
      intensidade: this.intensidadeSelecionada,
      preview: false
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

  ngOnDestroy() {
    this.audioComparison.resetAll();
  }
}
