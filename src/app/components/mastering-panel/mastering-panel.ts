import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LanguageService } from '../../services/language.service';
import { AuthService } from '../../services/auth.service';
import { AudioComparisonService, AudioVariant } from '../../services/audio-comparison.service';
import { DspService } from '../../services/dsp';
import { MasteringService } from '../../services/mastering.service';
import {
  MasteringAtmosphere,
  MasteringDeliveryTargetCapabilities,
  MasteringDestination,
  MasteringPlatform,
  MasteringProcessCommand,
  MasteringV2Capabilities,
  SoundCloudMode,
} from '../../services/mastering-types';
import { MasteringHelpTopic, masteringEducation } from './mastering-education';
import { PreviewWaveformComponent } from './preview-waveform';

@Component({
  selector: 'app-mastering-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, PreviewWaveformComponent],
  templateUrl: './mastering-panel.html',
  styleUrls: ['./mastering-panel.scss'],
})
export class MasteringPanelComponent implements OnInit, OnChanges, OnDestroy {
  readonly lang = inject(LanguageService);
  readonly auth = inject(AuthService);
  readonly audioComparison = inject(AudioComparisonService);
  private readonly dspService = inject(DspService);
  private readonly masteringService = inject(MasteringService);
  private readonly platformId = inject(PLATFORM_ID);
  joiningWaitlist = false;
  joinedWaitlist = false;
  waitlistError = false;

  @Input() originalFile: File | null = null;
  @Input() isProcessing = false;
  @Input() masteredAudioUrl: string | null = null;
  @Input() isFullMaster = false;

  @Output() processMaster = new EventEmitter<MasteringProcessCommand>();
  @Output() configChanged = new EventEmitter<void>();

  readonly destination = this.masteringService.destination;
  readonly platform = this.masteringService.platform;
  readonly atmosphere = this.masteringService.atmosphere;
  readonly intensityPercent = this.masteringService.intensityPercent;
  readonly requestedLufs = this.masteringService.requestedLufs;
  readonly soundcloudMode = this.masteringService.soundcloudMode;

  readonly capabilities = signal<MasteringV2Capabilities | null>(null);
  readonly capabilitiesError = signal<string | null>(null);
  readonly activeHelpTopic = signal<MasteringHelpTopic | null>(null);
  readonly guideOpen = signal(false);
  readonly configInvalidatedResult = signal(false);
  private originalObjectUrl: string | null = null;

  readonly education = computed(() => masteringEducation(this.lang.currentLang()));
  readonly capabilitiesLoading = computed(() => this.capabilities() === null && this.capabilitiesError() === null);

  readonly previewWindowString = computed(() => {
    const start = this.audioComparison.previewStart();
    const end = this.audioComparison.previewEnd();
    return `${this.formatarTempo(start)} – ${this.formatarTempo(end)}`;
  });

  readonly activeHelp = computed(() => {
    const topic = this.activeHelpTopic();
    return topic ? this.education().controls[topic] : null;
  });

  readonly activeTarget = computed<MasteringDeliveryTargetCapabilities | null>(() => {
    const capabilities = this.capabilities();
    if (!capabilities) return null;

    const destination = this.destination();
    if (destination === 'club' || destination === 'festival') {
      return capabilities.destinations[destination].target;
    }

    const platform = this.platform();
    if (!platform) return null;
    const mode: SoundCloudMode = platform === 'soundcloud' ? this.soundcloudMode() : 'standard';
    return capabilities.destinations.streaming.platforms[platform][mode] ?? null;
  });

  readonly requestedLufsError = computed<string | null>(() => {
    const target = this.activeTarget();
    const requested = this.requestedLufs();
    if (!target || requested === null) return null;
    if (requested < target.min_lufs || requested > target.max_lufs) {
      return this.education().invalidLufs(target.min_lufs, target.max_lufs);
    }
    return null;
  });

  readonly requestReady = computed(() => {
    return this.capabilities() !== null
      && this.capabilitiesError() === null
      && this.activeTarget() !== null
      && this.requestedLufsError() === null;
  });

  readonly renderBlockReason = computed<string | null>(() => {
    if (this.capabilitiesLoading()) {
      if (this.lang.currentLang() === 'pl') return 'Ładowanie polityki masteringu z backendu…';
      if (this.lang.currentLang() === 'pt') return 'Carregando a política de masterização do backend…';
      return 'Loading the mastering policy from the backend…';
    }
    if (this.capabilitiesError()) return this.capabilitiesError();
    if (!this.activeTarget()) {
      if (this.lang.currentLang() === 'pl') return 'Nie znaleziono polityki dla wybranego zastosowania.';
      if (this.lang.currentLang() === 'pt') return 'A política do destino selecionado não está disponível.';
      return 'The selected destination policy is unavailable.';
    }
    return this.requestedLufsError();
  });

