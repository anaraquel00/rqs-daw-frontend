import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageService } from '../../services/language.service';
import { MasteringService } from '../../services/mastering.service';
import { AudioDnaPayload } from '../../services/mastering-types';
import { AudioDnaCardComponent } from './audio-dna-card';

const audioDna: AudioDnaPayload = {
  version: 'rqs-audio-dna-v1.1',
  status: 'available',
  source_sha256: 'a'.repeat(64),
  technical: {
    lufs_integrated: -14.87,
    true_peak_dbtp: -3.07,
    lra_lu: 4.7,
    rms_dbfs: -16.52,
    crest_factor_db: 13.45,
    duration_seconds: 285,
    brightness: 0.2332,
    warmth: 0.5511,
    transient_strength: 0.4124,
    stereo_width: 0.5617,
    low_end_density: 0.7958,
    harshness: 0.1778,
    dynamic_density: 0.0552,
    overall_energy: 0.5618,
  },
  music: {
    status: 'experimental',
    method: 'global_signal_heuristics_held_back_v1_1',
    bpm: {
      value: 63,
      confidence: 0.62,
      alternatives: [
        { value: 126, confidence: 0.62, relation: 'double_time' },
        { value: 42, confidence: 0.59, relation: 'competing_periodicity' },
      ],
      ambiguous: true,
      method: 'onset_autocorrelation_candidates_v1_1',
    },
    key: { value: 'D# minor', confidence: 0.33, status: 'experimental' },
    genres: [], genre_status: 'inconclusive', moods: [], mood_status: 'inconclusive',
    instruments: [], instrument_status: 'inconclusive',
    vocal: { status: 'inconclusive', presence: null, processed: null, method: 'unavailable_without_trained_vocal_classifier' },
    energy: 0.56, energy_status: 'technical_composite', danceability: 0.63, danceability_status: 'experimental',
  },
  master_profile: {
    atmosphere: 'aurora',
    character_intensity: 26,
    confidence: 0.57,
    confidence_level: 'medium',
    auto_configure: true,
    input_domain: 'technical_audio_dna_only',
    reasons: [{ code: 'MODERATE_ENERGY', weight: 0.89 }],
    atmosphere_dsp_behavior: 'profile_label_only_v2_compatibility_path',
  },
  release_assistant: {
    status: 'experimental', auto_populate: false, review_required: true, primary_genre: null,
    secondary_genres: [], moods: [], instruments: [], bpm: 63, bpm_ambiguous: true,
    key: 'D# minor', vocal_or_instrumental: 'inconclusive', energy: 0.56, danceability: 0.63,
    disclaimer: 'experimental_review_manually_not_for_automatic_publication',
  },
};

describe('AudioDnaCardComponent', () => {
  let fixture: ComponentFixture<AudioDnaCardComponent>;
  let mastering: MasteringService;
  const currentLang = signal<'en' | 'pt' | 'pl' | 'fr'>('en');

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioDnaCardComponent],
      providers: [
        MasteringService,
        { provide: LanguageService, useValue: { currentLang } },
      ],
    }).compileComponents();

    mastering = TestBed.inject(MasteringService);
    mastering.beginAudioSource('fixture-source');
    mastering.initializeFromAudioDna('fixture-source', audioDna.master_profile!);
    fixture = TestBed.createComponent(AudioDnaCardComponent);
    fixture.componentRef.setInput('state', 'success');
    fixture.componentRef.setInput('audioDna', audioDna);
    fixture.detectChanges();
  });

  it('renders the approved qualitative profile, ambiguous tempo and controlled semantic state', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('MASTER PROFILE SUGGESTED');
    expect(text).toContain('Aurora');
    expect(text).toContain('26%');
    expect(text).toContain('Medium');
    expect(text).toContain('RQS AUDIO DNA');
    expect(text).toContain('Warm / dark-leaning');
    expect(text).toContain('Strong');
    expect(text).toContain('Spacious');
    expect(text).toContain('Preserved');
    expect(text).toContain('Low');
    expect(text).toContain('Healthy');
    expect(text).toContain('63 BPM');
    expect(text).toContain('Possible double-time: 126 BPM');
    expect(text).toContain('MUSIC DNA');
    expect(text).toContain('Insufficient evidence');
    expect(text).not.toContain('Primary genre');
  });

  it('keeps Release Assistant experimental with no auto-population or publishing control', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('RELEASE ASSISTANT — EXPERIMENTAL');
    expect(text).toContain('not auto-populated');
    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .map((button) => (button as HTMLButtonElement).textContent ?? '').join(' ');
    expect(buttons).not.toContain('Apply');
    expect(buttons).not.toContain('Publish');
  });

  it('shows manual override and exposes an explicit reset without reapplying automatically', () => {
    mastering.setIntensityPercent(40);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('MANUAL OVERRIDE');
    expect(mastering.intensityPercent()).toBe(40);

    let resets = 0;
    fixture.componentInstance.resetRecommendation.subscribe(() => resets += 1);
    (fixture.nativeElement.querySelector('.dna-reset') as HTMLButtonElement).click();
    expect(resets).toBe(1);
  });

  it('keeps raw normalized values inside closed advanced details', () => {
    const details = fixture.nativeElement.querySelector('.advanced-details') as HTMLDetailsElement;
    expect(details.open).toBeFalse();
    expect(details.textContent).toContain('0.2332');
    expect(fixture.nativeElement.querySelector('.signal-grid')?.textContent).not.toContain('0.2332');
    expect(details.querySelector('summary')).toBeTruthy();
  });

  it('contains the card at every required content width', () => {
    const host = fixture.nativeElement as HTMLElement;
    host.style.display = 'block';
    for (const width of [360, 390, 412, 768, 1024, 1440]) {
      host.style.width = `${width}px`;
      fixture.detectChanges();
      const card = host.querySelector('.audio-dna') as HTMLElement;
      expect(card.scrollWidth).withContext(`${width}px Audio DNA overflow`).toBeLessThanOrEqual(card.clientWidth);
    }
  });
});
