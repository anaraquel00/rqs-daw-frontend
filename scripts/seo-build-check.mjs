import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = 'dist/rqs-daw/browser';
const routes = ['', 'app', 'master/online', 'pricing', 'contact', 'terms', 'privacy', 'cookies'];
const expected = {
  '': {
    title: 'RQS Studio | Online Music Mastering for Independent Artists',
    robots: 'index, follow',
    canonical: 'https://studio.raquelsynths.com/'
  },
  app: {
    title: 'RQS Studio Apps | Online Mastering, Stems, Setlists & Music Links',
    robots: 'index, follow',
    canonical: 'https://studio.raquelsynths.com/app'
  },
  'master/online': {
    title: 'Online Music Mastering | RQS MASTER',
    robots: 'index, follow',
    canonical: 'https://studio.raquelsynths.com/master/online'
  },
  pricing: { robots: 'index, follow', canonical: 'https://studio.raquelsynths.com/pricing' },
  contact: { robots: 'index, follow', canonical: 'https://studio.raquelsynths.com/contact' },
  terms: { robots: 'index, follow', canonical: 'https://studio.raquelsynths.com/terms' },
  privacy: { robots: 'index, follow', canonical: 'https://studio.raquelsynths.com/privacy' },
  cookies: { robots: 'index, follow', canonical: 'https://studio.raquelsynths.com/cookies' }
};

for (const route of routes) {
  const file = route ? path.join(root, route, 'index.html') : path.join(root, 'index.html');
  assert.equal(fs.existsSync(file), true, 'missing prerendered route ' + (route || '/'));
  const html = fs.readFileSync(file, 'utf8');
  const title = ((html.match(/<title>([^<]*)<\/title>/) ?? [])[1] ?? "").replaceAll("&amp;", "&");
  const robots = (html.match(/<meta name="robots" content="([^"]*)"/) ?? [])[1] ?? '';
  const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) ?? [])[1] ?? '';
  assert.match(html, /<meta name="description" content="[^"]+"/);
  assert.match(html, /<meta property="og:title" content="[^"]+"/);
  assert.match(html, /<meta name="twitter:title" content="[^"]+"/);
  if (expected[route].title) assert.equal(title, expected[route].title, 'wrong title for ' + (route || '/'));
  assert.equal(robots, expected[route].robots, 'wrong robots for ' + (route || '/'));
  assert.equal(canonical, expected[route].canonical, 'wrong canonical for ' + (route || '/'));
  assert.equal((html.match(/rel="canonical"/g) ?? []).length, 1, 'duplicate canonical for ' + (route || '/'));
  assert.equal((html.match(/name="robots"/g) ?? []).length, 1, 'duplicate robots for ' + (route || '/'));
}

const appHtml = fs.readFileSync(path.join(root, 'app', 'index.html'), 'utf8');
for (const label of ['MASTER', 'SPLIT', 'BUILD', 'UPLINK']) {
  assert.match(appHtml, new RegExp('>' + label + '<'), 'prerendered /app must contain ' + label);
}
assert.match(appHtml, /application\/ld\+json/);
assert.match(appHtml, /WebApplication/);
assert.doesNotMatch(appHtml, /WebSite/);
const landingHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.match(landingHtml, /WebSite/);
assert.doesNotMatch(landingHtml, /WebApplication/);
assert.doesNotMatch(appHtml, /<app-root><\/app-root>/);

const masterLandingHtml = fs.readFileSync(path.join(root, 'master', 'online', 'index.html'), 'utf8');
assert.match(masterLandingHtml, /RQS MASTER/);
assert.match(masterLandingHtml, /WebApplication/);
assert.match(masterLandingHtml, /Master my music/);

console.log('SEO build checks passed.');
