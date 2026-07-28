import { Component, inject, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DspService } from '../../services/dsp';
import { EkgMonitorComponent } from '../ekg-monitor/ekg-monitor';
import { MasteringPanelComponent } from '../mastering-panel/mastering-panel';
import { forkJoin } from 'rxjs';
import { LanguageService } from '../../services/language.service'; // 🟢 IMPORTANTE


@Component({
  selector: 'app-upload-zone',
  standalone: true,
  imports: [CommonModule, EkgMonitorComponent, MasteringPanelComponent],
  templateUrl: './upload-zone.html',
  styleUrls: ['./upload-zone.scss']
})
export class UploadZoneComponent implements OnDestroy, AfterViewChecked {

  // Referência para rolar o terminal de logs automaticamente para o final
  @ViewChild('terminalBody') private terminalScrollContainer!: ElementRef;

  readonly lang = inject(LanguageService);

  isDragging = false;
  selectedFile: File | null = null;
  isProcessing = false;
  processedAudioUrl: string | null = null;
  processedAudioName: string = '';

  // 🟢 REGISTRO DE TELEMETRIA DINÂMICA
  systemLogs: string[] = [];
  s3Key: string | null = null;
  isUploadingS3 = false;

  previewsCache: { [key: string]: string } = {
    thunder: '',
    clear_sky: '',
    sunroof: '',
    aurora: ''
  };

  private dspService = inject(DspService);

