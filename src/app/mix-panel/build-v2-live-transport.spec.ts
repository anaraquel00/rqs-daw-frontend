import {
  BuildV2TransportClock,
} from './build-v2-live-transport';

describe('BUILD V2 live transport clock', () => {
  it('starts stopped at zero', () => {
    const clock =
      new BuildV2TransportClock(120);

    expect(clock.snapshot()).toEqual({
      state: 'stopped',
      positionSeconds: 0,
      durationSeconds: 120,
      progressPercent: 0,
    });
  });

  it('advances from AudioContext time while playing', () => {
    const clock =
      new BuildV2TransportClock(120);

    clock.play(10);

    const snapshot = clock.tick(15.5);

    expect(snapshot.state).toBe(
      'playing',
    );

    expect(
      snapshot.positionSeconds,
    ).toBeCloseTo(5.5, 8);

    expect(
      snapshot.progressPercent,
    ).toBeCloseTo(
      (5.5 / 120) * 100,
      8,
    );
  });

  it('pauses at the exact audio-clock position', () => {
    const clock =
      new BuildV2TransportClock(120);

    clock.play(20);

    const paused =
      clock.pause(27.25);

    expect(paused.state).toBe(
      'paused',
    );

    expect(
      paused.positionSeconds,
    ).toBeCloseTo(7.25, 8);

    const later =
      clock.snapshot(100);

    expect(
      later.positionSeconds,
    ).toBeCloseTo(7.25, 8);
  });

  it('resumes from the paused position', () => {
    const clock =
      new BuildV2TransportClock(120);

    clock.play(10);
    clock.pause(15);

    clock.play(50);

    const snapshot =
      clock.tick(53);

    expect(
      snapshot.positionSeconds,
    ).toBeCloseTo(8, 8);
  });

  it('supports seek while playing without losing sync', () => {
    const clock =
      new BuildV2TransportClock(120);

    clock.play(10);

    clock.seek(60, 20);

    const snapshot =
      clock.tick(25);

    expect(snapshot.state).toBe(
      'playing',
    );

    expect(
      snapshot.positionSeconds,
    ).toBeCloseTo(65, 8);
  });

  it('clamps seek to timeline boundaries', () => {
    const clock =
      new BuildV2TransportClock(120);

    expect(
      clock.seek(-20).positionSeconds,
    ).toBe(0);

    const end = clock.seek(999);

    expect(
      end.positionSeconds,
    ).toBe(120);

    expect(end.state).toBe('ended');
  });

  it('moves to ended when the audio clock reaches duration', () => {
    const clock =
      new BuildV2TransportClock(10);

    clock.play(100);

    const snapshot =
      clock.tick(110.5);

    expect(snapshot.state).toBe(
      'ended',
    );

    expect(
      snapshot.positionSeconds,
    ).toBe(10);

    expect(
      snapshot.progressPercent,
    ).toBe(100);
  });

  it('restarts from zero after natural end', () => {
    const clock =
      new BuildV2TransportClock(10);

    clock.play(100);
    clock.tick(111);

    const restarted =
      clock.play(200);

    expect(restarted.state).toBe(
      'playing',
    );

    expect(
      restarted.positionSeconds,
    ).toBe(0);

    expect(
      clock.tick(202).positionSeconds,
    ).toBeCloseTo(2, 8);
  });

  it('stop returns playhead to zero', () => {
    const clock =
      new BuildV2TransportClock(120);

    clock.play(10);
    clock.tick(40);

    const stopped =
      clock.stop();

    expect(stopped.state).toBe(
      'stopped',
    );

    expect(
      stopped.positionSeconds,
    ).toBe(0);

    expect(
      stopped.progressPercent,
    ).toBe(0);
  });

  it('reconciles playhead when timeline duration shrinks', () => {
    const clock =
      new BuildV2TransportClock(120);

    clock.seek(90);

    const snapshot =
      clock.setDuration(60);

    expect(snapshot.state).toBe(
      'ended',
    );

    expect(
      snapshot.positionSeconds,
    ).toBe(60);

    expect(
      snapshot.progressPercent,
    ).toBe(100);
  });
});
