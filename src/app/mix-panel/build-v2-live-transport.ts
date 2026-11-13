export type BuildV2TransportState =
  | 'stopped'
  | 'playing'
  | 'paused'
  | 'ended';

export interface BuildV2TransportSnapshot {
  state: BuildV2TransportState;
  positionSeconds: number;
  durationSeconds: number;
  progressPercent: number;
}

export class BuildV2TransportClock {
  private state: BuildV2TransportState = 'stopped';

  private positionSeconds = 0;

  /*
   * AudioContext.currentTime at which playback position 0
   * would have occurred.
   *
   * While playing:
   *
   * position =
   *   AudioContext.currentTime - playbackOriginAudioTime
   */
  private playbackOriginAudioTime = 0;

  constructor(
    private durationSeconds: number,
  ) {
    this.durationSeconds =
      normalizeDuration(durationSeconds);
  }

  snapshot(
    audioTimeSeconds?: number,
  ): BuildV2TransportSnapshot {
    if (
      this.state === 'playing'
      && Number.isFinite(audioTimeSeconds)
    ) {
      this.updateFromAudioClock(
        Number(audioTimeSeconds),
      );
    }

    return this.createSnapshot();
  }

  play(
    audioTimeSeconds: number,
  ): BuildV2TransportSnapshot {
    const audioNow =
      normalizeAudioTime(audioTimeSeconds);

    if (this.durationSeconds <= 0) {
      this.state = 'stopped';
      this.positionSeconds = 0;

      return this.createSnapshot();
    }

    if (
      this.state === 'ended'
      || this.positionSeconds
        >= this.durationSeconds
    ) {
      this.positionSeconds = 0;
    }

    this.playbackOriginAudioTime =
      audioNow - this.positionSeconds;

    this.state = 'playing';

    return this.createSnapshot();
  }

  pause(
    audioTimeSeconds: number,
  ): BuildV2TransportSnapshot {
    if (this.state !== 'playing') {
      return this.createSnapshot();
    }

    const reachedEnd = this.updateFromAudioClock(
      normalizeAudioTime(audioTimeSeconds),
    );

    if (!reachedEnd) {
      this.state = 'paused';
    }

    return this.createSnapshot();
  }

  stop(): BuildV2TransportSnapshot {
    this.state = 'stopped';
    this.positionSeconds = 0;
    this.playbackOriginAudioTime = 0;

    return this.createSnapshot();
  }

  seek(
    positionSeconds: number,
    audioTimeSeconds?: number,
  ): BuildV2TransportSnapshot {
    this.positionSeconds = clamp(
      finiteOr(positionSeconds, 0),
      0,
      this.durationSeconds,
    );

    if (
      this.positionSeconds
      >= this.durationSeconds
      && this.durationSeconds > 0
    ) {
      this.state = 'ended';
      return this.createSnapshot();
    }

    if (
      this.state === 'playing'
      && Number.isFinite(audioTimeSeconds)
    ) {
      this.playbackOriginAudioTime =
        normalizeAudioTime(
          Number(audioTimeSeconds),
        ) - this.positionSeconds;
    }

    if (this.state === 'ended') {
      this.state = 'paused';
    }

    return this.createSnapshot();
  }

  tick(
    audioTimeSeconds: number,
  ): BuildV2TransportSnapshot {
    if (this.state !== 'playing') {
      return this.createSnapshot();
    }

    this.updateFromAudioClock(
      normalizeAudioTime(audioTimeSeconds),
    );

    return this.createSnapshot();
  }

  setDuration(
    durationSeconds: number,
    audioTimeSeconds?: number,
  ): BuildV2TransportSnapshot {
    if (
      this.state === 'playing'
      && Number.isFinite(audioTimeSeconds)
    ) {
      this.updateFromAudioClock(
        normalizeAudioTime(
          Number(audioTimeSeconds),
        ),
      );
    }

    this.durationSeconds =
      normalizeDuration(durationSeconds);

    this.positionSeconds = clamp(
      this.positionSeconds,
      0,
      this.durationSeconds,
    );

    if (this.durationSeconds <= 0) {
      this.state = 'stopped';
      this.positionSeconds = 0;
      return this.createSnapshot();
    }

    if (
      this.positionSeconds
      >= this.durationSeconds
    ) {
      this.positionSeconds =
        this.durationSeconds;

      this.state = 'ended';
    }

    return this.createSnapshot();
  }

  private updateFromAudioClock(
    audioTimeSeconds: number,
  ): boolean {
    const position =
      audioTimeSeconds
      - this.playbackOriginAudioTime;

    if (
      position
      >= this.durationSeconds
    ) {
      this.positionSeconds =
        this.durationSeconds;

      this.state = 'ended';
      return true;
    }

    this.positionSeconds = clamp(
      position,
      0,
      this.durationSeconds,
    );

    return false;
  }

  private createSnapshot():
    BuildV2TransportSnapshot {
    const progressPercent =
      this.durationSeconds > 0
        ? (
          this.positionSeconds
          / this.durationSeconds
        ) * 100
        : 0;

    return {
      state: this.state,
      positionSeconds:
        this.positionSeconds,
      durationSeconds:
        this.durationSeconds,
      progressPercent: clamp(
        progressPercent,
        0,
        100,
      ),
    };
  }
}

function normalizeDuration(
  value: number,
): number {
  return Math.max(
    0,
    finiteOr(value, 0),
  );
}

function normalizeAudioTime(
  value: number,
): number {
  return Math.max(
    0,
    finiteOr(value, 0),
  );
}

function finiteOr(
  value: number,
  fallback: number,
): number {
  return Number.isFinite(Number(value))
    ? Number(value)
    : fallback;
}

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(
    max,
    Math.max(min, value),
  );
}
