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

test('Studio Admin disables automatic Git deployments and preserves required SPA routes', async () => {
  const vercel = JSON.parse(await read('vercel.json'));

  assert.equal(
    vercel.git?.deploymentEnabled,
    false,
  );

  assert.ok(
    vercel.rewrites?.some(
      rewrite =>
        rewrite.source === '/referrals' &&
        rewrite.destination === '/index.html',
    ),
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
  assert.match(oidc, /IdentityPoolClient/);
  assert.match(oidc, /subject_token_supplier/);

  assert.doesNotMatch(
    oidc,
    /ExternalAccountClient|\.fromJSON\(/,
  );

  assert.doesNotMatch(
    oidc,
    /GOOGLE_APPLICATION_CREDENTIALS|private_key|client_email/,
  );
});


test('Phase 2 record endpoints stay read-only and contain no privileged credential path', async () => {
  const [referral, waitlistRecords, referralSummary, referralRecords] =
    await Promise.all([
      read('api/_firestore-referral.mjs'),
      read('api/admin/waitlist/records.js'),
      read('api/admin/referrals/summary.js'),
      read('api/admin/referrals/records.js'),
    ]);

  const phase2 = [
    referral,
    waitlistRecords,
    referralSummary,
    referralRecords,
  ].join('\n');

  assert.match(referral, /runQuery/);
  assert.match(referral, /runAggregationQuery/);
  assert.match(referral, /PAGE_SIZE_MAX\s*=\s*50/);
  assert.match(referral, /fieldPath:\s*'__name__'/);
  assert.match(referral, /validateCursorToken/);

  assert.doesNotMatch(
    phase2,
    /createDocument|updateDocument|deleteDocument|method:\s*['"]PATCH['"]|method:\s*['"]DELETE['"]/,
  );

  assert.doesNotMatch(
    phase2,
    /SUPABASE_SERVICE_ROLE_KEY|GOOGLE_APPLICATION_CREDENTIALS|private_key|client_email/,
  );

  assert.match(waitlistRecords, /req\.method !== 'GET'/);
  assert.match(referralSummary, /req\.method !== 'GET'/);
  assert.match(referralRecords, /req\.method !== 'GET'/);
});

test('Phase 2 browser payload projections exclude sensitive referral identity fields', async () => {
  const referral = await read('api/_firestore-referral.mjs');

  const participantProjection = referral.match(
    /const PARTICIPANT_PROJECTION = \[(.*?)\];/s,
  )?.[1] ?? '';

  assert.doesNotMatch(
    participantProjection,
    /referrerUserId|emailFingerprint/,
  );

  assert.match(referral, /maskedEmail/);
  assert.match(referral, /maskedReferralCode/);
});

test('Phase 3 Admin action writer is isolated from Referral and contains no delete path', async () => {
  const [
    writer,
    store,
  ] = await Promise.all([
    read('api/_firestore-admin-actions.mjs'),
    read('api/_admin-action-store.mjs'),
  ]);

  const phase3 =
    `${writer}\n${store}`;

  assert.match(
    writer,
    /documents:commit/,
  );

  assert.match(
    store,
    /admin_action_requests/,
  );

  assert.match(
    store,
    /admin_review_flags/,
  );

  assert.match(
    store,
    /admin_audit_events/,
  );

  assert.doesNotMatch(
    writer,
    /pro_waitlist|founding_referral_participants/,
  );

  assert.doesNotMatch(
    writer,
    /GCP_REFERRAL_FIRESTORE_DATABASE_ID/,
  );

  assert.doesNotMatch(
    phase3,
    /deleteDocument|method:\s*['"]DELETE['"]/,
  );

  assert.match(
    writer,
    /currentDocument/,
  );

  assert.match(
    writer,
    /updateTime/,
  );
});

test('Phase 3 mutation endpoints require owner authorization and hardened HTTP contract', async () => {
  const [
    request,
    confirm,
    cancel,
    http,
  ] = await Promise.all([
    read('api/admin/actions/request.js'),
    read('api/admin/actions/confirm.js'),
    read('api/admin/actions/cancel.js'),
    read('api/_admin-action-http.mjs'),
  ]);

  const endpoints =
    `${request}\n${confirm}\n${cancel}`;

  assert.match(
    endpoints,
    /authorizeOwner/,
  );

  assert.match(
    endpoints,
    /prepareAdminMutationRequest/,
  );

  assert.match(
    endpoints,
    /requireIdempotencyKey/,
  );

  assert.match(
    endpoints,
    /assertAdminActionsEnabled/,
  );

  assert.doesNotMatch(
    endpoints,
    /_firestore-referral|pro_waitlist|founding_referral_participants/,
  );

  assert.doesNotMatch(
    endpoints,
    /SUPABASE_SERVICE_ROLE_KEY|private_key|client_email/,
  );

  assert.match(
    http,
    /origin\.length > 0/,
  );

  assert.match(
    http,
    /X-IDEMPOTENCY-KEY|x-idempotency-key/i,
  );
});

test('Phase 3 capability endpoint exposes only bounded action configuration', async () => {
  const config =
    await read(
      'api/admin/actions/config.js',
    );

  assert.match(
    config,
    /authorizeOwner/,
  );

  assert.match(
    config,
    /adminActionsConfiguration/,
  );

  assert.doesNotMatch(
    config,
    /actorUserId|accessToken|service_role|private_key/,
  );

  assert.doesNotMatch(
    config,
    /createDocument|updateDocument|documents:commit/,
  );
});
