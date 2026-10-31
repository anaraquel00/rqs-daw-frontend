import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { LanguageService, UiLanguage } from '../../services/language.service';
import { SeoService } from '../../services/seo.service';
import { TermsComponent } from './terms';

describe('TermsComponent platform modules', () => {
  const currentLang = signal<UiLanguage>('pt');

  beforeEach(async () => {
    currentLang.set('pt');
    await TestBed.configureTestingModule({
      imports: [TermsComponent],
      providers: [
        provideRouter([]),
        {
          provide: LanguageService,
          useValue: {
            currentLang,
            setLanguage: (language: UiLanguage) => currentLang.set(language),
          },
        },
        { provide: SeoService, useValue: { update: jasmine.createSpy('update') } },
      ],
    }).compileComponents();
  });

  function sectionSix(language: UiLanguage) {
    currentLang.set(language);
    const fixture = TestBed.createComponent(TermsComponent);
    fixture.detectChanges();

    const container = fixture.nativeElement.querySelector('.terms-container') as HTMLElement;
    const children = Array.from(container.children) as HTMLElement[];
    const start = children.findIndex(element => element.tagName === 'H2' && element.textContent?.trim().startsWith('6.'));
    const end = children.findIndex((element, index) => index > start && element.tagName === 'H2');
    const elements = children.slice(start, end);

    return {
      fixture,
      headings: elements.filter(element => element.tagName === 'H3').map(element => element.textContent?.trim()),
      text: elements.map(element => element.textContent?.trim()).join(' '),
    };
  }

  it('renders MASTER, PITCH, BUILD and DEPLOY / UPLINK in the canonical order for every language', () => {
    for (const language of ['pt', 'en', 'pl', 'fr'] as UiLanguage[]) {
      const rendered = sectionSix(language);
      expect(rendered.headings).toEqual([
        '6.1. MASTER — RQS DSP Core',
        '6.2. PITCH — AI Release Intelligence',
        '6.3. BUILD — RQS Setlist Engine',
        '6.4. DEPLOY — RQS Uplink',
      ]);
      rendered.fixture.destroy();
    }
  });

  it('preserves the required PITCH legal claims in PT-BR, EN, PL and FR', () => {
    const requiredClaims: Record<UiLanguage, string[]> = {
      pt: ['assistivas', 'imprecisões', 'revisar, confirmar', 'confirmadas pelo artista', 'não garante identificação perfeita', 'não realiza submissões automáticas', 'não garante inclusão em playlists editoriais', 'não representa afiliação', 'permanece responsável'],
      en: ['assistive', 'inaccuracies', 'review, confirm', 'confirmed by the artist', 'does not guarantee perfect identification', 'does not make automatic submissions', 'does not guarantee inclusion in editorial playlists', 'does not represent affiliation', 'remains responsible'],
      pl: ['charakter pomocniczy', 'nieścisłości', 'przejrzeć, potwierdzić', 'potwierdzone przez artystę', 'nie gwarantuje bezbłędnego rozpoznania', 'nie dokonuje automatycznych zgłoszeń', 'nie gwarantuje umieszczenia na playlistach redakcyjnych', 'nie oznacza powiązania', 'pozostaje odpowiedzialny'],
      fr: ['à titre d’assistance', 'imprécisions', 'examiner, confirmer', 'confirmées par l’artiste', 'ne garantit pas l’identification parfaite', 'n’effectue aucune soumission automatique', 'ne garantit aucune inclusion dans des playlists éditoriales', 'ne constitue aucune affiliation', 'reste responsable'],
    };

    for (const language of ['pt', 'en', 'pl', 'fr'] as UiLanguage[]) {
      const rendered = sectionSix(language);
      for (const claim of requiredClaims[language]) expect(rendered.text).toContain(claim);
      expect(rendered.text).toContain('Spotify');
      expect(rendered.text).not.toMatch(/OpenAI|GPT|quota|canary|Audio DNA/i);
      rendered.fixture.destroy();
    }
  });
});
