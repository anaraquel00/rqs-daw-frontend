import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DspService } from '../../services/dsp';
import {
  AudioDnaPayload,
  AudioIntelligenceFlowStage,
  AudioIntelligenceV2Payload,
  ArtistConfirmedSound,
  MasteringAnalysisState,
  MasteringV2Analysis,
  OpenAiMusicAnalystPayload,
  SpotifyPitchResponse,
} from '../../services/mastering-types';
import { AudioDnaCardComponent } from '../audio-dna-card/audio-dna-card';
import { SpotifyPitchPanelComponent } from '../spotify-pitch-panel/spotify-pitch-panel';

@Component({
  selector: 'app-pitch-workspace-panel',
  standalone: true,
  imports: [CommonModule, AudioDnaCardComponent, SpotifyPitchPanelComponent],
  templateUrl: './pitch-workspace-panel.html',
  styleUrl: './pitch-workspace-panel.scss',
})
export class PitchWorkspacePanelComponent implements OnInit {
  @Input() analysisState: MasteringAnalysisState = 'empty';
  @Input() analysisMetrics: MasteringV2Analysis | null = null;
  @Input() audioDna: AudioDnaPayload | null = null;
  @Input() audioIntelligence: AudioIntelligenceV2Payload | null = null;
  @Input() openAiMusicAnalyst: OpenAiMusicAnalystPayload | null = null;
  @Input() analysisId: string | null = null;
  @Input() persistedArtistConfirmation: ArtistConfirmedSound | null = null;
  @Input() persistedFlowStage: AudioIntelligenceFlowStage | null = null;
  @Input() persistedConfirmedAt: string | null = null;
  @Input() persistedPitchResult: SpotifyPitchResponse | null = null;

  readonly pitchEnabled = signal<boolean | null>(null);
  private readonly dsp = inject(DspService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.dsp.getMasteringV2Capabilities()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: capabilities => this.pitchEnabled.set(capabilities.features?.spotify_pitch_enabled === true),
        error: () => this.pitchEnabled.set(false),
      });
  }
}
