# RQS Studio Admin — Gate 4: Product Usage Observability

## Status

Gate 4 extends the owner-only Studio Admin with read-only product usage visibility.

Production remains unchanged.

## Canonical quota sources

MASTER:

- `get_mastering_quota(uuid)`

PITCH:

- `get_spotify_pitch_quota(uuid)`

BUILD:

- `get_build_quota(uuid)`

The Admin does not reproduce quota formulas.

The same functions used by the product remain the source of truth.

## Canonical identity

User population continues to originate from:

`auth.users`

Commercial plan assignment continues to originate from:

`public.profiles.rqs_plan`

Entitlement limits continue to originate from:

`public.rqs_plan_entitlements`

## Gate 4.1 usage projection

Review RPC:

`studio_admin_usage_records(...)`

The projection exposes only:

- anonymized identity reference;
- masked email;
- commercial plan;
- MASTER used/reserved/limit/remaining/period;
- PITCH used/reserved/limit/remaining/period;
- BUILD project used/limit/remaining;
- BUILD storage confirmed/reserved/used/limit/remaining.

It does not expose:

- raw Auth UUID;
- full email;
- access or refresh tokens;
- Auth metadata;
- PITCH result JSON;
- BUILD document JSON;
- object keys;
- asset filenames;
- audio data.

## Pagination

Default API page size remains 25.

Maximum UI page size remains 50.

The SQL function accepts at most 51 rows because the API requests `limit + 1` to determine whether another page exists.

The cursor contains:

- created timestamp;
- a 32-character pseudonymous reference derived from the Auth UUID.

Raw Auth UUID is never returned to the browser.

## Security

The product quota getters remain internal and service-role-only.

The Admin does not receive a Supabase service-role key.

`studio_admin_usage_records(...)` is a tightly scoped `SECURITY DEFINER` function that:

1. uses `search_path = ''`;
2. obtains the caller through `auth.uid()`;
3. requires an active `owner` membership;
4. performs read-only projection;
5. rejects unbounded page sizes;
6. validates cursor format;
7. validates plan filters;
8. returns minimized browser-safe fields;
9. revokes EXECUTE from `PUBLIC` and `anon`;
10. grants EXECUTE only to `authenticated`, with owner authorization enforced internally.

## Performance boundary

Gate 4.1 intentionally does not implement global usage aggregation.

Quota getters are evaluated only for the bounded page selected from canonical Auth users.

No `available/exhausted` server-side filter is added yet because that would require calculating quota state across an unbounded user population before pagination.

## Vercel Hobby containment

Gate 4.1 must not add another physical Vercel Function.

The future logical route:

`GET /api/admin/usage/records`

will be routed through the existing consolidated Admin router.

Physical Function count must remain at 11.

## Rollout

### Gate 4.1.1 — SQL contract + local tests

Review-only.

### Gate 4.1.2 — Staging transactional validation

Apply inside `BEGIN ... ROLLBACK`.

Verify owner, non-owner, anon, pagination, masking and product quota projection.

### Gate 4.1.3 — Persistent Staging authorization

Only after 4.1.2 PASS.

### Gate 4.1.4 — Admin API + UI

Add `/usage` without increasing Vercel physical Function count.

### Gate 4.1.5 — Preview smoke

Authenticated owner Preview only.

### Production

HOLD until explicit authorization.
