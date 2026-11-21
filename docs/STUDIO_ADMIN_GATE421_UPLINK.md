# RQS Studio Admin — Gate 4.2.1 UPLINK Canonical Quota

## Commercial quota contract

| Plan | Active Uplinks | Tracked clicks / UTC month |
| --- | ---: | ---: |
| FREE | 3 | 1,000 |
| MASTER | Unlimited (`NULL`) | 25,000 |
| PLUS | Unlimited (`NULL`) | 100,000 |
| PRO | Unlimited (`NULL`) | 500,000 |

`NULL` is the canonical representation of an unlimited active-link limit.

## Canonical sources

- Plan identity: `public.profiles.rqs_plan`
- UPLINK entitlements: `public.rqs_plan_entitlements`
- Monthly usage: `public.profiles.monthly_clicks`
- UTC quota period: `public.profiles.click_quota_period_start`
- UPLINK ownership/counters: `public.rqs_uplinks`
- Click dedup: `public.rqs_uplink_click_dedup`

Legacy `profiles.role` and `profiles.click_quota` remain for compatibility but
are not canonical UPLINK quota authority.

## Runtime contract

- `resolve_rqs_plan_entitlement(uuid)` includes UPLINK entitlements.
- `get_uplink_quota(uuid)` is service-role-only and read-only.
- `create_rqs_uplink(text,text)` enforces the authenticated user's active-link
  entitlement.
- `increment_uplink_clicks(uuid,text,text)` enforces canonical per-plan tracked
  click ceilings.
- Click periods use lazy reset at the UTC month boundary.
- Same-link / same-fingerprint clicks inside 60 seconds are deduplicated.

## Studio Admin `/usage`

The owner-only usage projection exposes UPLINK active-link and tracked-click
telemetry while preserving anonymized refs and masked contacts.

## Gate evidence

- 4.2.1.1 SQL Contract + Local Tests: PASS
- 4.2.1.2 Transactional Staging + ROLLBACK: PASS
- 4.2.1.3 Persistent Staging Application: PASS
- 4.2.1.4 Runtime Smoke FREE + PRO: PASS
- 4.2.1.5 Admin `/usage` UPLINK Column: PASS
- 4.2.1.6 Preview Smoke: PASS

Staging after smoke cleanup:
- profiles: 29
- UPLINKs: 5
- historical clicks: 0
- dedup rows: 0

## Production containment

No Gate 4.2.1 canonical UPLINK quota changes have been applied to Production.

Known baseline before Production gates:
- UPLINKs: 20
- historical clicks: 132
- `click_quota_period_start`: present
- canonical UPLINK entitlement columns: absent
- `get_uplink_quota(uuid)`: absent

Production-specific lifecycle differences such as `platform` and
`delete_rqs_uplink(uuid)` must be reconciled explicitly in Production preflight.

## Release discipline

Next:
1. Gate 4.2.2 — Source Freeze / Release Candidate
2. Gate 4.2.3 — Production Preflight READ-ONLY
3. Gate 4.2.4 — Production Transactional Validation + ROLLBACK
4. Gate 4.2.5 — Production Application
5. Gate 4.2.6 — Production Deploy + Runtime/UI Smoke

No Production mutation or deployment is authorized by this document.
