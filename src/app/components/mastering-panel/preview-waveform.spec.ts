import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PreviewWaveformComponent } from './preview-waveform';

describe('PreviewWaveformComponent display modes', () => {
  let fixture: ComponentFixture<PreviewWaveformComponent>;
  let component: PreviewWaveformComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [PreviewWaveformComponent] });
    fixture = TestBed.createComponent(PreviewWaveformComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => fixture.destroy());

  it('preserves the interactive MASTER waveform by default', () => {
    component.duration = 120;
    fixture.detectChanges();

    expect(component.compact).toBeFalse();
    expect(fixture.debugElement.query(By.css('.preview-region'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('.waveform-playhead'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('.waveform-compact'))).toBeNull();
  });

  it('renders compact mode without Preview selection or playhead', () => {
    component.compact = true;
    component.duration = 120;
    fixture.detectChanges();

    expect(fixture.debugElement.query(By.css('.waveform-compact'))).not.toBeNull();
    expect(fixture.debugElement.query(By.css('.preview-region'))).toBeNull();
    expect(fixture.debugElement.query(By.css('.waveform-playhead'))).toBeNull();
  });

  it('does not emit seek or selection changes in compact mode', () => {
    component.compact = true;
    component.duration = 120;
    fixture.detectChanges();
    const seek = spyOn(component.seekTo, 'emit');
    const range = spyOn(component.rangeStartChange, 'emit');
    const pointer = new PointerEvent('pointerdown', { clientX: 20, pointerId: 1 });

    component.onHostPointerDown(pointer);
    component.onRegionPointerDown(pointer);
    component.onHostPointerMove(pointer);

    expect(seek).not.toHaveBeenCalled();
    expect(range).not.toHaveBeenCalled();
  });
});
