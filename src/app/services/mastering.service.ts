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
  readonly destination: WritableSignal<MasteringDestination> = signal('streaming');
  readonly platform: WritableSignal<MasteringPlatform | null> = signal('spotify');
  readonly atmosphere: WritableSignal<MasteringAtmosphere> = signal('clear_sky');
  readonly intensityPercent: WritableSignal<number> = signal(50);
  readonly requestedLufs: WritableSignal<number | null> = signal(null);
  readonly soundcloudMode: WritableSignal<SoundCloudMode> = signal('standard');

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
