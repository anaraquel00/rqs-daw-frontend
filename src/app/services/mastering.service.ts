import { Injectable, WritableSignal, signal } from '@angular/core';
import {
  MasteringAtmosphere,
  MasteringDestination,
  MasteringPlatform,
  MasteringV2Request,
  SoundCloudMode,
} from './mastering-types';

@Injectable({
  providedIn: 'root',
})
export class MasteringService {
  // Validated Mastering V2 request state.
  readonly destination: WritableSignal<MasteringDestination> = signal('streaming');
  readonly platform: WritableSignal<MasteringPlatform | null> = signal('spotify');
  readonly atmosphere: WritableSignal<MasteringAtmosphere> = signal('clear_sky');
  readonly intensityPercent: WritableSignal<number> = signal(50);
  readonly requestedLufs: WritableSignal<number | null> = signal(null);
  readonly soundcloudMode: WritableSignal<SoundCloudMode> = signal('standard');
  readonly previewStartSeconds: WritableSignal<number | null> = signal(null);

  // Legacy component compatibility only. These signals keep standalone legacy
  // control components compilable, but they are intentionally NOT serialized
  // by getRequest() and therefore cannot alter the validated V2 contract.
  readonly lowCutoff: WritableSignal<number> = signal(200);
  readonly highCutoff: WritableSignal<number> = signal(3000);
  readonly stereoWidth: WritableSignal<number> = signal(1.0);
  readonly satAmount: WritableSignal<number> = signal(0.3);
  readonly monoBassHz: WritableSignal<number> = signal(120);
  readonly ceiling: WritableSignal<number> = signal(-1.0);
  readonly threshold: WritableSignal<number> = signal(0.0);

  setDestination(value: MasteringDestination): void {
    this.destination.set(value);
    this.requestedLufs.set(null);

    if (value === 'streaming') {
      if (this.platform() === null) this.platform.set('spotify');
    } else {
      this.platform.set(null);
      this.soundcloudMode.set('standard');
    }
  }

  setPlatform(value: MasteringPlatform): void {
    if (this.destination() !== 'streaming') return;
    this.platform.set(value);
    this.requestedLufs.set(null);
    if (value !== 'soundcloud') this.soundcloudMode.set('standard');
  }

  setAtmosphere(value: MasteringAtmosphere): void {
    this.atmosphere.set(value);
  }

  setIntensityPercent(value: number): void {
    const normalized = Math.max(0, Math.min(100, Math.round(value)));
    this.intensityPercent.set(normalized);
  }

  setRequestedLufs(value: number | null): void {
    this.requestedLufs.set(value);
  }

  setSoundCloudMode(value: SoundCloudMode): void {
    if (this.destination() === 'streaming' && this.platform() === 'soundcloud') {
      this.soundcloudMode.set(value);
      this.requestedLufs.set(null);
    }
  }

  setPreviewStartSeconds(value: number | null): void {
    if (value === null) {
      this.previewStartSeconds.set(null);
      return;
    }
    if (!Number.isFinite(value)) return;
    this.previewStartSeconds.set(Math.max(0, Math.round(value * 1000) / 1000));
  }

  resetPreviewStartSeconds(): void {
    this.previewStartSeconds.set(null);
  }

  setLowCutoff(value: number): void {
    this.lowCutoff.set(value);
  }

  setHighCutoff(value: number): void {
    this.highCutoff.set(value);
  }

  setStereoWidth(value: number): void {
    this.stereoWidth.set(value);
  }

  setSatAmount(value: number): void {
    this.satAmount.set(value);
  }

  setMonoBass(value: number): void {
    this.monoBassHz.set(value);
  }

  setCeiling(value: number): void {
    this.ceiling.set(value);
  }

  setThreshold(value: number): void {
    this.threshold.set(value);
  }

  getRequest(): MasteringV2Request {
    return {
      destination: this.destination(),
      platform: this.destination() === 'streaming' ? this.platform() : null,
      atmosphere: this.atmosphere(),
      intensityPercent: this.intensityPercent(),
      requestedLufs: this.requestedLufs(),
      soundcloudMode: this.soundcloudMode(),
    };
  }
}
