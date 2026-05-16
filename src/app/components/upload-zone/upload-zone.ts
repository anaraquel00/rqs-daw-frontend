import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DspService } from '../../services/dsp';
import { EkgMonitorComponent } from '../ekg-monitor/ekg-monitor';
import { MasteringPanelComponent } from '../mastering-panel/mastering-panel';


@Component({
  selector: 'app-upload-zone',
  standalone: true,
  imports: [CommonModule, EkgMonitorComponent, MasteringPanelComponent],
  templateUrl: './upload-zone.html',
  styleUrls: ['./upload-zone.scss']
})
export class UploadZoneComponent {
  isDragging = false;
  selectedFile: File | null = null;

  // 🛡️ Novos Estados da Interface
  isProcessing = false;
  processedAudioUrl: string | null = null;
  processedAudioName: string = '';

  private dspService = inject(DspService);

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;

    if (event.dataTransfer?.files.length) {
      this.selectedFile = event.dataTransfer.files[0];
      // Limpa os estados anteriores se um novo arquivo for jogado
      this.processedAudioUrl = null;
      this.isProcessing = false;
      console.log('📦 [FRONT-END] Arquivo ancorado:', this.selectedFile.name);
    }
  }

  processar(estilo: string) {
    if (!this.selectedFile) return;

    // Trava a interface e mostra o aviso de carregamento
    this.isProcessing = true;
    this.processedAudioUrl = null;

    console.log(`🚀 [IGNIÇÃO] Enviando para RQS API. Estilo: ${estilo}`);

    this.dspService.processarAudio(this.selectedFile, estilo).subscribe({
      next: (response: Blob) => {
        // Libera a interface
        this.isProcessing = false;

        // Gera o URL na memória e cria o nome final
        this.processedAudioUrl = window.URL.createObjectURL(response);
        const originalName = this.selectedFile!.name.replace('.wav', '');
        this.processedAudioName = `RQS_MASTER_${estilo.toUpperCase()}_${originalName}.wav`;

        console.log('✅ [SUCESSO] Pacote ancorado. Aguardando extração manual.');
      },
      error: (err) => {
        this.isProcessing = false;
        console.error('⚠️ [ERRO DE PROTOCOLO] O reator Python rejeitou a carga:', err);
      }
    });
  }

  // 🚀 A nova função que recebe as ordens do painel
  processarMaster(config: {estilo: string, intensidade: string}) {
    if (!this.selectedFile) return;

    this.isProcessing = true;
    this.processedAudioUrl = null;

    // Por enquanto, vamos juntar os dois parâmetros numa string para o backend
    const estiloPayload = `${config.estilo}_${config.intensidade}`;

    console.log(`🚀 [IGNIÇÃO] Enviando para RQS API. Payload: ${estiloPayload}`);

    this.dspService.processarAudio(this.selectedFile, estiloPayload).subscribe({
      next: (response: Blob) => {
        this.isProcessing = false;
        this.processedAudioUrl = window.URL.createObjectURL(response);
        const originalName = this.selectedFile!.name.replace('.wav', '');
        this.processedAudioName = `RQS_MASTER_${estiloPayload.toUpperCase()}_${originalName}.wav`;
        console.log('✅ [SUCESSO] Pacote ancorado. Mude o Toggle para Master e ouça!');
      },
      error: (err) => {
        this.isProcessing = false;
        console.error('⚠️ [ERRO DE PROTOCOLO] O reator Python rejeitou a carga:', err);
      }
    });
  }
}

