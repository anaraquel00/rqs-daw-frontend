import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
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

@Component({
  selector: 'app-mastering-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mastering-panel.html',
  styleUrls: ['./mastering-panel.scss'],
})
export class MasteringPanelComponent implements OnInit, OnChanges, OnDestroy {
  readonly lang = inject(LanguageService);
  readonly auth = inject(AuthService);
  readonly audioComparison = inject(AudioComparisonService);
  private readonly dspService = inject(DspService);
  private readonly masteringService = inject(MasteringService);

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
  private originalObjectUrl: string | null = null;

  readonly capabilitiesLoading = computed(() => this.capabilities() === null && this.capabilitiesError() === null);

  readonly previewWindowString = computed(() => {
    const start = this.audioComparison.previewStart();
    const end = this.audioComparison.previewEnd();
    return `${this.formatarTempo(start)} – ${this.formatarTempo(end)}`;
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
      return `Requested LUFS must be between ${target.min_lufs} and ${target.max_lufs}.`;
    }
    return null;
  });

  readonly requestReady = computed(() => {
    return this.capabilities() !== null
      && this.capabilitiesError() === null
      && this.activeTarget() !== null
      && this.requestedLufsError() === null;
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
        this.capabilitiesError.set('Mastering V2 contract is unavailable.');
      },
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['originalFile']) {
      this.releaseOriginalObjectUrl();
      if (this.originalFile) {
        this.originalObjectUrl = window.URL.createObjectURL(this.originalFile);
        this.audioComparison.setOriginalSrc(this.originalObjectUrl);
      }
    }

    if (changes['masteredAudioUrl']) {
      if (this.masteredAudioUrl) {
        const mode = this.isFullMaster ? 'full-track' : 'preview-15s';
        this.audioComparison.setMasterSrc(this.masteredAudioUrl, mode);
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

  alternarAudicao(variant: AudioVariant): void {
    void this.audioComparison.switchVariant(variant);
  }

  dispararPreview(): void {
    if (this.isProcessing || !this.requestReady()) return;
    this.audioComparison.previewStatus.set('processing');
    this.processMaster.emit({ request: this.masteringService.getRequest(), preview: true });
  }

  dispararProcessamentoCompleto(): void {
    if (this.isProcessing || !this.requestReady()) return;
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

  ngOnDestroy(): void {
    this.releaseOriginalObjectUrl();
    this.audioComparison.resetAll();
  }

  private notifyConfigChanged(): void {
    this.audioComparison.clearMasterSrc();
    this.configChanged.emit();
  }

  private releaseOriginalObjectUrl(): void {
    if (!this.originalObjectUrl) return;
    window.URL.revokeObjectURL(this.originalObjectUrl);
    this.originalObjectUrl = null;
  }
}
