import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

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
      read('api/admin/waitlist.js'),
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


  assert.ok(
    vercel.rewrites?.some(
      rewrite =>
        rewrite.source === '/identity' &&
        rewrite.destination === '/index.html',
    ),
  );
});

test('Hobby deployment keeps consolidated Admin Functions within budget', async () => {
  const vercel =
    JSON.parse(
      await read(
        'vercel.json',
      ),
    );

  const expectedRewrites =
    new Map([
      [
        '/api/admin/identity/summary',
        '/api/admin/identity?operation=summary',
      ],
      [
        '/api/admin/identity/records',
        '/api/admin/identity?operation=records',
      ],
      [
        '/api/admin/identity/entitlements',
        '/api/admin/identity?operation=entitlements',
      ],
      [
        '/api/admin/waitlist/summary',
        '/api/admin/waitlist?operation=summary',
      ],
      [
        '/api/admin/waitlist/records',
        '/api/admin/waitlist?operation=records',
      ],
    ]);

  for (
    const [
      source,
      destination,
    ]
    of expectedRewrites
  ) {
    assert.ok(
      vercel.rewrites?.some(
        rewrite =>
          rewrite.source === source &&
          rewrite.destination ===
            destination,
      ),
      `missing rewrite ${source}`,
    );
  }

  const apiEntries =
    await readdir(
      new URL(
        '../api/',
        import.meta.url,
      ),
      {
        recursive: true,
      },
    );

  const functions =
    apiEntries
      .filter(
        entry =>
          entry.endsWith('.js'),
      )
      .sort();

  assert.ok(
    functions.length <= 11,
    `Hobby containment exceeded: ${functions.length} direct Functions`,
  );

  assert.ok(
    functions.includes(
      'admin/identity.js',
    ),
  );

  assert.ok(
    functions.includes(
      'admin/waitlist.js',
    ),
  );

  assert.equal(
    functions.some(
      path =>
        path.startsWith(
          'admin/identity/',
        ),
    ),
    false,
  );

  assert.equal(
    functions.some(
      path =>
        path.startsWith(
          'admin/waitlist/',
        ),
    ),
    false,
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
      read('api/admin/waitlist.js'),
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

test('Gate 3 Supabase identity contract is owner-gated, read-only and secretless', async () => {
  const [
    sql,
    adapter,
    summary,
    records,
    entitlements,
  ] = await Promise.all([
    read('../../supabase/review/studio_admin_identity_entitlements_gate3.sql'),
    read('api/_supabase-identity.mjs'),
    read('api/admin/identity.js'),
    read('api/admin/identity.js'),
    read('api/admin/identity.js'),
  ]);

  const runtime = [
    adapter,
    summary,
    records,
    entitlements,
  ].join('\n');

  assert.match(sql, /security definer/i);
  assert.match(sql, /set search_path to ''/i);
  assert.match(sql, /studio_admin_memberships/i);
  assert.match(sql, /m\.role = 'owner'/i);
  assert.match(sql, /auth\.users/i);
  assert.match(sql, /profiles\.rqs_plan|p\.rqs_plan/i);
  assert.match(sql, /rqs_plan_entitlements/i);

  assert.match(
    sql,
    /revoke all on function public\.studio_admin_identity_summary\(\) from public, anon, authenticated/i,
  );
  assert.match(
    sql,
    /grant execute on function public\.studio_admin_identity_summary\(\) to authenticated/i,
  );

  assert.doesNotMatch(
    sql,
    /\binsert\s+into\b|\bupdate\s+public\.|\bdelete\s+from\b|\btruncate\b/i,
  );

  assert.doesNotMatch(
    runtime,
    /SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET|sb_secret_|private_key/i,
  );

  assert.match(summary, /authorizeOwner/);
  assert.match(records, /authorizeOwner/);
  assert.match(entitlements, /authorizeOwner/);
  assert.match(records, /req\.method !== 'GET'/);
  assert.doesNotMatch(
    runtime,
    /method:\s*['"](?:POST|PATCH|PUT|DELETE)['"]/,
  );

  assert.match(
    sql,
    /p_cursor_ref text/i,
  );

  assert.match(
    sql,
    /cursor_ref text/i,
  );

  assert.doesNotMatch(
    sql,
    /p_cursor_id|cursor_id\s+uuid/i,
  );

  assert.match(
    adapter,
    /p_cursor_ref/,
  );

  assert.doesNotMatch(
    adapter,
    /p_cursor_id|cursor_id|decoded\.id/,
  );
});


test('Gate 4.0.1 MASTER quota canonicalization uses rqs_plan entitlements without rewriting legacy semantics', async () => {
  const sql =
    await read(
      '../../supabase/review/mastering_quota_canonicalization_gate4.sql',
    );

  assert.match(
    sql,
    /create or replace function public\.get_mastering_quota/i,
  );

  assert.match(
    sql,
    /resolve_rqs_plan_entitlement/i,
  );

  assert.match(
    sql,
    /policy_version\s*=\s*'rqs_plan_v1'/i,
  );

  assert.match(
    sql,
    /period_key/i,
  );

  assert.match(
    sql,
    /quota_limit/i,
  );

  assert.match(
    sql,
    /r\.policy_version is null/i,
  );

  assert.match(
    sql,
    /v_plan = 'free'/i,
  );

  assert.doesNotMatch(
    sql,
    /p\.role|v_role|'premium'/i,
  );

  assert.doesNotMatch(
    sql,
    />=\s*3\b/,
  );

  assert.doesNotMatch(
    sql,
    /security\s+definer/i,
  );

  assert.match(
    sql,
    /revoke all[\s\S]*get_mastering_quota\(uuid\)[\s\S]*from public, anon, authenticated/i,
  );

  assert.match(
    sql,
    /grant execute[\s\S]*get_mastering_quota\(uuid\)[\s\S]*to service_role/i,
  );

  assert.doesNotMatch(
    sql,
    /\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b/i,
  );
});


test('Gate 4.1 usage projection is owner-only, bounded and browser-safe', async () => {
  const sql =
    await read(
      '../../supabase/review/studio_admin_product_usage_gate4.sql',
    );

  assert.match(
    sql,
    /create or replace function public\.studio_admin_usage_records/i,
  );

  assert.match(
    sql,
    /security definer/i,
  );

  assert.match(
    sql,
    /set search_path to ''/i,
  );

  assert.match(
    sql,
    /auth\.uid\(\)/i,
  );

  assert.match(
    sql,
    /studio_admin_memberships/i,
  );

  assert.match(
    sql,
    /m\.active = true/i,
  );

  assert.match(
    sql,
    /m\.role = 'owner'/i,
  );

  assert.match(
    sql,
    /from auth\.users/i,
  );

  assert.match(
    sql,
    /profiles/i,
  );

  assert.match(
    sql,
    /rqs_plan_entitlements/i,
  );

  assert.match(
    sql,
    /get_mastering_quota/i,
  );

  assert.match(
    sql,
    /get_spotify_pitch_quota/i,
  );

  assert.match(
    sql,
    /get_build_quota/i,
  );

  assert.match(
    sql,
    /p_fetch_limit > 51/i,
  );

  assert.match(
    sql,
    /p_cursor_ref text/i,
  );

  assert.doesNotMatch(
    sql,
    /p_cursor_id/i,
  );

  assert.match(
    sql,
    /\^\[0-9a-f\]\{32\}\$/,
  );

  assert.match(
    sql,
    /md5\(u\.id::text\)/i,
  );

  assert.match(
    sql,
    /masked_email text/i,
  );

  assert.match(
    sql,
    /master_used bigint/i,
  );

  assert.match(
    sql,
    /pitch_used bigint/i,
  );

  assert.match(
    sql,
    /build_projects_used bigint/i,
  );

  assert.match(
    sql,
    /build_storage_used_bytes bigint/i,
  );

  assert.doesNotMatch(
    sql,
    /returns table\s*\([^)]*\buser_id\b/is,
  );

  assert.doesNotMatch(
    sql,
    /returns table\s*\([^)]*\bemail\b/is,
  );

  assert.doesNotMatch(
    sql,
    /\binsert\s+into\b|\bupdate\s+public\.|\bdelete\s+from\b|\btruncate\b/i,
  );

  assert.match(
    sql,
    /revoke all[\s\S]*studio_admin_usage_records[\s\S]*from public, anon, authenticated/i,
  );

  assert.match(
    sql,
    /grant execute[\s\S]*studio_admin_usage_records[\s\S]*to authenticated/i,
  );

  assert.doesNotMatch(
    sql,
    /SUPABASE_SERVICE_ROLE_KEY|sb_secret_|private_key/i,
  );
});
