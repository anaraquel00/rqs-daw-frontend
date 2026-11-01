import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootUrl = new URL('../', import.meta.url);
const canonicalOrigin = 'https://studio.raquelsynths.com';
const uplinkHost = 'go.raquelsynths.com';

const readProjectFile = async (path) => readFile(new URL(path, rootUrl), 'utf8');

const extractQuotedValues = (source) => [...source.matchAll(/'([^']*)'/g)].map((match) => match[1]);

async function actualStudioRoutes() {
  const [appRoutesSource, studioRoutesSource] = await Promise.all([
    readProjectFile('src/app/app.routes.ts'),
    readProjectFile('src/app/studio/studio.routes.ts'),
  ]);

  const topLevelPaths = [...appRoutesSource.matchAll(/\bpath:\s*'([^']*)'/g)]
    .map((match) => match[1])
    .filter((path) => path !== '**');
  const surfacesExpression = studioRoutesSource.match(/\.\.\.\[([^\]]+)\]\.map\(surface/);

  assert.ok(surfacesExpression, 'Studio surfaces must remain discoverable from studio.routes.ts');

  const studioSurfaces = extractQuotedValues(surfacesExpression[1]);
  const paths = new Set(topLevelPaths.map((path) => path ? `/${path}` : '/'));

  for (const surface of studioSurfaces) {
    paths.add(`/app/${surface}`);
  }

  return { paths, studioSurfaces };
}

test('go host redirects every actual Studio route with exact permanent rules', async () => {
  const [{ paths }, vercelSource] = await Promise.all([
    actualStudioRoutes(),
    readProjectFile('vercel.json'),
  ]);
  const vercelConfig = JSON.parse(vercelSource);
  const redirects = vercelConfig.redirects ?? [];
  const redirectSources = new Set(redirects.map((redirect) => redirect.source));

  assert.deepEqual(redirectSources, paths);
  assert.equal(redirects.length, paths.size);

  for (const redirect of redirects) {
    assert.equal(redirect.permanent, true, `${redirect.source} must use HTTP 308 semantics`);
    assert.equal(redirect.destination, `${canonicalOrigin}${redirect.source}`);
    assert.deepEqual(redirect.has, [{ type: 'host', value: uplinkHost }]);
    assert.doesNotMatch(redirect.source, /\*|\(\.\*\)|:path/);
  }
});

test('unmatched go paths still reach the existing Supabase resolver', async () => {
  const vercelConfig = JSON.parse(await readProjectFile('vercel.json'));

  assert.deepEqual(vercelConfig.rewrites, [{
    has: [{ type: 'host', value: uplinkHost }],
    source: '/(.*)',
    destination: 'https://ucearnthodrltkvkmhit.supabase.co/functions/v1/rqs-router/$1',
  }]);
});

test('reserved Uplink slugs cover router namespaces and infrastructure paths', async () => {
  const [{ paths, studioSurfaces }, migrationSource] = await Promise.all([
    actualStudioRoutes(),
    readProjectFile('supabase/review/uplink_canonical_host_reserved_slugs_migration.sql'),
  ]);
  const reservedExpression = migrationSource.match(
    /v_reserved_slugs constant text\[\] := array\[([^\]]+)\]/,
  );

  assert.ok(reservedExpression, 'Reserved slugs must remain explicit in the RPC migration');

  const reservedSlugs = new Set(extractQuotedValues(reservedExpression[1]));
  const routeNamespaces = [...paths]
    .map((path) => path.split('/').filter(Boolean)[0])
    .filter(Boolean);
  const infrastructureAndAuthNamespaces = [
    'admin',
    'api',
    'assets',
    'login',
    'rqs-router',
    'robots.txt',
    'signin',
    'signup',
    'sitemap.xml',
    'workspace',
  ];

  for (const slug of new Set([
    ...routeNamespaces,
    ...studioSurfaces,
    ...infrastructureAndAuthNamespaces,
  ])) {
    assert.ok(reservedSlugs.has(slug), `${slug} must be reserved from Uplink creation`);
  }
});
