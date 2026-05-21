import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DspService } from '../services/dsp';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-mix-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mix-panel.html',
  styleUrls: ['./mix-panel.scss']
})
export class MixPanelComponent {
  private dspService = inject(DspService);

  // O Array que guarda a nossa linha do tempo
  tracks: File[] = [];
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
    this.tracks.push(...validFiles);
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
    this.tracks.splice(index, 1);
  }

 igniteSetlist() {
    if (this.tracks.length === 0) return;

    this.isProcessing = true;
    this.mixSuccess = false;

    this.dspService.generateMix(this.tracks, 0.5).subscribe({
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
