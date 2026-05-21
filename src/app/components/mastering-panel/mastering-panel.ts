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

  // Recebe o arquivo cru da Zona de Upload
  @Input() originalFile: File | null = null;
  @Input() isProcessing = false;
  @Input() masteredAudioUrl: string | null = null;

  // Emite a ordem de ignição para o componente pai
  @Output() processMaster = new EventEmitter<{estilo: string, intensidade: string, preview: boolean}>();

  // Estados do Painel
  // 🛡️ Nomenclatura atualizada para os Perfis Dolby-Style
  estiloSelecionado: string = 'clear_sky';
  intensidadeSelecionada: string = 'media';
  modoAudicao: 'original' | 'master' = 'original';
  volumeMatch: boolean = true;

  // 🛡️ PATCH: Variável estática para blindar a memória e estabilizar o Player
  originalAudioUrl: string | null = null;

  // ⚙️ INJEÇÃO: Monitora quando a "General" joga o arquivo na interface
  ngOnChanges(changes: SimpleChanges) {
    if (changes['originalFile'] && this.originalFile) {
      // 1. Destrói o buffer antigo se houver
      this.limparBufferOriginal();
      // 2. Forja o novo URL apenas UMA vez
      this.originalAudioUrl = window.URL.createObjectURL(this.originalFile);
    }
  }

  // 🧹 GARBAGE COLLECTION: Limpa a RAM do navegador quando o painel for fechado
  ngOnDestroy() {
    this.limparBufferOriginal();
  }

  private limparBufferOriginal() {
    if (this.originalAudioUrl) {
      window.URL.revokeObjectURL(this.originalAudioUrl);
      this.originalAudioUrl = null;
    }
  }

  // 🎛️ Funções de Controle Intactas
  selecionarEstilo(estilo: string) {
    this.estiloSelecionado = estilo;
  }

  selecionarIntensidade(intensidade: string) {
    this.intensidadeSelecionada = intensidade;
  }

  alternarModo(modo: 'original' | 'master') {
    if (modo === 'master' && !this.masteredAudioUrl) return; // Trava de segurança
    this.modoAudicao = modo;
  }

  dispararPreview() {
  this.processMaster.emit({
  estilo: this.estiloSelecionado,
  intensidade: this.intensidadeSelecionada,
  preview: true // Flag para indicar que é um teste de 15 segundos
  })
  }
  dispararProcessamento() {
    this.processMaster.emit({
      estilo: this.estiloSelecionado,
      intensidade: this.intensidadeSelecionada,
      preview: false // Flag para indicar que é o processamento completo
    });
  }
}
