import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sqlPath = new URL('../../../supabase/review/uplink_quota_canonicalization_gate421.sql', import.meta.url);
const sql = await readFile(sqlPath, 'utf8');

function functionBody(name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = sql.match(
    new RegExp(
      `create\\s+or\\s+replace\\s+function\\s+public\\.${escaped}\\b[\\s\\S]*?as\\s+\\$function\\$([\\s\\S]*?)\\$function\\$;`,
      'i',
    ),
  );
  assert.ok(match, `function ${name} must exist`);
  return match[1];
}

test('entitlement catalog defines the approved UPLINK four-plan policy', () => {
  assert.match(sql, /uplink_active_limit\s+integer/i);
  assert.match(sql, /uplink_click_limit\s+bigint/i);
  assert.match(sql, /uplink_click_period\s+text/i);

  assert.match(sql, /when\s+'free'\s+then\s+3/i);
  assert.match(sql, /when\s+'master'\s+then\s+null/i);
  assert.match(sql, /when\s+'plus'\s+then\s+null/i);
  assert.match(sql, /when\s+'pro'\s+then\s+null/i);

  assert.match(sql, /when\s+'free'\s+then\s+1000/i);
  assert.match(sql, /when\s+'master'\s+then\s+25000/i);
  assert.match(sql, /when\s+'plus'\s+then\s+100000/i);
  assert.match(sql, /when\s+'pro'\s+then\s+500000/i);
  assert.match(sql, /uplink_click_period\s*=\s*'monthly'/i);
});

test('UTC lazy reset state is added without deleting legacy quota columns', () => {
  assert.match(sql, /add column if not exists click_quota_period_start timestamptz/i);
  assert.match(sql, /date_trunc\([\s\S]*?'month'[\s\S]*?'UTC'[\s\S]*?\)/i);

  assert.doesNotMatch(sql, /drop\s+column\s+(?:if\s+exists\s+)?role\b/i);
  assert.doesNotMatch(sql, /drop\s+column\s+(?:if\s+exists\s+)?click_quota\b/i);
});

test('canonical resolver preserves existing products and adds UPLINK', () => {
  const body = functionBody('resolve_rqs_plan_entitlement');

  assert.match(body, /p\.rqs_plan/i);
  assert.match(body, /rqs_plan_entitlements/i);
  assert.match(body, /'full_master'/i);
  assert.match(body, /'spotify_pitch'/i);
  assert.match(body, /'uplink'/i);
  assert.match(body, /'active_limit'/i);
  assert.match(body, /'click_limit'/i);
  assert.match(body, /'click_period'/i);
  assert.doesNotMatch(body, /\bp\.role\b|\bprofile\.role\b/i);
});

test('get_uplink_quota exposes active-link and monthly-click quota semantics', () => {
  const body = functionBody('get_uplink_quota');

  assert.match(body, /count\(\*\).*rqs_uplinks/is);
  assert.match(body, /monthly_clicks/i);
  assert.match(body, /click_quota_period_start/i);
  assert.match(body, /'unlimited'/i);
  assert.match(body, /'can_create'/i);
  assert.match(body, /'can_track'/i);
  assert.match(body, /'period_key'/i);
  assert.match(body, /date_trunc\([\s\S]*?'month'[\s\S]*?'UTC'/i);
  assert.doesNotMatch(body, /\brole\b/i);
});

test('create_rqs_uplink no longer authorizes quota from legacy role', () => {
  const body = functionBody('create_rqs_uplink');

  assert.match(body, /resolve_rqs_plan_entitlement/i);
  assert.match(body, /active_limit/i);
  assert.match(body, /UPLINK_FREE_LIMIT_REACHED/i);
  assert.match(body, /pg_advisory_xact_lock/i);
  assert.doesNotMatch(body, /\bv_role\b|\bp\.role\b|\bprofile\.role\b/i);
});

test('click tracker uses rqs_plan entitlement and preserves dedup/lazy reset', () => {
  const body = functionBody('increment_uplink_clicks');

  assert.match(body, /profile\.rqs_plan/i);
  assert.match(body, /entitlement\.uplink_click_limit/i);
  assert.match(body, /entitlement\.uplink_click_period/i);
  assert.match(body, /interval\s+'60 seconds'/i);
  assert.match(body, /interval\s+'48 hours'/i);
  assert.match(body, /CLICK_QUOTA_EXCEEDED/i);
  assert.match(body, /click_quota_period_start\s*=\s*v_current_period/i);

  assert.doesNotMatch(body, /\bprofile\.click_quota\b|\bp\.click_quota\b/i);
  assert.doesNotMatch(body, /\bv_role\b|\bprofile\.role\b|\bp\.role\b/i);
});

test('function ACL contract keeps browser and backend boundaries explicit', () => {
  assert.match(
    sql,
    /revoke all on function public\.get_uplink_quota\(uuid\)[\s\S]*?from public, anon, authenticated, service_role;[\s\S]*?grant execute on function public\.get_uplink_quota\(uuid\)[\s\S]*?to service_role;/i,
  );
  assert.match(
    sql,
    /revoke all on function public\.increment_uplink_clicks\(uuid, text, text\)[\s\S]*?to service_role;/i,
  );
  assert.match(
    sql,
    /revoke all on function public\.create_rqs_uplink\(text, text\)[\s\S]*?grant execute on function public\.create_rqs_uplink\(text, text\)[\s\S]*?to authenticated;/i,
  );
});

test('Gate 4.2.1.1 is additive and contains no destructive schema operation', () => {
  assert.doesNotMatch(sql, /\bdrop\s+table\b|\btruncate\b/i);
  assert.doesNotMatch(sql, /\bdrop\s+column\b/i);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.rqs_uplinks/i);
  assert.doesNotMatch(sql, /delete\s+from\s+public\.profiles/i);
});

test('PostgreSQL GREATEST expressions are valid and bigint-safe', () => {
  assert.doesNotMatch(sql, /pg_catalog\.greatest/i);

  assert.match(
    sql,
    /greatest\(0::bigint,\s*v_active_limit::bigint\s*-\s*v_active_used\)/i,
  );

  assert.match(
    sql,
    /greatest\(0::bigint,\s*v_click_limit\s*-\s*v_effective_clicks\)/i,
  );
});
