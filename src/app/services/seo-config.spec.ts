import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { landingSeoConfig } from '../landing-page/landing-page';
import { studioSeoConfig, StudioSurface } from '../studio/studio-seo';
import { SeoService } from './seo.service';

describe('RQS Studio SEO configuration', () => {
  const appRoutes: StudioSurface[] = ['master', 'build', 'uplink', 'split', 'learn', 'account'];
  let seo: SeoService;
  let title: Title;
  let meta: Meta;

  beforeEach(() => {
    document.head.querySelectorAll('meta, link[rel="canonical"], script#rqs-seo-jsonld')
      .forEach(element => element.remove());
    TestBed.configureTestingModule({ providers: [SeoService, Title, Meta] });
    seo = TestBed.inject(SeoService);
    title = TestBed.inject(Title);
    meta = TestBed.inject(Meta);
  });

  it('uses the deterministic English landing SEO defaults', () => {
    const config = landingSeoConfig('en');

    expect(config.title).toBe('RQS Studio | Online Music Mastering for Independent Artists');
    expect(config.description).toBe('Master your track online in the browser with RQS MASTER. Free Public Beta for independent musicians, producers and AI-assisted music creators.');
    expect(config.url).toBe('https://studio.raquelsynths.com/');
    expect(config.robots).toBe('index, follow');
  });

  it('uses indexable app discovery SEO and truthful WebApplication data', () => {
    const config = studioSeoConfig('home', 'en');

    expect(config.title).toBe('RQS Studio Apps | Online Mastering, Stems, Setlists & Music Links');
    expect(config.description).toBe('Explore RQS Studio tools for independent musicians and producers: browser-based mastering, stem separation preview, continuous setlist building and smart music links.');
    expect(config.url).toBe('https://studio.raquelsynths.com/app');
    expect(config.robots).toBe('index, follow');
    expect(config.jsonLd).toEqual(jasmine.objectContaining({
      '@type': 'WebApplication',
      name: 'RQS Studio',
      applicationCategory: 'MultimediaApplication',
      operatingSystem: 'Web',
      url: 'https://studio.raquelsynths.com/app'
    }));
    expect(JSON.stringify(config.jsonLd)).toContain('not available in Public Beta');
  });

  it('marks every operational workspace noindex, follow except account', () => {
    for (const route of appRoutes) {
      const config = studioSeoConfig(route, 'en');
      expect(config.url).toBe('https://studio.raquelsynths.com/app/' + route);
      expect(config.robots).toBe(route === 'account' ? 'noindex, nofollow' : 'noindex, follow');
      expect(config.jsonLd).toBeUndefined();
    }
  });

  it('restores app metadata after an app-to-workspace-to-app transition', () => {
    seo.update(studioSeoConfig('home', 'en'));
    seo.update(studioSeoConfig('master', 'en'));

    expect(title.getTitle()).toBe('RQS Studio MASTER | Online Music Mastering');
    expect(meta.getTag('name="robots"')?.content).toBe('noindex, follow');
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href)
      .toBe('https://studio.raquelsynths.com/app/master');
    expect(document.getElementById('rqs-seo-jsonld')).toBeNull();

    seo.update(studioSeoConfig('home', 'en'));

    expect(title.getTitle()).toBe('RQS Studio Apps | Online Mastering, Stems, Setlists & Music Links');
    expect(meta.getTag('name="robots"')?.content).toBe('index, follow');
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href)
      .toBe('https://studio.raquelsynths.com/app');
    expect(document.querySelectorAll('link[rel="canonical"]').length).toBe(1);
    expect(document.querySelectorAll('meta[name="robots"]').length).toBe(1);
    expect(document.getElementById('rqs-seo-jsonld')).not.toBeNull();
  });
});
