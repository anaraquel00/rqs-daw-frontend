# RQS Studio Admin — Phase 2: Read-only Operational Intelligence

## Status

Design contract for implementation on branch:

`feat/studio-admin-phase2-readonly-intelligence`

Base:

`fd481dfd2413f9cff837304272b96c2e2dc83db2`

No Production deployment, IAM change, Supabase mutation, Firestore write, DNS change or Vercel Production mutation is authorized by this document.

## Goal

Evolve the Phase 1 aggregate-only dashboard into an owner-only operational intelligence surface while preserving the existing security boundary:

- Admin remains isolated at `studio-admin.raquelsynths.com`;
- all Phase 2 application data operations remain read-only;
- no Referral/Waitlist write capability is added;
- no Admin datastore write capability is added;
- no static Google credential is introduced;
- no Supabase service-role runtime key is introduced;
- no public Studio route or API receives administrative capability.

## Phase 2 scope

### 1. Waitlist Records

Add an owner-only, paginated, read-only list of `pro_waitlist`.

Allowed operational fields:

- document id;
- masked email;
- plan interest;
- status;
- language;
- source;
- createdAt;
- plan_interest_updated_at;
- referral-attributed boolean;
- referral status;
- referral captured timestamp.

Raw email MUST NOT be returned by the list endpoint.

Unknown or legacy records must be represented explicitly rather than silently coerced.

### 2. Founding Referral Intelligence

Add an owner-only, paginated, read-only view of `founding_referral_participants`.

Allowed operational fields:

- participant document id;
- campaign id;
- status;
- terms version;
- terms accepted timestamp;
- eligible-from timestamp;
- capture end timestamp;
- createdAt;
- masked referral code;
- referred count;
- pending count;
- qualified count;
- computed discount percent.

Do not return `referrerUserId` or `emailFingerprint` to the browser.

Referral counts are derived from matching waitlist documents and must remain read-only.

### 3. Overview expansion

Keep the current Phase 1 metrics and add:

- waitlist plan-interest breakdown;
- language breakdown for the known supported languages;
- referral-attributed waitlist count;
- active founding-referral participant count.

Dynamic source aggregation is deferred unless it can be implemented without unbounded scans.

### 4. Filters

Waitlist filters:

- plan interest;
- status;
- language;
- referral-attributed state.

Referral filters:

- participant status;
- campaign id.

All filters must be server-side validated against explicit allowlists. Unknown fields, arbitrary Firestore field paths and caller-provided collection names are forbidden.

## API contract

Proposed endpoints:

- `GET /api/admin/waitlist/summary` — existing Phase 1 endpoint, retained;
- `GET /api/admin/waitlist/records`;
- `GET /api/admin/referrals/summary`;
- `GET /api/admin/referrals/records`.

Every endpoint must:

1. require a valid Supabase access token;
2. require an active `owner` membership;
3. call the existing Firestore isolation assertion before acquiring GCP credentials;
4. use Vercel OIDC + Google STS only;
5. validate environment/database IDs against the exact Staging/Production contract;
6. use only allowlisted Referral collections;
7. reject non-GET methods except CORS `OPTIONS`;
8. emit sanitized request logs without document payloads or PII;
9. use `Cache-Control: no-store`.

## Pagination

Records endpoints must have bounded pagination.

Initial limits:

- default page size: 25;
- maximum page size: 50.

Cursor values must be opaque to the UI and validated server-side. Arbitrary offset scans are prohibited.

The implementation must avoid returning the full collection in one response.

## PII policy

Phase 2 is intentionally not a CRM.

The browser receives only masked contact identity in list views. Recommended masking:

`an***@example.com`

The server may read the stored email only to derive the masked representation and must never include raw email in logs.

A future explicit Phase 3 gate is required before exposing full contact details, editing records, sending messages, changing status, qualifying referrals, applying discounts or impersonating users.

## IAM

Phase 2 must not require new IAM permissions.

Existing Referral database permissions are expected to remain sufficient:

- `datastore.entities.get`;
- `datastore.entities.list`.

If implementation requires `create`, `update`, `delete`, broad project roles or access to `(default)`, the gate fails.

The Admin Firestore database remains outside the Phase 2 data path unless a separate reviewed feature explicitly requires it.

## Firestore implementation constraints

Extend the isolated Referral module rather than calling Firestore directly from endpoint files.

The module may add bounded read/query helpers only for:

- `pro_waitlist`;
- `founding_referral_participants`.

Caller-controlled collection names are forbidden.

Document decoding must allowlist returned fields. Unknown stored fields must not be forwarded automatically.

## UI

Add navigation entries:

- OVERVIEW;
- WAITLIST;
- REFERRALS.

Waitlist page:

- retain aggregate cards;
- add records table below the aggregates;
- filters above the table;
- clearly mark masked values;
- display `UNKNOWN / LEGACY` explicitly.

Referrals page:

- summary cards;
- read-only records table;
- referral progress counts;
- no mutation controls.

The shell must continue displaying `READ ONLY` and update the version label to `PHASE 2`.

## Tests

### API/security

Must cover:

- no token -> 401;
- inactive/non-owner membership -> 403;
- invalid origin -> 403;
- non-GET -> 405;
- wrong environment/database -> fail closed before token acquisition;
- collection outside allowlist -> reject;
- page size > 50 -> reject or clamp by explicit contract;
- invalid cursor -> 400;
- invalid filter -> 400;
- raw email absent from list JSON;
- referrerUserId absent from list JSON;
- emailFingerprint absent from list JSON;
- no Firestore write method reachable;
- Production/Staging cross-wire rejected.

### UI

Must cover:

- loading state;
- empty state;
- API unavailable state;
- masked email rendering;
- unknown legacy record rendering;
- plan/language/status filters;
- pagination state;
- referrals route protected by the existing admin guard;
- no mutation button rendered.

### Regression

Existing Phase 1 tests remain green.

Public Studio regression suite must remain green and must continue proving:

- no public `/admin` route;
- no public Admin API;
- no redirect/rewrite from public hosts to the Admin app.

## Rollout gates

### Gate 2.1 — Local implementation

Required:

- `npm ci`;
- `npm run test:api`;
- `npm run test:security`;
- `npm test`;
- `npm run build`;
- `git diff --check`.

### Gate 2.2 — Staging/Preview authorization

Preview only.

Verify:

- Staging Supabase membership;
- Staging WIF condition;
- Staging Referral database;
- no Production database IDs;
- no static credentials;
- no new IAM grants.

### Gate 2.3 — Preview data smoke

Verify through authenticated owner session:

- waitlist summary;
- waitlist records;
- waitlist filters;
- referral summary;
- referral records;
- pagination;
- masked PII;
- no write traffic.

### Gate 2.4 — Production authorization

Production remains unchanged until explicit approval after Preview PASS.

Before any Production rollout, re-audit:

- exact commit SHA;
- GitHub checks;
- Vercel Production environment metadata;
- Supabase Production redirect allowlist;
- WIF Production subject;
- IAM read-only permissions;
- Firestore database targets.

## Out of scope

Phase 2 does NOT implement:

- user management;
- plan changes;
- quota changes;
- billing;
- refunds;
- referral qualification writes;
- discount settlement writes;
- waitlist edits;
- contact messaging;
- email campaigns;
- impersonation;
- Admin Firestore writes;
- AWS mutations;
- DNS changes.

Those require separate later phases and separate authorization gates.
