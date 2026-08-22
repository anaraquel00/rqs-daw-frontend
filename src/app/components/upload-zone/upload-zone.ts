import { AfterViewChecked, Component, ElementRef, OnDestroy, ViewChild, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DspService } from '../../services/dsp';
import { EkgMonitorComponent } from '../ekg-monitor/ekg-monitor';
import { MasteringPanelComponent } from '../mastering-panel/mastering-panel';
import { LanguageService } from '../../services/language.service';
import { AuthService } from '../../services/auth.service';
import { AudioComparisonService } from '../../services/audio-comparison.service';
import { MasteringProcessCommand, MasteringV2Request } from '../../services/mastering-types';
import { MasteringService } from '../../services/mastering.service';
import { environment } from '../../../environments/environment';
import { AnalyticsService } from '../../services/analytics.service';

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
  private readonly masteringService = inject(MasteringService);
  private readonly analytics = inject(AnalyticsService);

  isDragging = false;
  selectedFile: File | null = null;
  isProcessing = false;
  processedAudioUrl: string | null = null;
  processedAudioName = '';
  systemLogs: string[] = [];
  s3Key: string | null = null;
  isUploadingS3 = false;
  isExtractingStems = false;
  renderProgressPercent = 0;
  private renderProgressPreview = false;
  private renderProgressStartedAt = 0;
  private renderProgressTimer: ReturnType<typeof setInterval> | undefined;
  private readonly authenticatedUploadEffect = effect(() => {
    if (
      this.auth.isLoggedIn()
      && this.selectedFile
      && !this.masteringV2DirectUpload
      && !this.s3Key
      && !this.isUploadingS3
    ) {
      this.iniciarUploadS3Silencioso(this.selectedFile);
    }
  });

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
    if (!this.auth.isLoggedIn()) {
      this.auth.requestSignIn('mastering');
      return;
    }

    this.isUploadingS3 = true;
    this.addLog(`Iniciando handshake S3 para: ${file.name}`);

    this.dspService.getMasteringV2PresignedUrl(file.name).subscribe({
      next: (s3Response) => {
        this.addLog('URL pré-assinada concedida pelo S3. Iniciando upload em background...');
        this.dspService.uploadToS3(s3Response.uploadUrl, file).subscribe({
          next: () => {
            this.isUploadingS3 = false;
            this.s3Key = s3Response.s3Key;
            this.addLog(`Upload concluído! Arquivo persistido em: ${s3Response.s3Key}`);
          },
          error: (error: unknown) => {
            this.isUploadingS3 = false;
            this.addLog(`❌ ERRO CRÍTICO S3: ${this.errorMessage(error)}`);
          },
        });
      },
      error: (error: unknown) => {
        this.isUploadingS3 = false;
        this.addLog(`❌ ERRO DE PROTOCOLO S3: ${this.errorMessage(error)}`);
      },
    });
  }

  processarMaster(command: MasteringProcessCommand): void {
    if (this.isProcessing || !this.selectedFile) return;
    if (!this.auth.isLoggedIn()) {
      this.auth.requestSignIn('mastering');
      return;
    }
    if (!this.masteringV2DirectUpload && !this.s3Key) {
      this.addLog('❌ MASTERING V2: source upload is not ready yet.');
      return;
    }

    if (!command.preview && !this.auth.canMaster()) {
      alert(this.lang.t().LIMIT_EXCEEDED_ALERT);
      return;
    }

    this.analytics.trackEvent('master_started', {
      source_format: this.analyticsSourceFormat(),
      processing_mode: command.preview ? 'preview' : 'full'
    });

    this.isProcessing = true;
    this.startEstimatedRenderProgress(command.preview);
    const formData = this.buildMasteringV2FormData(
      command.request,
      command.preview,
      command.previewStartSeconds,
    );

    if (command.preview) {
      this.addLog(
        `Mastering V2 preview: ${this.describeRequest(command.request)} | ${command.request.intensityPercent}%`,
      );
      this.dspService.masterizeV2Preview(formData).subscribe({
        next: (blob) => {
          this.completeRenderProgress();
          this.isProcessing = false;
          this.releaseProcessedBlobUrl();
          this.processedAudioUrl = window.URL.createObjectURL(blob);
          this.processedAudioName = 'rqs_v2_preview.wav';
          this.isFullMasterCompleted = false;
          this.audioComparison.previewStatus.set('ready');
          this.analytics.trackEvent('master_completed', {
            source_format: this.analyticsSourceFormat(),
            processing_mode: 'preview'
          });
          this.addLog('Mastering V2 preview concluído com sucesso.');
        },
        error: (error: unknown) => {
          this.stopEstimatedRenderProgress();
          this.isProcessing = false;
          this.audioComparison.previewStatus.set('error');
          this.analytics.trackEvent('master_failed', {
            source_format: this.analyticsSourceFormat(),
            processing_mode: 'preview'
          });
          this.addLog(`❌ MASTERING V2 PREVIEW ERROR: ${this.errorMessage(error)}`);
        },
      });
      return;
    }

    this.addLog(`Mastering V2 final: ${this.describeRequest(command.request)} | ${command.request.intensityPercent}%`);
    this.dspService.masterizeV2Final(formData).subscribe({
      next: (response) => {
        this.completeRenderProgress();
        this.isProcessing = false;
        void this.auth.refreshProfile();
        this.releaseProcessedBlobUrl();
        this.processedAudioUrl = response.downloadUrl;
        this.processedAudioName = response.fileName;
        this.isFullMasterCompleted = true;
        this.audioComparison.audioProcessed.set(true);
        this.audioComparison.processedFilename.set(response.fileName);
        this.analytics.trackEvent('master_completed', {
          source_format: this.analyticsSourceFormat(),
          processing_mode: 'full'
        });
        this.addLog(`Mastering V2 finalizado: ${response.fileName}`);
      },
      error: (error: unknown) => {
        this.stopEstimatedRenderProgress();
        this.isProcessing = false;
        this.analytics.trackEvent('master_failed', {
          source_format: this.analyticsSourceFormat(),
          processing_mode: 'full'
        });
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
    this.audioComparison.clearMasterSrc();
    this.audioComparison.audioProcessed.set(false);
    this.audioComparison.processedFilename.set('');
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
    this.masteringService.resetPreviewStartSeconds();
    this.stopEstimatedRenderProgress();
    this.audioComparison.resetAll();
    this.audioComparison.audioProcessed.set(false);
    this.audioComparison.processedFilename.set('');
  }

  extrairStems(): void {
    if (!this.selectedFile || !this.s3Key) return;

    this.analytics.trackEvent('stem_started', {
      source_format: this.analyticsSourceFormat()
    });
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
        this.analytics.trackEvent('stem_completed', {
          source_format: this.analyticsSourceFormat()
        });
        this.addLog('ZIP de 6 canais entregue com sucesso!');
      },
      error: (error: unknown) => {
        this.isExtractingStems = false;
        this.analytics.trackEvent('stem_failed', {
          source_format: this.analyticsSourceFormat()
        });
        this.addLog(`❌ ERRO DE DISSECAÇÃO: ${this.errorMessage(error)}`);
      },
    });
  }

  ngOnDestroy(): void {
    this.stopEstimatedRenderProgress();
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
    this.masteringService.resetPreviewStartSeconds();
    this.audioComparison.audioProcessed.set(false);
    this.audioComparison.processedFilename.set('');
    this.addLog(`Track engatada: ${file.name}`);

    if (this.masteringV2DirectUpload) {
      this.isUploadingS3 = false;
      this.addLog('Modo local Mastering V2: upload direto ao backend, sem S3.');
      return;
    }

    if (this.auth.isLoggedIn()) {
      this.iniciarUploadS3Silencioso(file);
    }
  }

  private buildMasteringV2FormData(
    request: MasteringV2Request,
    preview: boolean,
    previewStartSeconds?: number,
  ): FormData {
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
    if (preview && previewStartSeconds !== undefined && Number.isFinite(previewStartSeconds)) {
      formData.append('preview_start_seconds', String(Math.max(0, previewStartSeconds)));
    }
    formData.append('preview', preview ? 'true' : 'false');
    return formData;
  }

  renderProgressStatus(): string {
    const language = this.lang.currentLang();
    const phase = this.renderProgressPhaseText();
    if (language === 'pl') return `SZAC. ${this.renderProgressPercent}% · ${phase}`;
    if (language === 'pt') return `EST. ${this.renderProgressPercent}% · ${phase}`;
    return `EST. ${this.renderProgressPercent}% · ${phase}`;
  }

  private startEstimatedRenderProgress(preview: boolean): void {
    this.stopEstimatedRenderProgress();
    this.renderProgressPreview = preview;
    this.renderProgressStartedAt = Date.now();
    this.renderProgressPercent = 5;
    this.renderProgressTimer = setInterval(() => {
      const elapsedSeconds = Math.max(0, (Date.now() - this.renderProgressStartedAt) / 1000);
      const cap = preview ? 90 : 92;
      const timeConstant = preview ? 6 : 75;
      const estimate = Math.floor(5 + (cap - 5) * (1 - Math.exp(-elapsedSeconds / timeConstant)));
      this.renderProgressPercent = Math.max(this.renderProgressPercent, Math.min(cap, estimate));
    }, 1000);
  }

  private completeRenderProgress(): void {
    this.stopEstimatedRenderProgress(false);
    this.renderProgressPercent = 100;
  }

  private stopEstimatedRenderProgress(reset = true): void {
    if (this.renderProgressTimer !== undefined) {
      clearInterval(this.renderProgressTimer);
      this.renderProgressTimer = undefined;
    }
    if (reset) this.renderProgressPercent = 0;
  }

  private renderProgressPhaseText(): string {
    const language = this.lang.currentLang();
    const percent = this.renderProgressPercent;
    const preview = this.renderProgressPreview;

    if (language === 'pl') {
      if (percent < 15) return preview ? 'Przygotowanie fragmentu Preview' : 'Przygotowanie pełnego utworu';
      if (percent < 35) return 'Analiza i przygotowanie audio';
      if (percent < 78) return 'Przetwarzanie DSP';
      if (percent < 90) return 'Finalizacja LUFS / True Peak';
      return 'Kodowanie i finalizacja pliku';
    }
    if (language === 'pt') {
      if (percent < 15) return preview ? 'Preparando o trecho da prévia' : 'Preparando a faixa completa';
      if (percent < 35) return 'Analisando e preparando o áudio';
      if (percent < 78) return 'Processamento DSP';
      if (percent < 90) return 'Finalizando LUFS / True Peak';
      return 'Codificando e finalizando o arquivo';
    }
    if (percent < 15) return preview ? 'Preparing the Preview segment' : 'Preparing the full track';
    if (percent < 35) return 'Analyzing and preparing audio';
    if (percent < 78) return 'DSP processing';
    if (percent < 90) return 'LUFS / True Peak finalization';
    return 'Encoding and finalizing the file';
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

  private analyticsSourceFormat(): 'wav' | 'mp3' | 'unknown' {
    const name = this.selectedFile?.name.toLowerCase() || '';
    if (name.endsWith('.wav')) return 'wav';
    if (name.endsWith('.mp3')) return 'mp3';
    return 'unknown';
  }

  private errorMessage(error: unknown): string {
    if (typeof error !== 'object' || error === null) return 'unknown error';

    const candidate = error as {
      message?: unknown;
      error?: unknown;
    };

    if (typeof candidate.error === 'string' && candidate.error.trim()) {
      return candidate.error.trim();
    }

    if (typeof candidate.error === 'object' && candidate.error !== null) {
      const payload = candidate.error as { details?: unknown; error?: unknown; message?: unknown };
      for (const value of [payload.details, payload.error, payload.message]) {
        if (typeof value === 'string' && value.trim()) return value.trim();
      }
    }

    if (typeof candidate.message === 'string' && candidate.message.trim()) {
      return candidate.message.trim();
    }

    return 'unknown error';
  }
}
