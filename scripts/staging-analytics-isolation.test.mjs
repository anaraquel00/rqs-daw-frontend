import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [angularConfig, productionIndex, stagingIndex] = await Promise.all([
  readFile(new URL('../angular.json', import.meta.url), 'utf8').then(JSON.parse),
  readFile(new URL('../src/index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/index.staging.html', import.meta.url), 'utf8'),
]);

test('staging uses an index without commercial tag-manager bootstrap', () => {
  const staging = angularConfig.projects['rqs-daw'].architect.build.configurations.staging;

  assert.equal(staging.index, 'src/index.staging.html');
  assert.doesNotMatch(stagingIndex, /googletagmanager|GTM-/i);
});

test('production keeps the existing tag-manager bootstrap unchanged', () => {
  assert.match(productionIndex, /GTM-WXLSZXLD/);
  assert.match(productionIndex, /googletagmanager\.com/);
});
