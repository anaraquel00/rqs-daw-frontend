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
        console.log(`[ALFA CORE] Track engatada via File Picker: ${this.selectedFile.name}`);
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
      console.log('📦 [FRONT-END] Arquivo ancorado:', this.selectedFile.name);
    }
  }

  // 🟢 CORREÇÃO: Suporta o envio dinâmico da intensidade no fluxo síncrono [1]
  processar(estilo: string, intensidade: string = 'media') {
    if (!this.selectedFile) return;

    this.isProcessing = true;
    this.processedAudioUrl = null;

    console.log(`🚀 [IGNIÇÃO] Enviando para RQS API. Estilo: ${estilo} | Intensidade: ${intensidade}`);

    this.dspService.processMastering(this.selectedFile, estilo, intensidade).subscribe({
      next: (response: Blob) => {
        this.isProcessing = false;
        this.processedAudioUrl = window.URL.createObjectURL(response);
        const originalName = this.selectedFile!.name.replace(/\.[^/.]+$/, "");
        this.processedAudioName = `RQS_MASTER_${estilo.toUpperCase()}_${originalName}.wav`;

        console.log('✅ [SUCESSO] Pacote ancorado. Aguardando extração manual.');
      },
      error: (err) => {
        this.isProcessing = false;
        console.error('⚠️ [ERRO DE PROTOCOLO] O reator Python rejeitou a carga:', err);
      }
    });
  }

  processarMaster(config: { estilo: string, intensidade: string, preview: boolean }) {
    if (!this.selectedFile) return;
    this.isProcessing = true;

    // 🚀 ROTA 1: SE FOR PREVIEW (GERA OS 4 ESTILOS AO MESMO TEMPO)
    if (config.preview) {
      console.log('[ALFA CORE] Iniciando processamento em lote (Batch)...');

      const estilosDolby = ['thunder', 'clear_sky', 'sunroof', 'aurora'];
      const requisicoesHttp = estilosDolby.map(perfil => {
        const formData = new FormData();
        formData.append('audio', this.selectedFile!);
        formData.append('estilo', perfil);
        formData.append('intensidade', config.intensidade);
        formData.append('preview', 'true');

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
          console.error('[CRITICAL] Falha no multithreading de DSP', err);
        }
      });
    }
    // 🔥 ROTA 2: SE FOR MASTERIZAÇÃO FINAL (Processa apenas a faixa inteira escolhida)
    else {
      console.log(`[ALFA CORE] Renderizando Master Definitiva. Perfil: ${config.estilo.toUpperCase()} | Intensidade: ${config.intensidade.toUpperCase()}`);

      const formData = new FormData();
      formData.append('audio', this.selectedFile);
      formData.append('estilo', config.estilo);
      formData.append('intensidade', config.intensidade);
      formData.append('preview', 'false');

      this.dspService.masterizeTrack(formData).subscribe({
        next: (blob: Blob) => {
          this.isProcessing = false;
          this.processedAudioUrl = window.URL.createObjectURL(blob);

          const originalName = this.selectedFile!.name.replace(/\.[^/.]+$/, "");
          this.processedAudioName = `RQS_MASTER_${config.estilo.toUpperCase()}_${originalName}.wav`;
        },
        error: (err) => {
          this.isProcessing = false;
          console.error('[CRITICAL] Falha na masterização final', err);
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
