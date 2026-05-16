import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-mastering-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mastering-panel.html',
  styleUrls: ['./mastering-panel.scss']
})

export class MasteringPanelComponent {
  // Recebe o arquivo cru da Zona de Upload
  @Input() originalFile: File | null = null;
  @Input() isProcessing = false;
  @Input() masteredAudioUrl: string | null = null;

  // Emite a ordem de ignição para o componente pai
  @Output() processMaster = new EventEmitter<{estilo: string, intensidade: string}>();

  // Estados do Painel
  estiloSelecionado: string = 'equilibrado';
  intensidadeSelecionada: string = 'media';
  modoAudicao: 'original' | 'master' = 'original';
  volumeMatch: boolean = true;

  get originalAudioUrl(): string | null {
    return this.originalFile ? window.URL.createObjectURL(this.originalFile) : null;
  }

  get currentAudioUrl(): string | null {
    return this.modoAudicao === 'master' && this.masteredAudioUrl
      ? this.masteredAudioUrl
      : this.originalAudioUrl;
  }

  selecionarEstilo(estilo: string) {
    this.estiloSelecionado = estilo;
  }

  selecionarIntensidade(intensidade: string) {
    this.intensidadeSelecionada = intensidade;
  }

  alternarModo(modo: 'original' | 'master') {
    if (modo === 'master' && !this.masteredAudioUrl) return; // Trava se não houver master
    this.modoAudicao = modo;
  }

  dispararProcessamento() {
    this.processMaster.emit({
      estilo: this.estiloSelecionado,
      intensidade: this.intensidadeSelecionada
    });
  }
}
