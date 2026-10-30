import assert from 'node:assert/strict';
import fs from 'node:fs';

const sitemap = fs.readFileSync('public/sitemap.xml', 'utf8');
const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);
const expected = [
  'https://studio.raquelsynths.com/',
  'https://studio.raquelsynths.com/app',
  'https://studio.raquelsynths.com/master/online',
  'https://studio.raquelsynths.com/pricing',
  'https://studio.raquelsynths.com/contact',
  'https://studio.raquelsynths.com/terms',
  'https://studio.raquelsynths.com/privacy',
  'https://studio.raquelsynths.com/cookies'
];

assert.deepEqual(urls, expected, 'sitemap must contain exactly the public discovery/trust URLs');
for (const path of ['/app/master', '/app/split', '/app/build', '/app/uplink', '/app/learn', '/app/account', '/pitch', '/legacy']) {
  assert.equal(urls.includes('https://studio.raquelsynths.com' + path), false, 'sitemap must exclude ' + path);
}

const selector = fs.readFileSync('src/app/studio/module-selector.ts', 'utf8');
assert.match(selector, /id: 'master'[\s\S]*id: 'pitch'[\s\S]*id: 'build'[\s\S]*id: 'uplink'/);
assert.match(selector, /id: 'pitch'[\s\S]*route: '\/pitch'[\s\S]*AI RELEASE INTELLIGENCE/);
assert.doesNotMatch(selector, /id: 'split'/);
assert.doesNotMatch(selector, /Direct uplink to streaming services|worldwide deployment|DISTRIBUTION ENGINE/);
assert.match(selector, /smart music link[\s\S]*streaming destinations/);

console.log('SEO static checks passed.');
