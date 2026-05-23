import { Component, inject } from '@angular/core';
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
export class UploadZoneComponent {
// 📂 Protocolo de Captura por Clique
  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;

    if (input.files && input.files.length > 0) {
      const selected = input.files[0];
      const fileName = selected.name.toLowerCase();

      // 🛡️ Filtro estrito de formato de áudio
      if (fileName.endsWith('.wav') || fileName.endsWith('.mp3')) {
        this.selectedFile = selected;

        // Limpa qualquer masterização anterior caso o usuário troque a track
        this.processedAudioUrl = null;

        console.log(`[ALFA CORE] Track engatada via File Picker: ${this.selectedFile.name}`);
      } else {
        console.error('[BLOCK] Formato incompatível. Insira espectros puros (.wav ou .mp3).');
      }

      // Reseta o input para permitir selecionar o mesmo arquivo duas vezes, se necessário
      input.value = '';
    }
  }
  isDragging = false;
  selectedFile: File | null = null;

  // 🛡️ Novos Estados da Interface
  isProcessing = false;
  // 🛡️ O novo barramento de memória para o processamento em Lote
  processedAudioUrl: string | null = null; // Mantemos para a master final
  processedAudioName: string = '';

  // O Cache de Previews (Armazena as 4 versões de 30 segundos)
  previewsCache: { [key: string]: string } = {
    thunder: '',
    clear_sky: '',
    sunroof: '',
    aurora: ''
  };

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

    this.dspService.processMastering(this.selectedFile, estilo).subscribe({
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
        formData.append('estilo', perfil); // Injeta um perfil diferente para cada request
        formData.append('intensidade', config.intensidade);
        formData.append('preview', 'true');

        return this.dspService.masterizeTrack(formData);
      });

      // O forkJoin dispara os 4 e "congela" até todos terminarem
      forkJoin(requisicoesHttp).subscribe({
        next: (blobs: Blob[]) => {
          this.isProcessing = false;
          console.log('[ALFA CORE] Matriz de Previews renderizada com sucesso!');

          // Salva os 4 arquivos temporários na RAM do navegador
          this.previewsCache = {
            thunder: window.URL.createObjectURL(blobs[0]),
            clear_sky: window.URL.createObjectURL(blobs[1]),
            sunroof: window.URL.createObjectURL(blobs[2]),
            aurora: window.URL.createObjectURL(blobs[3])
          };

          // Define o áudio que vai tocar primeiro como o estilo que a General escolheu na tela
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
      console.log(`[ALFA CORE] Renderizando Master Definitiva. Perfil: ${config.estilo.toUpperCase()}`);

      const formData = new FormData();
      formData.append('audio', this.selectedFile);
      formData.append('estilo', config.estilo);
      formData.append('intensidade', config.intensidade);
      formData.append('preview', 'false');

      this.dspService.masterizeTrack(formData).subscribe({
        next: (blob: Blob) => {
          this.isProcessing = false;
          this.processedAudioUrl = window.URL.createObjectURL(blob);
          this.processedAudioName = `RQS_MASTER_${config.estilo.toUpperCase()}.wav`;
        },
        error: (err) => {
          this.isProcessing = false;
          console.error('[CRITICAL] Falha na masterização final', err);
        }
      });
    }
  }
  trocarPerfil(novoEstilo: string) {
    // Se as 4 músicas já estiverem carregadas na RAM, nós apenas trocamos o cabo do Player!
    if (this.previewsCache && this.previewsCache[novoEstilo]) {
      this.processedAudioUrl = this.previewsCache[novoEstilo];
      console.log(`[ALFA CORE] Fita trocada instantaneamente para: ${novoEstilo.toUpperCase()}`);
    }
  }
  // ⏏️ Protocolo de Ejeção de Fita (Limpeza de RAM)
  ejetarFaixa() {
    console.log('[ALFA CORE] Ejetando artefato e limpando a RAM do deck...');

    // Revoga a URL do Blob antigo para não causar vazamento de memória (Memory Leak) no navegador
    if (this.processedAudioUrl) {
      window.URL.revokeObjectURL(this.processedAudioUrl);
    }
    // Zera os ponteiros de estado
    this.selectedFile = null;
    this.processedAudioUrl = null;
    this.processedAudioName = '';
    this.isProcessing = false;

    console.log('[ALFA CORE] Deck limpo e aguardando nova carga.');
  }

  // 🛡️ Novo Estado da Interface para o Demucs
  isExtractingStems = false;

  // 🧬 Protocolo de Dissecação de Matriz
  extrairStems() {
    if (!this.selectedFile) return;

    // Trava a interface
    this.isExtractingStems = true;
    console.log(`[STEM CORE] Iniciando dissecação de áudio para: ${this.selectedFile.name}`);

    this.dspService.extractStems(this.selectedFile).subscribe({
      next: (blob: Blob) => {
        this.isExtractingStems = false;

        // 🎯 O "Truque" do Arquiteto: Força o download do ZIP invisivelmente
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        // Limpa o nome original e adiciona a tag RQS
        const originalName = this.selectedFile!.name.replace('.wav', '').replace('.mp3', '');
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

