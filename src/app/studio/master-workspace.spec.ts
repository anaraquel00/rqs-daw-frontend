import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { StudioShellComponent } from './studio-shell';
import { STUDIO_ROUTES } from './studio.routes';
import { UploadZoneComponent } from '../components/upload-zone/upload-zone';
import { MasteringPanelComponent } from '../components/mastering-panel/mastering-panel';
import { PreviewWaveformComponent } from '../components/mastering-panel/preview-waveform';
import { AuthPromptComponent } from '../components/auth-prompt/auth-prompt';
import { EkgMonitorComponent } from '../components/ekg-monitor/ekg-monitor';
import { AuthService } from '../services/auth.service';
import { DspService } from '../services/dsp';
import { AudioComparisonService } from '../services/audio-comparison.service';
import { AnalyticsService } from '../services/analytics.service';
import { CookieConsentService } from '../services/cookie-consent.service';
import { LanguageService } from '../services/language.service';
import { MasteringService } from '../services/mastering.service';

@Component({selector: 'app-auth-prompt', template: ''}) class AuthPromptStub {}
@Component({selector: 'app-ekg-monitor', inputs: ['audioUrl'], template: ''}) class ResultMeterStub {}

// Real shell/upload/panel/waveform and request state; only external boundaries are mocked.
const target = {target_lufs: -14, min_lufs: -16, max_lufs: -10, true_peak_ceiling_dbtp: -1.2,
  min_plr_lu: 9, min_lra_retention: .85, max_crest_loss_db: 1.5, policy_source: 'local-test'};
const capabilities = {engine: 'rqs-core-mastering-v2', destinations: {
  streaming: {platforms: Object.fromEntries(['spotify','apple_music','youtube','soundcloud','generic'].map(p => [p, {standard: target, loud: target}]))},
  club: {target}, festival: {target},
}};
function sourceFile(): File {
  const bytes = new ArrayBuffer(44 + 8000 * 2);
  const v = new DataView(bytes);
  const text = (at: number, value: string) => [...value].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF'); v.setUint32(4, bytes.byteLength - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true); v.setUint32(24,8000,true);
  v.setUint32(28,16000,true); v.setUint16(32,2,true); v.setUint16(34,16,true); text(36,'data'); v.setUint32(40,16000,true);
  return new File([bytes], 'local-source.wav', {type:'audio/wav'});
}

