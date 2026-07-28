import { Component, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DspService } from '../../services/dsp';
import { EkgMonitorComponent } from '../ekg-monitor/ekg-monitor';
import { MasteringPanelComponent } from '../mastering-panel/mastering-panel';
import { forkJoin } from 'rxjs';

@Component({
  selector: 'app-upload-zone',
  standalone: true,
  imports: [CommonModule, EkgMonitorComponent, MasteringPanelComponent],
  templateUrl: './upload-zone.html',
  styleUrls: ['./upload-zone.scss']
})
export class UploadZoneComponent implements OnDestroy {
  isDragging = false;
  selectedFile: File | null = null;
  isProcessing = false;
  processedAudioUrl: string | null = null;
  processedAudioName: string = '';

  // 🟢 ESTADOS DO UPLOAD EM SEGUNDO PLANO S3 [1.2.6]
  s3Key: string | null = null;
  isUploadingS3 = false;

  previewsCache: { [key: string]: string } = {
    thunder: '',
    clear_sky: '',
    sunroof: '',
    aurora: ''
  };

  private dspService = inject(DspService);

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      const selected = input.files[0];
      const fileName = selected.name.toLowerCase();

      if (fileName.endsWith('.wav') || fileName.endsWith('.mp3')) {
        this.selectedFile = selected;
        this.processedAudioUrl = null;
        this.s3Key = null; // Reseta o cache S3 do arquivo anterior

        // 🟢 Dispara o upload em segundo plano imediatamente! [1.2.6]
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
      this.s3Key = null; // Reseta o cache S3 do arquivo anterior

      // 🟢 Dispara o upload em segundo plano imediatamente! [1.2.6]
      this.iniciarUploadS3Silencioso(this.selectedFile);
    }
  }

  // 🟢 MÉTODO DO EMISSOR DE UPLOAD EM BACKGROUND (Bypass total de 6MB) [1.2.6]
  iniciarUploadS3Silencioso(file: File) {
    this.isUploadingS3 = true;
    console.log(`[ALFA CORE] Iniciando upload em segundo plano para o S3: ${file.name}`);

    this.dspService.getPresignedUrl(file.name).subscribe({
      next: (s3Response) => {
        this.dspService.uploadToS3(s3Response.uploadUrl, file).subscribe({
          next: () => {
            this.isUploadingS3 = false;
            this.s3Key = s3Response.s3Key; // Salva a chave S3 na memória da aplicação
            console.log('[ALFA CORE] Upload silencioso de background completo! S3 Key:', this.s3Key);
          },
          error: (err) => {
            this.isUploadingS3 = false;
            console.error('[CRITICAL] Erro no upload em segundo plano para o S3', err);
          }
        });
      },
      error: (err) => {
        this.isUploadingS3 = false;
        console.error('[CRITICAL] Erro ao solicitar pre-signed URL', err);
      }
    });
  }

  processarMaster(config: { estilo: string, intensidade: string, preview: boolean }) {
    if (!this.selectedFile || !this.s3Key) return; // Trava física se o upload em background ainda não terminou
    this.isProcessing = true;

    // 🚀 ROTA 1: SE FOR PREVIEW (Bypass de 6MB: Envia apenas a chave do S3 para gerar os 4 testes de 15s!) [1]
    if (config.preview) {
      console.log('[ALFA CORE] Iniciando processamento em lote (Batch) via S3...');

      const estilosDolby = ['thunder', 'clear_sky', 'sunroof', 'aurora'];
      const requisicoesHttp = estilosDolby.map(perfil => {
        const formData = new FormData();
        formData.append('s3Key', this.s3Key!); // 🟢 CORREÇÃO: Envia apenas a chave do S3 em formato de texto leve! [1]
        formData.append('estilo', perfil);
        formData.append('intensidade', config.intensidade);
        formData.append('preview', 'true');

        // Retorna o áudio binário direto (O preview de 15s pesa ~1.3MB, totalmente abaixo do limite de 6MB da AWS) [1, 1.1.2]
        return this.dspService.masterizeTrack(formData);
      });

      forkJoin(requisicoesHttp).subscribe({
        next: (blobs: Blob[]) => {
          this.isProcessing = false;
          console.log('[ALFA CORE] Matriz de Previews renderizada com sucesso!');

          this.previewsCache = {
            thunder: window.URL.createObjectURL(blobs[0]),
            clear_sky: window.URL.createObjectURL(blobs[1]),
            sunroof: window.URL.createObjectURL(blobs[2]),
            aurora: window.URL.createObjectURL(blobs[3])
          };

          this.processedAudioUrl = this.previewsCache[config.estilo];
        },
        error: (err) => {
          this.isProcessing = false;
          console.error('[CRITICAL] Falha no multithreading de S3 Previews', err);
        }
      });
    }
    // 🔥 ROTA 2: SE FOR MASTERIZAÇÃO FINAL (Bypass de 6MB via S3) [1.2.6]
    else {
      console.log(`[ALFA CORE] Iniciando processamento final via S3. Perfil: ${config.estilo.toUpperCase()}`);

      const formData = new FormData();
      formData.append('s3Key', this.s3Key); // Envia apenas a chave em formato texto leve [1]
      formData.append('estilo', config.estilo);
      formData.append('intensidade', config.intensidade);
      formData.append('preview', 'false');

      this.dspService.masterizeTrackS3(formData).subscribe({
        next: (response: any) => {
          this.isProcessing = false;

          // Salva a URL do S3 para o reprodutor nativo tocar na tela
          this.processedAudioUrl = response.downloadUrl;
          this.processedAudioName = response.fileName;

          // Cria um elemento âncora dinâmico para forçar o download direto do S3 [1.2.6]
          const a = document.createElement('a');
          a.href = response.downloadUrl;
          a.download = response.fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          console.log('[ALFA CORE] Master finalizada e baixada com sucesso direto do S3!');
        },
        error: (err) => {
          this.isProcessing = false;
          console.error('[CRITICAL] Falha na masterização final S3', err);
        }
      });
    }
  }

  trocarPerfil(novoEstilo: string) {
    if (this.previewsCache && this.previewsCache[novoEstilo]) {
      this.processedAudioUrl = this.previewsCache[novoEstilo];
      console.log(`[ALFA CORE] Fita trocada instantaneamente para: ${novoEstilo.toUpperCase()}`);
    }
  }

  ejetarFaixa() {
    console.log('[ALFA CORE] Ejetando artefato e limpando a RAM do deck...');
    this.liberarMemoriaDeBlobs();

    this.selectedFile = null;
    this.processedAudioUrl = null;
    this.processedAudioName = '';
    this.s3Key = null; // Reseta a chave
    this.isProcessing = false;

    console.log('[ALFA CORE] Deck limpo e aguardando nova carga.');
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
    console.log(`[STEM CORE] Iniciando dissecação de áudio para: ${this.selectedFile.name}`);

    this.dspService.extractStems(this.selectedFile).subscribe({
      next: (blob: Blob) => {
        this.isExtractingStems = false;

        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const originalName = this.selectedFile!.name.replace(/\.[^/.]+$/, "");
        a.download = `RQS_6_STEMS_${originalName}.zip`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        console.log('[STEM CORE] Payload zipado entregue com sucesso!');
      },
      error: (err) => {
        this.isExtractingStems = false;
        console.error('[CRITICAL] Falha na extração de stems. O reator superaqueceu:', err);
      }
    });
  }
}
