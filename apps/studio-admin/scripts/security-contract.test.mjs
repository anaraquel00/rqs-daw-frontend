import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = path =>
  readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('every admin route has static and runtime noindex protection', async () => {
  const [index, vercel, seo] = await Promise.all([
    read('src/index.html'),
    read('vercel.json'),
    read('src/app/core/admin-seo.service.ts'),
  ]);

  assert.match(index, /noindex, nofollow, noarchive/);
  assert.match(index, /https:\/\/studio-admin\.raquelsynths\.com\//);
  assert.match(vercel, /X-Robots-Tag/);
  assert.match(vercel, /frame-ancestors 'none'/);
  assert.match(seo, /noindex, nofollow, noarchive/);
});

test('client sources never contain privileged secret identifiers or inline authorization', async () => {
  const files = await Promise.all([
    read('src/app/core/admin-auth.service.ts'),
    read('src/app/core/admin-api.service.ts'),
    read('src/app/core/admin-access.guard.ts'),
  ]);

  const client = files.join('\n');

  assert.doesNotMatch(
    client,
    /SUPABASE_SERVICE_ROLE_KEY|private_key|serviceAccountEmail/,
  );
  assert.doesNotMatch(client, /email\s*===/);
  assert.match(client, /\/api\/admin\/me/);
});

test('CORS is environment allowlisted without wildcard Vercel origins', async () => {
  const http = await read('api/_http.mjs');

  assert.match(http, /ADMIN_ALLOWED_ORIGINS/);
  assert.doesNotMatch(
    http,
    /\*\.vercel\.app|\[a-z0-9-\]\+\\\.vercel/,
  );
});

test('membership migration defines dedicated RBAC roles and no commercial plan roles', async () => {
  const migration = await read(
    '../../supabase/review/studio_admin_memberships_migration.sql',
  );

  assert.match(migration, /'owner', 'operator', 'analyst'/);
  assert.doesNotMatch(
    migration,
    /commercial_admin|premium|master|plus|pro/,
  );
});

test('Admin and Referral Firestore namespaces are structurally isolated', async () => {
  const [environment, admin, referral, isolation, overview, summary] =
    await Promise.all([
      read('api/_firestore-environment.mjs'),
      read('api/_firestore-admin.mjs'),
      read('api/_firestore-referral.mjs'),
      read('api/_firestore-isolation.mjs'),
      read('api/admin/overview.js'),
      read('api/admin/waitlist/summary.js'),
    ]);

  assert.match(environment, /rqs-studio-admin-staging/);
  assert.match(environment, /rqs-studio-admin-prod/);
  assert.match(environment, /rqs-referral-staging/);
  assert.match(environment, /rqs-referral-preview/);

  assert.match(admin, /GCP_ADMIN_FIRESTORE_DATABASE_ID/);
  assert.doesNotMatch(
    admin,
    /pro_waitlist|founding_referral_participants/,
  );

  assert.match(referral, /GCP_REFERRAL_FIRESTORE_DATABASE_ID/);
  assert.match(referral, /countReferralDocuments/);
  assert.match(referral, /pro_waitlist/);
  assert.match(referral, /founding_referral_participants/);
  assert.match(referral, /runAggregationQuery/);

  assert.doesNotMatch(
    referral,
    /createDocument|updateDocument|deleteDocument/,
  );

  assert.match(
    isolation,
    /admin\.databaseId === referral\.databaseId/,
  );

  assert.match(overview, /countReferralDocuments/);
  assert.match(summary, /countReferralDocuments/);
});

test('Studio Admin uses an explicit two-environment fail-closed contract', async () => {
  const environment = await read('api/_firestore-environment.mjs');

  assert.match(environment, /staging:/);
  assert.match(environment, /production:/);
  assert.match(environment, /vercelEnvironment: 'preview'/);
  assert.match(environment, /vercelEnvironment: 'production'/);
  assert.match(environment, /rqs-vercel-preview/);
  assert.match(environment, /rqs-vercel-production/);
  assert.match(environment, /rqs-studio-admin-preview/);
  assert.match(environment, /rqs-studio-admin-production/);

  assert.doesNotMatch(
    environment,
    /environment.*development|development.*environment/i,
  );
});

test('Production Git auto-deploy remains blocked', async () => {
  const vercel = await read('vercel.json');

  assert.match(
    vercel,
    /"feat\/studio-admin-foundation"\s*:\s*true/,
  );

  assert.doesNotMatch(
    vercel,
    /"main"\s*:\s*true/,
  );

  assert.match(
    vercel,
    /"\*\*"\s*:\s*false/,
  );
});

test('GCP identity is validated before OIDC token exchange', async () => {
  const oidc = await read('api/_gcp-oidc.mjs');

  const configurationIndex = oidc.indexOf(
    'export function gcpOidcConfiguration',
  );
  const tokenIndex = oidc.indexOf(
    'export async function gcpOidcAccessToken',
  );

  assert.ok(configurationIndex >= 0);
  assert.ok(tokenIndex > configurationIndex);

  assert.match(oidc, /gcpPoolId/);
  assert.match(oidc, /gcpProviderId/);
  assert.match(oidc, /gcpServiceAccountEmail/);
  assert.match(oidc, /getVercelOidcToken/);

  assert.doesNotMatch(
    oidc,
    /GOOGLE_APPLICATION_CREDENTIALS|private_key|client_email/,
  );
});
