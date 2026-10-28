import { AfterViewChecked, Component, DestroyRef, ElementRef, OnDestroy, OnInit, ViewChild, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DspService } from '../../services/dsp';
import { EkgMonitorComponent } from '../ekg-monitor/ekg-monitor';
import { MasteringPanelComponent } from '../mastering-panel/mastering-panel';
import { LanguageService } from '../../services/language.service';
import { AuthService } from '../../services/auth.service';
import { AudioComparisonService } from '../../services/audio-comparison.service';
import {
  AudioDnaPayload,
  AudioIntelligenceV2Payload,
  ArtistConfirmedSound,
  AudioIntelligenceFlowStage,
  MasteringAnalysisState,
  MasteringProcessCommand,
  MasteringV2Analysis,
  MasteringV2Request,
  OpenAiMusicAnalystPayload,
  SpotifyPitchResponse,
} from '../../services/mastering-types';
import { MasteringService } from '../../services/mastering.service';
import { environment } from '../../../environments/environment';
import { AnalyticsService } from '../../services/analytics.service';

type MasteringFeedback = 'invalid_format' | 'upload_failed' | 'source_preparing' | 'preview_failed' | 'full_failed';

@Component({
  selector: 'app-upload-zone',
  standalone: true,
  imports: [CommonModule, EkgMonitorComponent, MasteringPanelComponent],
  templateUrl: './upload-zone.html',
  styleUrls: ['./upload-zone.scss'],
})
export class UploadZoneComponent implements OnDestroy, OnInit, AfterViewChecked {
  @ViewChild('terminalBody') private terminalScrollContainer?: ElementRef<HTMLElement>;

  isFullMasterCompleted = false;
  readonly lang = inject(LanguageService);
  readonly auth = inject(AuthService);
  readonly audioComparison = inject(AudioComparisonService);
  readonly masteringV2DirectUpload = environment.masteringV2DirectUpload;
  private readonly dspService = inject(DspService);
  private readonly masteringService = inject(MasteringService);
  private readonly analytics = inject(AnalyticsService);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly destroyRef = inject(DestroyRef);

  isDragging = false;
  selectedFile: File | null = null;
  isProcessing = false;
  processedAudioUrl: string | null = null;
  processedAudioName = '';
  systemLogs: string[] = [];
  s3Key: string | null = null;
  isUploadingS3 = false;
  processingMode: 'preview' | 'full' | null = null;
  readonly masteringFeedback = signal<MasteringFeedback | null>(null);
  readonly analysisState = signal<MasteringAnalysisState>('empty');
  readonly analysisMetrics = signal<MasteringV2Analysis | null>(null);
  audioDna: AudioDnaPayload | null = null;
  audioIntelligence: AudioIntelligenceV2Payload | null = null;
  openAiMusicAnalyst: OpenAiMusicAnalystPayload | null = null;
  audioSourceId: string | null = null;
  analysisId: string | null = null;
  persistedArtistConfirmation: ArtistConfirmedSound | null = null;
  persistedFlowStage: AudioIntelligenceFlowStage | null = null;
  persistedConfirmedAt: string | null = null;
  persistedPitchResult: SpotifyPitchResponse | null = null;
  readonly analysisRestored = signal(false);
  renderProgressPercent = 0;
  private renderProgressPreview = false;
  private renderProgressStartedAt = 0;
  private renderProgressTimer: ReturnType<typeof setInterval> | undefined;
  private previousUserId = this.auth.session()?.user.id ?? null;
  private workspaceGeneration = 0;
  private analysisRequestedGeneration: number | null = null;
  private analysisRequestId: string | null = null;
  private rehydratingAnalysisId: string | null = null;
  private readonly authenticatedUploadEffect = effect(() => {
    const isAuthenticated = this.auth.isLoggedIn();
    const userId = this.auth.session()?.user.id ?? null;

    if (this.previousUserId !== null && userId !== this.previousUserId) {
      this.ejetarFaixa();
    }
    this.previousUserId = userId;

    if (!isAuthenticated) return;

    this.restorePersistedAnalysisIfPresent();

    if (this.selectedFile && this.masteringV2DirectUpload) {
      this.requestSourceAnalysis(this.selectedFile, this.workspaceGeneration);
    }

    if (
      isAuthenticated
      && this.selectedFile
      && !this.masteringV2DirectUpload
      && !this.s3Key
      && !this.isUploadingS3
    ) {
      this.iniciarUploadS3Silencioso(this.selectedFile);
    }
  });

