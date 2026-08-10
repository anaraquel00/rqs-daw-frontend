import { AfterViewChecked, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DspService } from '../../services/dsp';
import { EkgMonitorComponent } from '../ekg-monitor/ekg-monitor';
import { MasteringPanelComponent } from '../mastering-panel/mastering-panel';
import { LanguageService } from '../../services/language.service';
import { AuthService } from '../../services/auth.service';
import { AudioComparisonService } from '../../services/audio-comparison.service';
import { MasteringProcessCommand, MasteringV2Request } from '../../services/mastering-types';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-upload-zone',
  standalone: true,
  imports: [CommonModule, EkgMonitorComponent, MasteringPanelComponent],
  templateUrl: './upload-zone.html',
  styleUrls: ['./upload-zone.scss'],
})
export class UploadZoneComponent implements OnDestroy, AfterViewChecked {
  @ViewChild('terminalBody') private terminalScrollContainer?: ElementRef<HTMLElement>;

  isFullMasterCompleted = false;
  readonly lang = inject(LanguageService);
  readonly auth = inject(AuthService);
  readonly audioComparison = inject(AudioComparisonService);
  readonly masteringV2DirectUpload = environment.masteringV2DirectUpload;
  private readonly dspService = inject(DspService);

  isDragging = false;
  selectedFile: File | null = null;
  isProcessing = false;
  processedAudioUrl: string | null = null;
  processedAudioName = '';
  systemLogs: string[] = [];
  s3Key: string | null = null;
  isUploadingS3 = false;
  isExtractingStems = false;

  ngAfterViewChecked(): void {
    const element = this.terminalScrollContainer?.nativeElement;
    if (element) element.scrollTop = element.scrollHeight;
  }

  addLog(message: string): void {
    const time = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    const logEntry = `[${time}] ${message}`;
    this.systemLogs.push(logEntry);
    console.log(`[RQS CORE] ${logEntry}`);
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const selected = input.files?.[0] ?? null;

    if (selected) this.acceptSelectedFile(selected);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    const selected = event.dataTransfer?.files?.[0] ?? null;
    if (selected) this.acceptSelectedFile(selected);
  }

  iniciarUploadS3Silencioso(file: File): void {
    this.isUploadingS3 = true;
    this.addLog(`Iniciando handshake S3 para: ${file.name}`);

    this.dspService.getPresignedUrl(file.name).subscribe({
      next: (s3Response) => {
        this.addLog('URL pré-assinada concedida pelo S3. Iniciando upload em background...');
        this.dspService.uploadToS3(s3Response.uploadUrl, file).subscribe({
          next: () => {
            this.isUploadingS3 = false;
            this.s3Key = s3Response.s3Key;
            this.addLog(`Upload concluído! Arquivo persistido em: ${s3Response.s3Key}`);
          },
          error: () => {
            this.isUploadingS3 = false;
            this.addLog('❌ ERRO CRÍTICO S3: Falha ao enviar bytes do arquivo para o bunker.');
          },
        });
      },
      error: () => {
        this.isUploadingS3 = false;
        this.addLog('❌ ERRO DE PROTOCOLO: A API de gateway rejeitou a URL pré-assinada.');
      },
    });
  }

  processarMaster(command: MasteringProcessCommand): void {
    if (!this.selectedFile) return;
    if (!this.masteringV2DirectUpload && !this.s3Key) return;

    if (!command.preview && !this.auth.canMaster()) {
      alert(this.lang.t().LIMIT_EXCEEDED_ALERT);
      return;
    }

    this.isProcessing = true;
    const formData = this.buildMasteringV2FormData(command.request, command.preview);

    if (command.preview) {
      this.addLog(
        `Mastering V2 preview: ${this.describeRequest(command.request)} | ${command.request.intensityPercent}%`,
      );
      this.dspService.masterizeV2Preview(formData).subscribe({
        next: (blob) => {
          this.isProcessing = false;
          this.releaseProcessedBlobUrl();
          this.processedAudioUrl = window.URL.createObjectURL(blob);
          this.processedAudioName = 'rqs_v2_preview.wav';
          this.isFullMasterCompleted = false;
          this.audioComparison.previewStatus.set('ready');
          this.addLog('Mastering V2 preview concluído com sucesso.');
        },
        error: (error: unknown) => {
          this.isProcessing = false;
          this.audioComparison.previewStatus.set('error');
          this.addLog(`❌ MASTERING V2 PREVIEW ERROR: ${this.errorMessage(error)}`);
        },
      });
      return;
    }

    this.addLog(`Mastering V2 final: ${this.describeRequest(command.request)} | ${command.request.intensityPercent}%`);
    this.dspService.masterizeV2Final(formData).subscribe({
      next: (response) => {
        this.isProcessing = false;
        this.auth.registrarNovaMaster();
        this.releaseProcessedBlobUrl();
        this.processedAudioUrl = response.downloadUrl;
        this.processedAudioName = response.fileName;
        this.isFullMasterCompleted = true;
        this.audioComparison.audioProcessed.set(true);
        this.audioComparison.processedFilename.set(response.fileName);
        this.addLog(`Mastering V2 finalizado: ${response.fileName}`);
      },
      error: (error: unknown) => {
        this.isProcessing = false;
        this.addLog(`❌ MASTERING V2 FINAL ERROR: ${this.errorMessage(error)}`);
      },
    });
  }

