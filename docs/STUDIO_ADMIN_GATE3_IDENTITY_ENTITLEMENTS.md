# RQS Studio Admin — Gate 3: Supabase Identity & Entitlements

## Status

Implementation branch:

`feat/studio-admin-gate3-identity-entitlements`

Base:

`e6f9c61832fd05d700b0bf187fe06cbb9a6639ac`

Production is unchanged. The Supabase SQL contract is review-only until a separate Staging authorization gate applies it.

## Goal

Extend the isolated Studio Admin with owner-only, read-only operational visibility over Supabase identity and plan entitlements without introducing a service-role or secret key into the Vercel Admin runtime.

Canonical sources:

- identity: `auth.users`;
- plan assignment: `public.profiles.rqs_plan`;
- entitlement catalog: `public.rqs_plan_entitlements`;
- Admin RBAC: `public.studio_admin_memberships`.

The Admin must not treat `profiles` as the canonical user population.

## Read-only staging audit snapshot — 2026-11-20

Supabase project:

- `rqs-daw-staging` — `uwrqbywapomuloresoek`.

Observed aggregate state:

- Auth users: 8;
- Auth users with matching profile: 8;
- Auth users without profile: 0;
- Profiles without matching Auth user: 21;
- plan catalog rows: 4;
- profile plan distribution before identity filtering: 27 free / 2 pro.

The 21 profile-only rows are data-quality residue and must not be counted as registered users.

Current canonical plan catalog:

| Plan | Period | Full MASTER | Spotify PITCH | BUILD projects | BUILD storage |
| --- | --- | ---: | ---: | ---: | ---: |
| free | lifetime | 3 | 3 | 2 | 1 GiB |
| master | monthly | 20 | 10 | 10 | 10 GiB |
| plus | monthly | 40 | 30 | 25 | 25 GiB |
| pro | monthly | 80 | 60 | 100 | 50 GiB |

Existing `resolve_rqs_plan_entitlement(uuid)` already resolves commercial plan from `profiles.rqs_plan` joined to `rqs_plan_entitlements`. Gate 3 preserves that source of truth rather than creating a duplicate membership model.

## Security architecture

The Admin runtime continues using:

- Supabase publishable key;
- the signed-in owner's access token;
- `studio_admin_memberships` owner authorization.

Gate 3 does **not** add:

- `SUPABASE_SERVICE_ROLE_KEY`;
- `sb_secret_...` keys;
- database passwords;
- direct browser access to `auth.users`;
- user-management mutation APIs.

Because ordinary authenticated clients cannot enumerate `auth.users`, the review SQL defines three tightly scoped `SECURITY DEFINER` read functions. Every function:

1. sets `search_path = ''`;
2. requires `auth.uid()`;
3. verifies an active `owner` row in `studio_admin_memberships`;
4. performs SELECT-only work;
5. has EXECUTE revoked from `PUBLIC` and `anon`;
6. grants EXECUTE only to `authenticated`;
7. returns masked/minimized projections.

No raw email, password hash, token, phone, metadata object, IP, session, or refresh token is exposed.

## RPC contract

Review file:

`supabase/review/studio_admin_identity_entitlements_gate3.sql`

Functions:

- `studio_admin_identity_summary()`;
- `studio_admin_identity_records(...)`;
- `studio_admin_entitlement_catalog()`.

The SQL has been syntax-validated against Staging inside a transaction that ended with `ROLLBACK`. Post-validation verification confirmed that none of the three functions remained in Staging.

## Admin API

New owner-only GET endpoints:

- `GET /api/admin/identity/summary`;
- `GET /api/admin/identity/records`;
- `GET /api/admin/identity/entitlements`.

Records are bounded to 50 maximum, with opaque cursor pagination. Browser-visible records contain only:

- anonymized identity reference;
- masked email;
- auth status;
- auth provider;
- plan;
- created timestamp;
- last-sign-in timestamp;
- resolved entitlement limits.

## UI

New route:

`/identity`

Surface:

- Auth-user counts;
- active / confirmed / unconfirmed counts;
- Auth-without-profile count;
- orphan-profile count;
- plan distribution over Auth-backed users only;
- masked/paginated identity table;
- plan/status filters;
- canonical entitlement catalog.

The shell remains owner-guarded and no mutation controls are added by Gate 3.

## Rollout gates

### Gate 3.1 — Source implementation

Required:

- API tests;
- security contract tests;
- Angular tests;
- production build;
- `git diff --check`.

### Gate 3.2 — Supabase Staging authorization

Only after review:

1. apply the reviewed SQL contract to `rqs-daw-staging`;
2. verify grants on all three functions;
3. verify owner can call all three RPCs;
4. verify non-owner and anon cannot call them;
5. verify no raw PII leaves the functions;
6. run Supabase security advisors.

### Gate 3.3 — Admin Preview smoke

Manual Admin Preview only. Automatic Git deploy remains disabled.

Verify:

- login / owner guard;
- identity summary;
- filters;
- pagination;
- masked email;
- entitlement catalog;
- 0 Supabase writes;
- 0 Referral writes;
- 0 Admin Firestore writes caused by Gate 3.

### Gate 3.4 — Production authorization

Production remains HOLD until explicit owner approval after Staging + Preview PASS.

## Out of scope

Gate 3 does not implement:

- user edits/deletion;
- plan changes;
- commercial subscription billing;
- refunds;
- quota adjustments;
- impersonation;
- password reset;
- email campaigns;
- Auth session revocation;
- Production schema changes;
- MASTER/PITCH usage analytics beyond entitlement limits.

Product usage is a later gate.