  ngOnInit(): void {
    this.route?.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.restorePersistedAnalysisIfPresent());
  }

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
    this.masteringFeedback.set(null);
    const generation = this.workspaceGeneration;
    this.addLog(`Iniciando handshake S3 para: ${file.name}`);

    this.dspService.getMasteringV2PresignedUrl(file.name).subscribe({
      next: (s3Response) => {
        if (!this.isActiveWorkspace(generation)) return;
        this.addLog('URL pré-assinada concedida pelo S3. Iniciando upload em background...');
        this.dspService.uploadToS3(s3Response.uploadUrl, file).subscribe({
          next: () => {
            if (!this.isActiveWorkspace(generation)) return;
            this.isUploadingS3 = false;
            this.s3Key = s3Response.s3Key;
            this.masteringFeedback.set(null);
            this.addLog(`Upload concluído! Arquivo persistido em: ${s3Response.s3Key}`);
            this.requestSourceAnalysis(file, generation);
          },
          error: (error: unknown) => {
            if (!this.isActiveWorkspace(generation)) return;
            this.isUploadingS3 = false;
            this.masteringFeedback.set('upload_failed');
            this.analysisState.set('error');
            this.addLog(`❌ ERRO CRÍTICO S3: ${this.errorMessage(error)}`);
          },
        });
      },
      error: (error: unknown) => {
        if (!this.isActiveWorkspace(generation)) return;
        this.isUploadingS3 = false;
        this.masteringFeedback.set('upload_failed');
        this.analysisState.set('error');
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
      this.masteringFeedback.set('source_preparing');
      this.addLog('❌ MASTERING V2: source upload is not ready yet.');
      return;
    }

    if (!command.preview && !this.auth.canMaster()) {
      alert(this.lang.t().LIMIT_EXCEEDED_ALERT);
      return;
    }

    this.masteringFeedback.set(null);
    this.processingMode = command.preview ? 'preview' : 'full';
    this.isProcessing = true;
    const generation = this.workspaceGeneration;
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
          if (!this.isActiveWorkspace(generation)) return;
          this.completeRenderProgress();
          this.isProcessing = false;
          this.processingMode = null;
          this.releaseProcessedBlobUrl();
          this.processedAudioUrl = window.URL.createObjectURL(blob);
          this.processedAudioName = 'rqs_v2_preview.wav';
          this.isFullMasterCompleted = false;
          this.audioComparison.previewStatus.set('ready');
          this.addLog('Mastering V2 preview concluído com sucesso.');
        },
        error: (error: unknown) => {
          if (!this.isActiveWorkspace(generation)) return;
          this.stopEstimatedRenderProgress();
          this.isProcessing = false;
          this.processingMode = null;
          this.audioComparison.previewStatus.set('error');
          this.masteringFeedback.set('preview_failed');
          this.analytics.trackEvent('master_failed', {
            source_format: this.analyticsSourceFormat(),
            processing_mode: 'preview'
          });
          this.addLog(`❌ MASTERING V2 PREVIEW ERROR: ${this.errorMessage(error)}`);
        },
      });
      return;
    }

    this.analytics.trackEvent('master_started', {
      source_format: this.analyticsSourceFormat(),
      processing_mode: 'full'
    });
    this.addLog(`Mastering V2 final: ${this.describeRequest(command.request)} | ${command.request.intensityPercent}%`);
    this.dspService.masterizeV2Final(formData).subscribe({
      next: (response) => {
        if (!this.isActiveWorkspace(generation)) return;
        this.completeRenderProgress();
        this.isProcessing = false;
        this.processingMode = null;
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
        if (!this.isActiveWorkspace(generation)) return;
        this.stopEstimatedRenderProgress();
        this.isProcessing = false;
        this.processingMode = null;
        this.masteringFeedback.set('full_failed');
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
    this.audioComparison.clearMasterSrc('UPLOAD_ZONE_INVALIDATE_MASTERING_RESULT');
    this.audioComparison.audioProcessed.set(false);
    this.audioComparison.processedFilename.set('');
  }

  ejetarFaixa(): void {
    this.workspaceGeneration += 1;
    this.releaseProcessedBlobUrl();
    this.selectedFile = null;
    this.processedAudioUrl = null;
    this.processedAudioName = '';
    this.s3Key = null;
    this.isProcessing = false;
    this.processingMode = null;
    this.isUploadingS3 = false;
    this.systemLogs = [];
    this.isFullMasterCompleted = false;
    this.masteringFeedback.set(null);
    this.clearAnalysisState();
    this.clearPersistedAnalysisPointer();
    this.audioDna = null;
    this.audioSourceId = null;
    this.masteringService.clearAudioDnaSource();
    this.masteringService.resetPreviewStartSeconds();
    this.stopEstimatedRenderProgress();
    this.audioComparison.resetAll('UPLOAD_ZONE_EJECT_TRACK');
    this.audioComparison.audioProcessed.set(false);
    this.audioComparison.processedFilename.set('');
  }

  ngOnDestroy(): void {
    this.stopEstimatedRenderProgress();
    this.releaseProcessedBlobUrl();
  }

  private acceptSelectedFile(file: File): void {
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.wav') && !fileName.endsWith('.mp3')) {
      this.masteringFeedback.set('invalid_format');
      this.addLog('❌ Formato incompatível. Use WAV ou MP3.');
      return;
    }

    this.workspaceGeneration += 1;
    this.releaseProcessedBlobUrl();
    this.selectedFile = file;
    this.processedAudioUrl = null;
    this.processedAudioName = '';
    this.s3Key = null;
    this.isProcessing = false;
    this.processingMode = null;
    this.isFullMasterCompleted = false;
    this.masteringFeedback.set(null);
    this.clearAnalysisState();
    this.clearPersistedAnalysisPointer();
    this.audioDna = null;
    this.audioSourceId = `source-${this.workspaceGeneration}:${file.name}:${file.size}:${file.lastModified}`;
    this.masteringService.beginAudioSource(this.audioSourceId);
    this.systemLogs = [];
    this.masteringService.resetPreviewStartSeconds();
    this.audioComparison.audioProcessed.set(false);
    this.audioComparison.processedFilename.set('');
    this.addLog(`Track engatada: ${file.name}`);

    if (this.masteringV2DirectUpload) {
      this.isUploadingS3 = false;
      this.addLog('Modo local Mastering V2: upload direto ao backend, sem S3.');
      if (this.auth.isLoggedIn()) {
        this.requestSourceAnalysis(file, this.workspaceGeneration);
      } else {
        this.analysisState.set('auth_required');
      }
      return;
    }

    if (this.auth.isLoggedIn()) {
      this.analysisState.set('loading');
      this.iniciarUploadS3Silencioso(file);
    } else {
      this.analysisState.set('auth_required');
    }
  }

  private requestSourceAnalysis(file: File, generation: number): void {
    if (!this.isActiveWorkspace(generation) || this.analysisRequestedGeneration === generation) return;
    if (!this.masteringV2DirectUpload && !this.s3Key) return;

    this.analysisRequestedGeneration = generation;
    this.analysisMetrics.set(null);
    this.openAiMusicAnalyst = null;
    this.audioIntelligence = null;
    this.analysisState.set('loading');
    const formData = new FormData();
    if (this.masteringV2DirectUpload) {
      formData.append('audio', file, file.name);
    } else {
      formData.append('s3Key', this.s3Key!);
    }
    const requestedGeneration = `source-${generation}`;
    formData.append('source_generation', requestedGeneration);

    this.analysisRequestId ??= crypto.randomUUID();
    this.dspService.analyzeMasteringV2(formData, this.analysisRequestId).subscribe({
      next: (response) => {
        if (!this.isActiveWorkspace(generation)) return;
        const semantic = response.audio_dna?.semantic;
        const hasGenerationBoundAnalysis = Boolean(semantic || response.openai_music_analyst || response.audio_intelligence);
        const generationMismatch = response.source_generation !== requestedGeneration
          || response.analyzer_generation !== requestedGeneration
          || (response.audio_dna !== undefined && (
            response.audio_dna.source_generation !== requestedGeneration
            || response.audio_dna.analyzer_generation !== requestedGeneration
          ))
          || (semantic !== undefined && (
            semantic.source_generation !== requestedGeneration
            || semantic.analyzer_generation !== requestedGeneration
          ))
          || (response.audio_intelligence !== undefined && (
            response.audio_intelligence.source_generation !== requestedGeneration
            || response.audio_intelligence.analyzer_generation !== requestedGeneration
          ));
        if (hasGenerationBoundAnalysis && generationMismatch) {
          this.analysisMetrics.set(null);
          this.audioDna = null;
          this.openAiMusicAnalyst = null;
          this.audioIntelligence = null;
          this.analysisState.set('error');
          return;
        }
        this.analysisMetrics.set(response);
        this.audioDna = response.audio_dna ?? null;
        this.openAiMusicAnalyst = response.openai_music_analyst ?? null;
        this.audioIntelligence = response.audio_intelligence ?? null;
        this.analysisId = response.analysis_id ?? null;
        this.persistedFlowStage = response.flow_stage ?? null;
        this.persistedArtistConfirmation = null;
        this.persistedConfirmedAt = null;
        this.persistedPitchResult = null;
        this.analysisRestored.set(false);
        if (this.analysisId) this.rememberAnalysis(this.analysisId);
        if (this.audioSourceId && response.audio_dna?.status === 'available' && response.audio_dna.master_profile) {
          this.masteringService.initializeFromAudioDna(this.audioSourceId, response.audio_dna.master_profile);
        }
        this.analysisState.set('success');
      },
      error: (error: unknown) => {
        if (!this.isActiveWorkspace(generation)) return;
        const status = typeof error === 'object' && error !== null
          ? Number((error as { status?: unknown }).status)
          : 0;
        this.analysisMetrics.set(null);
        this.audioDna = null;
        this.openAiMusicAnalyst = null;
        this.audioIntelligence = null;
        this.analysisState.set(status === 401 || status === 403 ? 'auth_required' : 'error');
      },
    });
  }

  private clearAnalysisState(): void {
    this.analysisRequestedGeneration = null;
    this.analysisMetrics.set(null);
    this.audioDna = null;
    this.openAiMusicAnalyst = null;
    this.audioIntelligence = null;
    this.analysisId = null;
    this.persistedArtistConfirmation = null;
    this.persistedFlowStage = null;
    this.persistedConfirmedAt = null;
    this.persistedPitchResult = null;
    this.analysisRequestId = null;
    this.analysisRestored.set(false);
    this.analysisState.set('empty');
  }

  restoredAnalysisMessage(): string {
    const language = this.lang.currentLang();
    if (language === 'pt') return 'Análise restaurada';
    if (language === 'fr') return 'Analyse restaurée';
    if (language === 'pl') return 'Analiza przywrócona';
    return 'Analysis restored';
  }

  private restorePersistedAnalysisIfPresent(): void {
    if (!this.auth.isLoggedIn() || this.selectedFile) return;
    const userId = this.auth.session()?.user.id;
    if (!userId) return;
    const queryId = this.route?.snapshot.queryParamMap.get('analysis') ?? null;
    const pointer = typeof localStorage !== 'undefined'
      ? localStorage.getItem(this.analysisPointerKey(userId))
      : null;
    const id = queryId || pointer;
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return;
    if (this.analysisId === id || this.rehydratingAnalysisId === id) return;

    this.rehydratingAnalysisId = id;
    this.analysisState.set('loading');
    this.dspService.getMasteringV2Analysis(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: restored => {
          this.rehydratingAnalysisId = null;
          if (restored.status !== 'READY') {
            this.analysisState.set(restored.status === 'ANALYZING' ? 'loading' : 'error');
            return;
          }
          const analysis = restored.analysis;
          this.analysisId = restored.analysis_id;
          this.analysisMetrics.set(analysis);
          this.audioDna = analysis.audio_dna ?? null;
          this.audioIntelligence = analysis.audio_intelligence ?? null;
          this.openAiMusicAnalyst = analysis.openai_music_analyst ?? null;
          this.persistedArtistConfirmation = restored.artist_confirmed_sound;
          this.persistedFlowStage = restored.flow_stage;
          this.persistedConfirmedAt = restored.confirmed_at;
          this.persistedPitchResult = restored.pitch_result;
          this.audioSourceId = `analysis:${restored.analysis_id}`;
          if (this.audioDna?.status === 'available' && this.audioDna.master_profile) {
            this.masteringService.initializeFromAudioDna(this.audioSourceId, this.audioDna.master_profile);
          }
          this.analysisState.set('success');
          this.analysisRestored.set(true);
          this.rememberAnalysis(restored.analysis_id);
        },
        error: error => {
          this.rehydratingAnalysisId = null;
          const status = Number(error?.status || 0);
          if (status === 404) this.clearPersistedAnalysisPointer();
          this.analysisState.set(status === 401 || status === 403 ? 'auth_required' : 'error');
        },
      });
  }

  private rememberAnalysis(id: string): void {
    const userId = this.auth.session()?.user.id;
    if (userId && typeof localStorage !== 'undefined') {
      localStorage.setItem(this.analysisPointerKey(userId), id);
    }
    if (!this.router || !this.route) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { analysis: id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private clearPersistedAnalysisPointer(): void {
    const userId = this.auth.session()?.user.id;
    if (userId && typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.analysisPointerKey(userId));
    }
    this.analysisId = null;
    this.rehydratingAnalysisId = null;
    if (!this.router || !this.route) return;
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { analysis: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private analysisPointerKey(userId: string): string {
    return `rqs:lastAnalysisId:${userId}`;
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

  masteringFeedbackMessage(): string | null {
    const feedback = this.masteringFeedback();
    if (feedback === 'invalid_format') return this.lang.t().MASTERING_INVALID_FORMAT;
    if (feedback === 'upload_failed') return this.lang.t().MASTERING_UPLOAD_FAILED;
    if (feedback === 'source_preparing') return this.lang.t().MASTERING_SOURCE_PREPARING;
    if (feedback === 'preview_failed') return this.lang.t().MASTERING_PREVIEW_FAILED;
    if (feedback === 'full_failed') return this.lang.t().MASTERING_FULL_FAILED;
    return null;
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

  private isActiveWorkspace(generation: number): boolean {
    return generation === this.workspaceGeneration && this.auth.isLoggedIn();
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