describe('Studio MASTER full-width integration', () => {
  let harness: RouterTestingHarness;
  let upload: UploadZoneComponent;
  let audio: any;
  let auth: any;
  let dsp: any;
  let commands: jasmine.Spy;
  const root = () => harness.routeNativeElement!;
  const panel = () => harness.fixture.debugElement.query(By.directive(MasteringPanelComponent)).componentInstance as MasteringPanelComponent;
  const button = (text: string) => Array.from(root().querySelectorAll('button')).find(b => b.textContent?.trim() === text)!;
  const selectFile = async () => {
    const input = root().querySelector('input[type=file]') as HTMLInputElement;
    const transfer = new DataTransfer(); transfer.items.add(sourceFile()); input.files = transfer.files;
    input.dispatchEvent(new Event('change', {bubbles: true}));
    harness.detectChanges(); await harness.fixture.whenStable(); harness.detectChanges();
    commands = spyOn(upload, 'processarMaster');
  };
  beforeEach(async () => {
    auth = {session: signal({user:{id:'test-owner'}}), isLoggedIn: signal(true), isPremium: signal(false),
      canMaster: signal(true), remainingMasters: signal(3), reselectAudioRequired: signal(false),
      requestSignIn: jasmine.createSpy(), logout: jasmine.createSpy(), refreshProfile: jasmine.createSpy()};
    audio = {previewStart:signal(0), previewEnd:signal(15), previewStatus:signal('not-generated'),
      playbackMode:signal('full-track'), activeVariant:signal('original'), currentTime:signal(0), duration:signal(60),
      displayCurrentTime:signal(0), displayDuration:signal(60), canUseMaster:signal(false), isPlaying:signal(false),
      audioProcessed:signal(false), processedFilename:signal(''), setOriginalSrc:jasmine.createSpy(), setMasterSrc:jasmine.createSpy(),
      resetAll:jasmine.createSpy(), togglePlayback:jasmine.createSpy().and.resolveTo(), stopAndReset:jasmine.createSpy(),
      switchVariant:jasmine.createSpy().and.resolveTo(), seek:jasmine.createSpy(),
      setPreviewStart:(n:number) => {audio.previewStart.set(n); audio.previewEnd.set(n+15);},
      clearMasterSrc:() => {audio.canUseMaster.set(false); audio.previewStatus.set('not-generated');}};
    dsp = {getMasteringV2Capabilities: jasmine.createSpy().and.returnValue(of(capabilities)),
      getMasteringV2PresignedUrl: jasmine.createSpy().and.returnValue(of({uploadUrl:'https://example.invalid/local', s3Key:'test-only'})),
      uploadToS3: jasmine.createSpy().and.returnValue(of({})),
      analyzeMasteringV2: jasmine.createSpy().and.returnValue(of({integrated_lufs:-14,true_peak_dbtp:-1.3,
        rms_dbfs:-18,crest_factor_db:8,loudness_range_lu:5,duration_seconds:60}))};
    TestBed.configureTestingModule({providers:[provideRouter([{path:'studio',children:STUDIO_ROUTES}]),
      {provide:AuthService,useValue:auth}, {provide:AudioComparisonService,useValue:audio}, {provide:DspService,useValue:dsp},
      {provide:AnalyticsService,useValue:{trackEvent:jasmine.createSpy()}},
      {provide:CookieConsentService,useValue:{openPreferences:jasmine.createSpy()}}]});
    TestBed.overrideComponent(StudioShellComponent,{remove:{imports:[AuthPromptComponent]},add:{imports:[AuthPromptStub]}});
    TestBed.overrideComponent(UploadZoneComponent,{remove:{imports:[EkgMonitorComponent]},add:{imports:[ResultMeterStub]}});
    TestBed.inject(LanguageService).setLanguage('en');
    harness = await RouterTestingHarness.create('/studio');
    document.body.appendChild(harness.fixture.nativeElement);
    harness.detectChanges();
    (root().querySelector('#module-master') as HTMLAnchorElement).click();
    await harness.fixture.whenStable(); harness.detectChanges();
    upload = harness.fixture.debugElement.query(By.directive(UploadZoneComponent)).componentInstance;
  });
  afterEach(() => { harness?.fixture.nativeElement.remove(); });

  it('opens the real MASTER alone at full content width and returns without remounting the source', async () => {
    expect(TestBed.inject(Router).url).toBe('/studio/master');
    expect(root().querySelectorAll('section:not([hidden])').length).toBe(1);
    const section = root().querySelector('.master-workspace')!;
    const glass = section.querySelector('.glass-panel')!;
    expect(glass.getBoundingClientRect().width).toBeCloseTo(section.getBoundingClientRect().width, 0);
    if (window.innerWidth >= 1100) expect(glass.getBoundingClientRect().width).toBeGreaterThan(600);
    expect(root().querySelector('app-mix-panel')).toBeNull();
    await selectFile();
    const file = upload.selectedFile;
    (root().querySelector('.studio-navigation a') as HTMLAnchorElement).click();
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/studio');
    expect((section as HTMLElement).hidden).toBeTrue();
    (root().querySelector('#module-master') as HTMLAnchorElement).click();
    await harness.fixture.whenStable(); harness.detectChanges();
    expect(harness.fixture.debugElement.query(By.directive(UploadZoneComponent)).componentInstance).toBe(upload);
    expect(upload.selectedFile).toBe(file);
  });
  it('reflows real controls and keeps content within the desktop/mobile viewport', async () => {
    await selectFile();
    expect(window.innerWidth).toBeGreaterThan(0);
    console.info('MASTER_LAYOUT_VIEWPORT', window.innerWidth, window.innerHeight);
    const grid = root().querySelector('.controls-section')!;
    expect(getComputedStyle(grid).gridTemplateColumns.split(' ').length).toBe(window.innerWidth >= 1100 ? 2 : 1);
    for (const element of Array.from(root().querySelectorAll('.glass-panel,.drop-zone,.mastering-board,.waveform-host,.analyzer,.metric-grid,.metric,.control-group,.action-buttons button'))) {
      const r = element.getBoundingClientRect();
      expect(r.width).toBeGreaterThan(0); expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.right).toBeLessThanOrEqual(window.innerWidth + 1);
    }
    expect(root().querySelector('header')).not.toBeNull(); expect(root().querySelector('footer')).not.toBeNull();
  });
  it('preserves upload, actual waveform bindings, range selection and Play/Stop/A-B wiring', async () => {
    await selectFile();
    expect(upload.selectedFile?.name).toBe('local-source.wav');
    expect(audio.setOriginalSrc).toHaveBeenCalled();
    expect(dsp.analyzeMasteringV2).toHaveBeenCalledTimes(1);
    expect(root().querySelector('[data-testid=analysis-success]')).not.toBeNull();
    expect(root().querySelector('[data-testid=overall-status]')?.textContent).toContain('WITHIN DELIVERY RANGE');
    const waveform = harness.fixture.debugElement.query(By.directive(PreviewWaveformComponent)).componentInstance as PreviewWaveformComponent;
    expect(waveform.file).toBe(upload.selectedFile);
    expect(root().querySelector('canvas')).not.toBeNull();
    waveform.rangeStartChange.emit(10); harness.detectChanges();
    expect(audio.previewStart()).toBe(10);
    button('▶ PLAY').click(); expect(audio.togglePlayback).toHaveBeenCalled();
    button('■ STOP').click(); expect(audio.stopAndReset).toHaveBeenCalled();
    audio.canUseMaster.set(true); harness.detectChanges();
    (root().querySelectorAll('.ab-btn')[1] as HTMLButtonElement).click();
    await harness.fixture.whenStable(); expect(audio.switchVariant).toHaveBeenCalledWith('master');
    (root().querySelectorAll('.ab-btn')[0] as HTMLButtonElement).click();
    await harness.fixture.whenStable(); expect(audio.switchVariant).toHaveBeenCalledWith('original');
  });
  it('keeps destination/platform, Atmosphere/Intensity and requested LUFS connected to existing request state', async () => {
    await selectFile();
    const state = TestBed.inject(MasteringService);
    button('Club').click(); harness.detectChanges(); expect(state.destination()).toBe('club'); expect(state.platform()).toBeNull();
    button('Streaming').click(); harness.detectChanges(); button('YouTube').click(); harness.detectChanges(); expect(state.platform()).toBe('youtube');
    button('Aurora').click(); harness.detectChanges(); expect(state.atmosphere()).toBe('aurora');
    const intensity = root().querySelector('input[aria-label="Mastering V2 intensity"]') as HTMLInputElement;
    intensity.value='72'; intensity.dispatchEvent(new Event('input')); harness.detectChanges(); expect(state.intensityPercent()).toBe(72);
    const lufs = root().querySelector('input[type=number]') as HTMLInputElement;
    lufs.value='-13'; lufs.dispatchEvent(new Event('input')); harness.detectChanges(); expect(state.requestedLufs()).toBe(-13);
    expect(root().querySelector('.policy-card')!.textContent).toContain('-14 LUFS');
    button('Use policy default').click(); harness.detectChanges(); expect(state.requestedLufs()).toBeNull();
    (root().querySelector('.guide-button') as HTMLButtonElement).click(); harness.detectChanges();
    expect(root().querySelector('.mastering-guide')).not.toBeNull();
  });
  it('preserves Preview/Full command distinction, selected range and result download', async () => {
    await selectFile();
    audio.previewStart.set(10); audio.previewEnd.set(25); harness.detectChanges();
    (root().querySelector('.action-buttons .btn-secondary') as HTMLButtonElement).click();
    expect(commands.calls.mostRecent().args[0].preview).toBeTrue();
    expect(commands.calls.mostRecent().args[0].previewStartSeconds).toBe(10);
    audio.canUseMaster.set(true); audio.playbackMode.set('preview-15s'); audio.previewStatus.set('ready'); harness.detectChanges();
    const full = root().querySelector('.action-buttons .btn-process') as HTMLButtonElement;
    expect(full.disabled).toBeFalse(); full.click(); expect(commands.calls.mostRecent().args[0].preview).toBeFalse();
    upload.processedAudioUrl='https://example.invalid/local-result.wav'; upload.processedAudioName='master.wav'; upload.isFullMasterCompleted=true;
    harness.detectChanges();
    const download=root().querySelector('a.btn-download')!;
    expect(download.getAttribute('download')).toBe('master.wav');
    expect(download.getAttribute('href')).toBe(upload.processedAudioUrl);
  });
  it('preserves quota restrictions and clears the retained source when identity changes', async () => {
    await selectFile();
    audio.canUseMaster.set(true); audio.playbackMode.set('preview-15s'); audio.previewStatus.set('ready');
    auth.canMaster.set(false); auth.remainingMasters.set(0); harness.detectChanges();
    expect(root().querySelector('.action-buttons .btn-process')).toBeNull();
    expect(root().querySelector('.plan-usage-badge')!.textContent).toContain('0 / 3');
    auth.isPremium.set(true); auth.canMaster.set(true); harness.detectChanges();
    expect((root().querySelector('.action-buttons .btn-process') as HTMLButtonElement).disabled).toBeFalse();
    auth.session.set({user:{id:'other-owner'}}); harness.detectChanges(); await harness.fixture.whenStable(); harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/studio'); expect(root().querySelector('app-upload-zone')).toBeNull();
  });
  it('retains loading and failure surfaces without allowing control changes during processing', async () => {
    await selectFile(); upload.isProcessing=true; upload.processingMode='preview'; harness.detectChanges();
    expect(root().querySelector('.mastering-live-status')).not.toBeNull(); expect(button('Club').disabled).toBeTrue();
    upload.isProcessing=false; upload.masteringFeedback.set('preview_failed'); harness.detectChanges();
    expect(root().querySelector('.mastering-feedback[role=alert]')).not.toBeNull(); expect(button('Club').disabled).toBeFalse();
  });
});