  // Auto-scroll do terminal a cada nova linha adicionada
  ngAfterViewChecked() {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      this.terminalScrollContainer.nativeElement.scrollTop = this.terminalScrollContainer.nativeElement.scrollHeight;
    } catch(err) { }
  }

  // 🟢 GRAVADOR DE LOGS SÔNICOS (Escreve na tela e no console de desenvolvedor) [1]
  addLog(message: string) {
    const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    const logEntry = `[${time}] ${message}`;
    this.systemLogs.push(logEntry);
    console.log(`[RQS CORE] ${logEntry}`);
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      const selected = input.files[0];
      const fileName = selected.name.toLowerCase();

      if (fileName.endsWith('.wav') || fileName.endsWith('.mp3')) {
        this.selectedFile = selected;
        this.processedAudioUrl = null;
        this.s3Key = null;
        this.systemLogs = []; // Reseta o terminal sônico

        this.addLog(`Track engatada via File Picker: ${selected.name}`);
        this.iniciarUploadS3Silencioso(selected);
      } else {
        console.error('[BLOCK] Formato incompatível. Insira espectros puros (.wav ou .mp3).');
      }
      input.value = '';
    }
  }

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
      this.processedAudioUrl = null;
      this.isProcessing = false;
      this.s3Key = null;
      this.systemLogs = [];

      this.addLog(`Track engatada via Drag & Drop: ${this.selectedFile.name}`);
      this.iniciarUploadS3Silencioso(this.selectedFile);
    }
  }

  iniciarUploadS3Silencioso(file: File) {
    this.isUploadingS3 = true;
    this.addLog(`Iniciando handshake S3 para: ${file.name}`);

    this.dspService.getPresignedUrl(file.name).subscribe({
      next: (s3Response) => {
        this.addLog(`URL pré-assinada concedida pelo S3. Iniciando upload em background...`);

        this.dspService.uploadToS3(s3Response.uploadUrl, file).subscribe({
          next: () => {
            this.isUploadingS3 = false;
            this.s3Key = s3Response.s3Key;
            this.addLog(`Upload concluído! Arquivo persistido em: ${s3Response.s3Key}`);
          },
          error: (err) => {
            this.isUploadingS3 = false;
            this.addLog(`❌ ERRO CRÍTICO S3: Falha ao enviar bytes do arquivo para o bunker.`);
          }
        });
      },
      error: (err) => {
        this.isUploadingS3 = false;
        this.addLog(`❌ ERRO DE PROTOCOLO: A API de gateway rejeitou a URL pré-assinada.`);
      }
    });
  }

  processarMaster(config: { estilo: string, intensidade: string, preview: boolean }) {
    if (!this.selectedFile || !this.s3Key) return;
    this.isProcessing = true;

    // 🚀 ROTA 1: SE FOR PREVIEW (Bypass de 6MB: Envia apenas a chave do S3 para gerar os 4 testes de 15s!) [1]
    if (config.preview) {
      this.addLog(`Iniciando renderização de lote de Previews (Batch). Perfil: ${config.estilo.toUpperCase()}`);

      const estilosDolby = ['thunder', 'clear_sky', 'sunroof', 'aurora'];
      const requisicoesHttp = estilosDolby.map(perfil => {
        const formData = new FormData();
        formData.append('s3Key', this.s3Key!);
        formData.append('estilo', perfil);
        formData.append('intensidade', config.intensidade);
        formData.append('preview', 'true');

        return this.dspService.masterizeTrack(formData);
      });

      forkJoin(requisicoesHttp).subscribe({
        next: (blobs: Blob[]) => {
          this.isProcessing = false;
          this.addLog(`Lote de Previews (4 Estilos) gerados com sucesso na AWS Lambda!`);

          this.previewsCache = {
            thunder: window.URL.createObjectURL(blobs[0]),
            clear_sky: window.URL.createObjectURL(blobs[1]),
            sunroof: window.URL.createObjectURL(blobs[2]),
            aurora: window.URL.createObjectURL(blobs[3])
          };

          this.processedAudioUrl = this.previewsCache[config.estilo];
          this.addLog(`Fita de reprodução conectada ao estilo selecionado: ${config.estilo.toUpperCase()}`);
        },
        error: (err) => {
          this.isProcessing = false;
          this.addLog(`❌ ERRO DE RENDERIZAÇÃO: Falha crítica na síntese paralela de previews.`);
        }
      });
    }
    // 🔥 ROTA 2: SE FOR MASTERIZAÇÃO FINAL (Bypass de 6MB via S3) [1.2.6]
    else {
      this.addLog(`Disparando Masterização Final Completa no S3. Perfil: ${config.estilo.toUpperCase()}`);

      const formData = new FormData();
      formData.append('s3Key', this.s3Key);
      formData.append('estilo', config.estilo);
      formData.append('intensidade', config.intensidade);
      formData.append('preview', 'false');

      this.dspService.masterizeTrackS3(formData).subscribe({
        next: (response: any) => {
          this.isProcessing = false;

          this.processedAudioUrl = response.downloadUrl;
          this.processedAudioName = response.fileName;

          const a = document.createElement('a');
          a.href = response.downloadUrl;
          a.download = response.fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          this.addLog(`Masterização finalizada com sucesso! Arquivo exportado: ${response.fileName}`);
        },
        error: (err) => {
          this.isProcessing = false;
          this.addLog(`❌ FALHA CRÍTICA: O limitador ou reator Python falharam na master final.`);
        }
      });
    }
  }

  trocarPerfil(novoEstilo: string) {
    if (this.previewsCache && this.previewsCache[novoEstilo]) {
      this.processedAudioUrl = this.previewsCache[novoEstilo];
      this.addLog(`Fita trocada instantaneamente via cache local para: ${novoEstilo.toUpperCase()}`);
    }
  }

  ejetarFaixa() {
    this.addLog('Limpando o deck do reprodutor e liberando memória RAM...');
    this.liberarMemoriaDeBlobs();

    this.selectedFile = null;
    this.processedAudioUrl = null;
    this.processedAudioName = '';
    this.s3Key = null;
    this.isProcessing = false;
    this.systemLogs = [];

    console.log('[ALFA CORE] Deck limpo.');
  }

  ngOnDestroy() {
    this.liberarMemoriaDeBlobs();
  }

  private liberarMemoriaDeBlobs() {
    if (this.processedAudioUrl) {
      window.URL.revokeObjectURL(this.processedAudioUrl);
    }
    Object.values(this.previewsCache).forEach(url => {
      if (url) {
        window.URL.revokeObjectURL(url);
      }
    });
    this.previewsCache = { thunder: '', clear_sky: '', sunroof: '', aurora: '' };
  }

  isExtractingStems = false;
  extrairStems() {
    if (!this.selectedFile) return;

    this.isExtractingStems = true;
    this.addLog(`Iniciando dissecação acústica de 6 canais (Demucs) para: ${this.selectedFile.name}`);

    this.dspService.extractStems(this.selectedFile).subscribe({
      next: (blob: Blob) => {
        this.isExtractingStems = false;
        this.addLog(`Divisão multi-pista concluída com sucesso! Compactando arquivos...`);

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const originalName = this.selectedFile!.name.replace(/\.[^/.]+$/, "");
        a.download = `RQS_6_STEMS_${originalName}.zip`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        this.addLog(`ZIP de 6 canais entregue com sucesso!`);
      },
      error: (err) => {
        this.isExtractingStems = false;
        this.addLog(`❌ ERRO DE DISSECAÇÃO: O motor Demucs excedeu os limites operacionais.`);
      }
    });
  }
}
