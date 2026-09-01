import { UiLanguage } from './services/language.service';
import { landingSeoConfig } from './landing-page/landing-page';
import { pricingSeoConfig } from './pricing-page/pricing-page';

describe('V1 Gate 140 public metadata contract', () => {
  const languages: UiLanguage[] = ['en', 'pt', 'pl', 'fr'];
  const unavailableFeature = /\bstems?\b|\bsplit\b|\bdemucs\b/i;

  for (const language of languages) {
    it(`keeps landing SEO and JSON-LD within current V1 scope for ${language}`, () => {
      const metadata = JSON.stringify(landingSeoConfig(language));

      expect(metadata).not.toMatch(unavailableFeature);
      expect(metadata).toContain('RQS Studio');
      expect(metadata).toMatch(/setlist/i);
      expect(metadata).toMatch(/uplink/i);
    });

    it(`keeps pricing SEO within current V1 scope for ${language}`, () => {
      const metadata = JSON.stringify(pricingSeoConfig(language));

      expect(metadata).not.toMatch(unavailableFeature);
      expect(metadata).toContain('RQS Studio');
      expect(metadata).toMatch(/setlist/i);
      expect(metadata).toMatch(/uplink/i);
    });
  }
});