  ngOnInit(): void {
    this.dspService.getMasteringV2Capabilities().subscribe({
      next: (capabilities) => {
        if (capabilities.engine !== 'rqs-core-mastering-v2') {
          this.capabilities.set(null);
          this.capabilitiesError.set(`Unexpected mastering engine: ${capabilities.engine}`);
          return;
        }
        this.capabilities.set(capabilities);
        this.capabilitiesError.set(null);
      },
      error: () => {
        this.capabilities.set(null);
        if (this.lang.currentLang() === 'pl') {
          this.capabilitiesError.set('Nie można pobrać kontraktu Mastering V2.');
        } else if (this.lang.currentLang() === 'pt') {
          this.capabilitiesError.set('Não foi possível carregar o contrato Mastering V2.');
        } else {
          this.capabilitiesError.set('Mastering V2 contract is unavailable.');
        }
      },
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['originalFile']) {
      this.releaseOriginalObjectUrl();
      this.configInvalidatedResult.set(false);
      if (this.originalFile && isPlatformBrowser(this.platformId)) {
        this.originalObjectUrl = window.URL.createObjectURL(this.originalFile);
        this.audioComparison.setOriginalSrc(
          this.originalObjectUrl,
          this.masteringService.previewStartSeconds(),
        );
      }
    }

    if (changes['masteredAudioUrl']) {
      if (this.masteredAudioUrl) {
        const mode = this.isFullMaster ? 'full-track' : 'preview-15s';
        this.audioComparison.setMasterSrc(this.masteredAudioUrl, mode);
        this.configInvalidatedResult.set(false);
      } else {
        this.audioComparison.clearMasterSrc();
      }
    }
  }

  selectDestination(value: MasteringDestination): void {
    if (this.isProcessing || this.destination() === value) return;
    this.masteringService.setDestination(value);
    this.notifyConfigChanged();
  }

  selectPlatform(value: MasteringPlatform): void {
    if (this.isProcessing || this.platform() === value) return;
    this.masteringService.setPlatform(value);
    this.notifyConfigChanged();
  }

  selectAtmosphere(value: MasteringAtmosphere): void {
    if (this.isProcessing || this.atmosphere() === value) return;
    this.masteringService.setAtmosphere(value);
    this.notifyConfigChanged();
  }

  selectSoundCloudMode(value: SoundCloudMode): void {
    if (this.isProcessing || this.soundcloudMode() === value) return;
    this.masteringService.setSoundCloudMode(value);
    this.notifyConfigChanged();
  }

  updateIntensity(event: Event): void {
    if (this.isProcessing) return;
    const value = Number((event.target as HTMLInputElement).value);
    const normalized = Math.max(0, Math.min(100, Math.round(value)));
    if (normalized === this.intensityPercent()) return;
    this.masteringService.setIntensityPercent(normalized);
    this.notifyConfigChanged();
  }

  updateRequestedLufs(value: string | number | null): void {
    if (this.isProcessing) return;

    let nextValue: number | null = null;
    if (value !== null && value !== '') {
      const parsed = Number(value);
      nextValue = Number.isFinite(parsed) ? parsed : null;
    }

    if (nextValue === this.requestedLufs()) return;
    this.masteringService.setRequestedLufs(nextValue);
    this.notifyConfigChanged();
  }

  usePolicyLufs(): void {
    if (this.isProcessing || this.requestedLufs() === null) return;
    this.masteringService.setRequestedLufs(null);
    this.notifyConfigChanged();
  }

  toggleHelp(topic: MasteringHelpTopic): void {
    this.activeHelpTopic.set(this.activeHelpTopic() === topic ? null : topic);
  }

  toggleGuide(): void {
    this.guideOpen.update((value) => !value);
  }

  alternarAudicao(variant: AudioVariant): void {
    void this.audioComparison.switchVariant(variant);
  }

  hasCurrentPreview(): boolean {
    return !this.isFullMaster
      && this.audioComparison.canUseMaster()
      && this.audioComparison.playbackMode() === 'preview-15s';
  }

  hasCurrentFullMaster(): boolean {
    return this.isFullMaster
      && this.audioComparison.canUseMaster()
      && this.audioComparison.playbackMode() === 'full-track';
  }

  canGeneratePreview(): boolean {
    return !this.isProcessing
      && this.requestReady()
      && this.audioComparison.previewStatus() !== 'processing'
      && !this.hasCurrentPreview()
      && !this.hasCurrentFullMaster();
  }

  canGenerateFullMaster(): boolean {
    return !this.isProcessing
      && this.requestReady()
      && this.hasCurrentPreview()
      && this.auth.canMaster();
  }

  workflowStatusText(): string {
    const language = this.lang.currentLang();
    if (this.hasCurrentFullMaster()) {
      if (language === 'pl') return 'Pełny Master jest aktualny. Plik jest gotowy do pobrania.';
      if (language === 'pt') return 'O Master completo está atual. O arquivo está pronto para download.';
      return 'The Full Master is current. The file is ready to download.';
    }
    if (this.hasCurrentPreview()) {
      if (language === 'pl') return 'Preview jest aktualny. Możesz teraz wykonać pełny Master, jeśli pozwala na to plan.';
      if (language === 'pt') return 'A prévia está atual. Agora você pode gerar o Master completo se o plano permitir.';
      return 'The Preview is current. You can now render the Full Master if your plan allows it.';
    }
    if (language === 'pl') return 'Ustawienia są prawidłowe. Najpierw wygeneruj 15-sekundowy Preview.';
    if (language === 'pt') return 'As configurações estão válidas. Gere primeiro a prévia de 15 segundos.';
    return 'Settings are valid. Generate the 15-second Preview first.';
  }

  onPreviewRangeStartChange(startSeconds: number): void {
    if (this.isProcessing || !Number.isFinite(startSeconds)) return;
    const normalized = Math.max(0, Math.round(startSeconds * 1000) / 1000);
    if (Math.abs(normalized - this.audioComparison.previewStart()) < 0.005) return;

    const hadCurrentResult = this.audioComparison.canUseMaster() || this.isFullMaster;
    this.masteringService.setPreviewStartSeconds(normalized);
    this.audioComparison.setPreviewStart(normalized);

    if (hadCurrentResult) {
      this.audioComparison.clearMasterSrc();
      this.configInvalidatedResult.set(true);
      this.configChanged.emit();
    } else {
      this.audioComparison.stopAndReset();
    }
  }

  masterVariantLabel(): string {
    if (!this.isFullMaster) return this.lang.tr().MASTER_LABEL;
    if (this.lang.currentLang() === 'pl') return 'B - PEŁNY MASTER';
    if (this.lang.currentLang() === 'pt') return 'B - MASTER COMPLETO';
    return 'B - FULL MASTER';
  }

  onWaveformSeek(seconds: number): void {
    this.audioComparison.seek(seconds);
  }

  dispararPreview(): void {
    if (!this.canGeneratePreview()) return;
    const previewStartSeconds = this.audioComparison.previewStart();
    this.masteringService.setPreviewStartSeconds(previewStartSeconds);
    this.configInvalidatedResult.set(false);
    this.audioComparison.previewStatus.set('processing');
    this.processMaster.emit({
      request: this.masteringService.getRequest(),
      preview: true,
      previewStartSeconds,
    });
  }

  dispararProcessamentoCompleto(): void {
    if (!this.canGenerateFullMaster()) return;
    this.configInvalidatedResult.set(false);
    this.processMaster.emit({ request: this.masteringService.getRequest(), preview: false });
  }

  pararReproducao(): void {
    this.audioComparison.stopAndReset();
  }

  formatarTempo(segundos: number): string {
    if (!Number.isFinite(segundos) || segundos < 0) return '00:00';
    const mins = Math.floor(segundos / 60);
    const secs = Math.floor(segundos % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  onScrubberChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = Number.parseFloat(input.value);
    if (!Number.isFinite(value)) return;

    if (this.audioComparison.canUseMaster() && this.audioComparison.playbackMode() === 'preview-15s') {
      this.audioComparison.seek(this.audioComparison.previewStart() + value);
    } else {
      this.audioComparison.seek(value);
    }
  }

  async joinProWaitlist(): Promise<void> {
    const email = this.auth.session()?.user?.email;
    if (!email) {
      this.waitlistError = true;
      return;
    }

    this.joiningWaitlist = true;
    this.waitlistError = false;

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: 'studio.raquelsynths.com',
          language: this.lang.currentLang(),
          website: '',
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        this.waitlistError = true;
        return;
      }
      this.joinedWaitlist = true;
    } catch {
      this.waitlistError = true;
    } finally {
      this.joiningWaitlist = false;
    }
  }

  ngOnDestroy(): void {
    this.releaseOriginalObjectUrl();
    this.audioComparison.resetAll();
  }

  private notifyConfigChanged(): void {
    const hadMaster = this.audioComparison.canUseMaster();
    this.audioComparison.clearMasterSrc();
    if (hadMaster) this.configInvalidatedResult.set(true);
    this.configChanged.emit();
  }

  private releaseOriginalObjectUrl(): void {
    if (!this.originalObjectUrl) return;
    if (isPlatformBrowser(this.platformId)) {
      window.URL.revokeObjectURL(this.originalObjectUrl);
    }
    this.originalObjectUrl = null;
  }
}
