import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DspService } from '../services/dsp';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

// 🛡️ O CONTRATO DA MATRIZ: Ensinando ao TypeScript o que é uma faixa RQS
export interface RQSTrack {
  file: File;
  name: string;
  crossfadeNext: number;
  previewUrl: SafeUrl;
  rawUrl: string;
}

@Component({
  selector: 'app-mix-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mix-panel.html',
  styleUrls: ['./mix-panel.scss']
})
export class MixPanelComponent {
  private dspService = inject(DspService);
  private sanitizer = inject(DomSanitizer);

  // 🎛️ Variável do RQS Mix Engine amarrada ao HTML (Padrão 8.0s)
  crossfadeValue: number = 8.0;

  tracks: RQSTrack[] = [];
  // 🛡️ Variáveis de Telemetria UX
  isProcessing: boolean = false;
  mixSuccess: boolean = false;

  // 🛡️ Nomenclatura Padrão de Classe RQS
  setlistName: string = 'THE BLUEPRINT_SESSIONS_Vol_XYZ';

  // 🛡️ Previne que o navegador abra o arquivo quando você arrasta
  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  // 🖱️ Captura os arquivos soltos pelo mouse (Drag & Drop)
  onFileDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer?.files) {
      this.addFiles(Array.from(event.dataTransfer.files));
    }
  }

  // 📂 Captura os arquivos se o usuário clicar e abrir a pasta
  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.addFiles(Array.from(input.files));
    }
  }

  // Adiciona as tracks ao nosso barramento
  private addFiles(newFiles: File[]) {
    // Filtro de segurança: só entra áudio
    const validFiles = newFiles.filter(f => f.name.endsWith('.wav') || f.name.endsWith('.mp3'));
    
    const newTracks = validFiles.map(f => {
      const url = URL.createObjectURL(f);
      return { 
        file: f, 
        name: f.name, 
        crossfadeNext: 8.0,
        rawUrl: url,
        previewUrl: this.sanitizer.bypassSecurityTrustUrl(url)
      };
    });
    
    this.tracks.push(...newTracks);
  }

  // 🔼 Lógica de Reordenação: Sobe a track
  moveUp(index: number) {
    if (index > 0) {
      const temp = this.tracks[index - 1];
      this.tracks[index - 1] = this.tracks[index];
      this.tracks[index] = temp;
    }
  }

  // 🔽 Lógica de Reordenação: Desce a track
  moveDown(index: number) {
    if (index < this.tracks.length - 1) {
      const temp = this.tracks[index + 1];
      this.tracks[index + 1] = this.tracks[index];
      this.tracks[index] = temp;
    }
  }

  // ❌ Remove a track da fila
  removeTrack(index: number) {
    const track = this.tracks[index];
    if (track.rawUrl) {
      URL.revokeObjectURL(track.rawUrl);
    }
    this.tracks.splice(index, 1);
  }

  igniteSetlist() {
    if (this.tracks.length === 0) return;

    this.isProcessing = true;
    this.mixSuccess = false;

    // 🎛️ CAPTURA MICRO-CIRÚRGICA: Varre a linha do tempo e pega o crossfade customizado de CADA música
    const crossfadesArray = this.tracks.slice(0, -1).map(track => {
      return track.crossfadeNext !== undefined ? track.crossfadeNext : 8.0;
    });

    // 🛡️ EXTRAÇÃO DE BINÁRIOS: Converte o array de objetos RQSTrack de volta para File[]
    const fileArray = this.tracks.map(t => t.file);

    // Dispara enviando a lista completa
    this.dspService.generateMix(fileArray, crossfadesArray).subscribe({
      next: (blob: Blob) => {
        this.isProcessing = false;
        this.mixSuccess = true;

        // Limpeza de Caracteres: Troca espaços por underline e remove símbolos estranhos para não quebrar o Windows
        const safeName = this.setlistName.trim().replace(/[^a-zA-Z0-9_-]/g, '_') || 'RQS_SETLIST_MASTER';

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // 💎 O Download Limpo e Profissional
        a.download = `${safeName}.wav`;
        a.click();
        window.URL.revokeObjectURL(url);

        setTimeout(() => this.mixSuccess = false, 5000);
      },
      error: (err: any) => {
        this.isProcessing = false;
        console.error('Falha de Comunicação com a Matriz de Mixagem', err);
      }
    });
  }
}
