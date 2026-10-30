import { Component, Input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { of } from 'rxjs';
import { DspService } from '../../services/dsp';
import { SpotifyPitchResponse } from '../../services/mastering-types';
import { AudioDnaCardComponent } from '../audio-dna-card/audio-dna-card';
import { SpotifyPitchPanelComponent } from '../spotify-pitch-panel/spotify-pitch-panel';
import { PitchWorkspacePanelComponent } from './pitch-workspace-panel';

@Component({ selector: 'app-audio-dna-card', standalone: true, template: 'AUDIO DNA' })
class AudioDnaStub {
  @Input() audioDna: unknown;
  @Input() audioIntelligence: unknown;
  @Input() openAiMusicAnalyst: unknown;
  @Input() state: unknown;
  @Input() workspaceMode: 'master' | 'pitch' = 'master';
}

@Component({ selector: 'app-spotify-pitch-panel', standalone: true, template: 'PITCH READY' })
class SpotifyPitchStub {
  @Input() analysisMetrics: unknown;
  @Input() audioDna: unknown;
  @Input() audioIntelligence: unknown;
  @Input() openAiMusicAnalyst: unknown;
  @Input() sourceGeneration: unknown;
  @Input() analysisId: string | null = null;
  @Input() persistedArtistConfirmation: unknown;
  @Input() persistedFlowStage: unknown;
  @Input() persistedConfirmedAt: unknown;
  @Input() persistedPitchResult: SpotifyPitchResponse | null = null;
}

describe('PitchWorkspacePanelComponent', () => {
  let fixture: ComponentFixture<PitchWorkspacePanelComponent>;
  const capabilities = {
    engine: 'rqs-core-mastering-v2',
    features: { spotify_pitch_enabled: true },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PitchWorkspacePanelComponent],
      providers: [{
        provide: DspService,
        useValue: { getMasteringV2Capabilities: jasmine.createSpy().and.returnValue(of(capabilities)) },
      }],
    })
      .overrideComponent(PitchWorkspacePanelComponent, {
        remove: { imports: [AudioDnaCardComponent, SpotifyPitchPanelComponent] },
        add: { imports: [AudioDnaStub, SpotifyPitchStub] },
      })
      .compileComponents();
    fixture = TestBed.createComponent(PitchWorkspacePanelComponent);
  });

  it('renders the dedicated pitch surface only after a READY analysis', () => {
    fixture.componentRef.setInput('analysisState', 'success');
    fixture.componentRef.setInput('analysisId', '00000000-0000-4000-8000-000000000040');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('AI RELEASE INTELLIGENCE');
    expect(fixture.nativeElement.textContent).toContain('AUDIO DNA');
    expect(fixture.nativeElement.textContent).toContain('PITCH READY');
    const audioDna = fixture.debugElement.query(By.directive(AudioDnaStub)).componentInstance as AudioDnaStub;
    expect(audioDna.workspaceMode).toBe('pitch');
  });

  it('passes an existing persisted pitch to the pitch panel without inference', () => {
    const pitch: SpotifyPitchResponse = {
      status: 'READY',
      metadata_suggestions: { genres: ['Trance'], moods: ['Uplifting'], instruments: ['Synthesizer'] },
      editorial_pitch: 'Persisted exact pitch',
      editorial_positioning: ['Electronic'],
      why_this_pitch_works: ['Grounded in confirmed evidence.'],
      evidence_used: [{ type: 'genre', value: 'Trance', source: 'artist_confirmed' }],
      warnings: [],
    };
    fixture.componentRef.setInput('analysisState', 'success');
    fixture.componentRef.setInput('analysisId', '00000000-0000-4000-8000-000000000041');
    fixture.componentRef.setInput('persistedPitchResult', pitch);
    fixture.detectChanges();

    const child = fixture.debugElement.query(By.directive(SpotifyPitchStub))
      .componentInstance as SpotifyPitchStub;
    expect(child.analysisId).toBe('00000000-0000-4000-8000-000000000041');
    expect(child.persistedPitchResult).toBe(pitch);
  });
});