  invalidateMasteringResult(): void {
    if (this.isProcessing) return;
    this.releaseProcessedBlobUrl();
    this.processedAudioUrl = null;
    this.processedAudioName = '';
    this.isFullMasterCompleted = false;
    this.audioComparison.previewStatus.set('not-generated');
    this.audioComparison.audioProcessed.set(false);
  }

  ejetarFaixa(): void {
    this.releaseProcessedBlobUrl();
    this.selectedFile = null;
    this.processedAudioUrl = null;
    this.processedAudioName = '';
    this.s3Key = null;
    this.isProcessing = false;
    this.systemLogs = [];
    this.isFullMasterCompleted = false;
    this.audioComparison.resetAll();
  }

  extrairStems(): void {
    if (!this.selectedFile || !this.s3Key) return;

    this.isExtractingStems = true;
    this.addLog(`Iniciando dissecação acústica de 6 canais (Demucs) via S3 para: ${this.selectedFile.name}`);

    this.dspService.extractStemsS3(this.s3Key).subscribe({
      next: (response) => {
        this.isExtractingStems = false;
        const a = document.createElement('a');
        a.href = response.downloadUrl;
        const originalName = this.selectedFile?.name.replace(/\.[^/.]+$/, '') ?? 'RQS_Track';
        a.download = `RQS_6_STEMS_${originalName}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        this.addLog('ZIP de 6 canais entregue com sucesso!');
      },
      error: () => {
        this.isExtractingStems = false;
        this.addLog('❌ ERRO DE DISSECAÇÃO: O motor Demucs excedeu os limites operacionais.');
      },
    });
  }

  ngOnDestroy(): void {
    this.releaseProcessedBlobUrl();
  }

  private acceptSelectedFile(file: File): void {
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.wav') && !fileName.endsWith('.mp3')) {
      this.addLog('❌ Formato incompatível. Use WAV ou MP3.');
      return;
    }

    this.releaseProcessedBlobUrl();
    this.selectedFile = file;
    this.processedAudioUrl = null;
    this.processedAudioName = '';
    this.s3Key = null;
    this.isProcessing = false;
    this.isFullMasterCompleted = false;
    this.systemLogs = [];
    this.addLog(`Track engatada: ${file.name}`);

    if (this.masteringV2DirectUpload) {
      this.isUploadingS3 = false;
      this.addLog('Modo local Mastering V2: upload direto ao backend, sem S3.');
      return;
    }

    this.iniciarUploadS3Silencioso(file);
  }

  private buildMasteringV2FormData(request: MasteringV2Request, preview: boolean): FormData {
    const formData = new FormData();

    if (this.masteringV2DirectUpload && this.selectedFile) {
      formData.append('audio', this.selectedFile, this.selectedFile.name);
    } else {
      formData.append('s3Key', this.s3Key ?? '');
    }

    formData.append('destination', request.destination);
    if (request.platform) formData.append('platform', request.platform);
    formData.append('atmosphere', request.atmosphere);
    formData.append('intensity_percent', String(request.intensityPercent));
    formData.append('soundcloud_mode', request.soundcloudMode);
    if (request.requestedLufs !== null) formData.append('requested_lufs', String(request.requestedLufs));
    formData.append('preview', preview ? 'true' : 'false');
    return formData;
  }

  private describeRequest(request: MasteringV2Request): string {
    const delivery = request.destination === 'streaming' ? `${request.destination}/${request.platform}` : request.destination;
    const soundCloud = request.platform === 'soundcloud' ? `/${request.soundcloudMode}` : '';
    const lufs = request.requestedLufs === null ? 'policy-LUFS' : `${request.requestedLufs} LUFS`;
    return `${delivery}${soundCloud} | ${request.atmosphere} | ${lufs}`;
  }

  private releaseProcessedBlobUrl(): void {
    if (this.processedAudioUrl?.startsWith('blob:')) {
      window.URL.revokeObjectURL(this.processedAudioUrl);
    }
  }

  private errorMessage(error: unknown): string {
    if (typeof error === 'object' && error !== null && 'message' in error) {
      return String((error as { message: unknown }).message);
    }
    return 'unknown error';
  }
}
