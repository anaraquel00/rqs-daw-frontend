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
  readonly capabilitiesError = signal(false);

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

  ngOnInit(): void {
    this.dspService.getMasteringV2Capabilities().subscribe({
      next: (capabilities) => {
        this.capabilities.set(capabilities);
        this.capabilitiesError.set(false);
      },
      error: () => this.capabilitiesError.set(true),
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['originalFile'] && this.originalFile) {
      const url = window.URL.createObjectURL(this.originalFile);
      this.audioComparison.setOriginalSrc(url);
    }

    if (changes['masteredAudioUrl'] && this.masteredAudioUrl) {
      const mode = this.isFullMaster ? 'full-track' : 'preview-15s';
      this.audioComparison.setMasterSrc(this.masteredAudioUrl, mode);
    }
  }

  selectDestination(value: MasteringDestination): void {
    this.masteringService.setDestination(value);
    this.notifyConfigChanged();
  }

  selectPlatform(value: MasteringPlatform): void {
    this.masteringService.setPlatform(value);
    this.notifyConfigChanged();
  }

  selectAtmosphere(value: MasteringAtmosphere): void {
    this.masteringService.setAtmosphere(value);
    this.notifyConfigChanged();
  }

  selectSoundCloudMode(value: SoundCloudMode): void {
    this.masteringService.setSoundCloudMode(value);
    this.notifyConfigChanged();
  }

  updateIntensity(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.masteringService.setIntensityPercent(value);
    this.notifyConfigChanged();
  }

  updateRequestedLufs(value: string | number | null): void {
    if (value === null || value === '') {
      this.masteringService.setRequestedLufs(null);
    } else {
      const parsed = Number(value);
      this.masteringService.setRequestedLufs(Number.isFinite(parsed) ? parsed : null);
    }
    this.notifyConfigChanged();
  }

  usePolicyLufs(): void {
    this.masteringService.setRequestedLufs(null);
    this.notifyConfigChanged();
  }

  alternarAudicao(variant: AudioVariant): void {
    void this.audioComparison.switchVariant(variant);
  }

  dispararPreview(): void {
    this.audioComparison.previewStatus.set('processing');
    this.processMaster.emit({ request: this.masteringService.getRequest(), preview: true });
  }

  dispararProcessamentoCompleto(): void {
    this.processMaster.emit({ request: this.masteringService.getRequest(), preview: false });
  }

  pararReproducao(): void {
    this.audioComparison.stopAndReset();
  }

  formatarTempo(segundos: number): string {
    if (Number.isNaN(segundos)) return '00:00';
    const mins = Math.floor(segundos / 60);
    const secs = Math.floor(segundos % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  onScrubberChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = Number.parseFloat(input.value);

    if (this.audioComparison.activeVariant() === 'master' && this.audioComparison.playbackMode() === 'preview-15s') {
      this.audioComparison.seek(this.audioComparison.previewStart() + val);
    } else {
      this.audioComparison.seek(val);
    }
  }

  ngOnDestroy(): void {
    this.audioComparison.resetAll();
  }

  private notifyConfigChanged(): void {
    this.audioComparison.previewStatus.set('not-generated');
    this.configChanged.emit();
  }
}
