import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-mastering-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mastering-panel.html',
  styleUrls: ['./mastering-panel.scss']
})
export class MasteringPanelComponent implements OnChanges, OnDestroy {

  @Input() originalFile: File | null = null;
  @Input() isProcessing = false;
  @Input() masteredAudioUrl: string | null = null;

  // Emissores de Eventos de Comunicação Inter-Componentes [1.1.2]
  @Output() processMaster = new EventEmitter<{estilo: string, intensidade: string, preview: boolean}>();
  @Output() estiloAlterado = new EventEmitter<string>(); // 🟢 CORREÇÃO: Resolve o (estiloAlterado) do pai

  estiloSelecionado: string = 'clear_sky';
  intensidadeSelecionada: string = 'media';
  modoAudicao: 'original' | 'master' = 'original';
  volumeMatch: boolean = true;

  originalAudioUrl: string | null = null;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['originalFile'] && this.originalFile) {
      this.limparBufferOriginal();
      this.originalAudioUrl = window.URL.createObjectURL(this.originalFile);
    }
  }

  ngOnDestroy() {
    this.limparBufferOriginal();
  }

  private limparBufferOriginal() {
    if (this.originalAudioUrl) {
      window.URL.revokeObjectURL(this.originalAudioUrl);
      this.originalAudioUrl = null;
    }
  }

  selecionarEstilo(estilo: string) {
    this.estiloSelecionado = estilo;
    this.estiloAlterado.emit(estilo); // 🟢 CORREÇÃO: Dispara a troca de fita instantânea no player [1.1.2]
  }

  selecionarIntensidade(intensidade: string) {
    this.intensidadeSelecionada = intensidade;
  }

  alternarModo(modo: 'original' | 'master') {
    if (modo === 'master' && !this.masteredAudioUrl) return;
    this.modoAudicao = modo;
  }

  dispararPreview() {
    this.processMaster.emit({
      estilo: this.estiloSelecionado,
      intensidade: this.intensidadeSelecionada,
      preview: true
    });
  }

  dispararProcessamento() {
    this.processMaster.emit({
      estilo: this.estiloSelecionado,
      intensidade: this.intensidadeSelecionada,
      preview: false
    });
  }
}
