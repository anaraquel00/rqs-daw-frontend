# MASTER Analytics Correction — Phase 2

## Scope and baseline

This patch changes only consented frontend analytics and staging isolation. It does not change DSP,
rendering, quota decisions, Supabase schema, Google Ads, GA4/GTM administration, checkout or payment.

Authoritative operational baseline for 2026-11-01 through 2026-11-06: 23 completed Full Masters by
12 users. Those operations cannot be demonstrably attributed to Google Ads with the historical data.

## Event matrix

| Event | Before | After / trigger |
| --- | --- | --- |
| `login` | Every Supabase `SIGNED_IN`, including session confirmation/refocus | Once, only after a successful explicit OAuth or Magic Link callback; session restore and refresh emit nothing |
| `master_upload_started` | Absent | Immediately before requesting the S3 presign for an authenticated upload |
| `master_upload_completed` | Absent | Only after the S3 transfer succeeds |
| `master_upload_failed` | Absent | Presign or transfer failure; never paired with completion for the same attempt |
| `master_analysis_completed` | Absent | Only after a valid, generation-bound analysis response is accepted |
| `master_analysis_failed` | Absent | Request failure or rejected stale-generation response |
| `master_preview_started` | Absent | Immediately before the Preview API request |
| `master_preview_completed` | Absent | Only after a Preview audio blob is returned |
| `master_preview_failed` | Absent | Preview API failure; `master_failed` remains as a compatibility event |
| `master_started` | Present | Preserved; emitted once immediately before an actual Full Master API request |
| `master_completed` | Present | Preserved; emitted once only after a successful Full Master response |
| `master_failed` | Present | Preserved for Preview/Full failures; terminal event deduplication prevents a success/failure pair for one attempt |
| `master_download_requested` | Absent | User click on the completed Full Master download anchor; repeated clicks are deduplicated per completed attempt |
| `master_quota_exceeded` | Absent | Full Master request blocked by the existing quota gate, before the existing alert |
| `master_auth_required` | Absent | Auth gate reached during upload, analysis, Preview or Full Master; deduplicated by flow stage |
| `waitlist_joined` | Present | Preserved; emitted only when `/api/waitlist` returns both HTTP success and `{ success: true }` |

All MASTER lifecycle events contain `operation_id`, `source_format` and only the stage-specific
low-cardinality fields needed by the event. Render events also contain `attempt_number` and
`processing_mode`.

## Correlation and deduplication

- `operation_id` is generated with `crypto.randomUUID()` for the selected audio workflow.
- The identifier is not derived from the user, file, audio content, campaign or device.
- The same value is already sent as the analysis `Idempotency-Key`; the existing backend stores it as
  `client_request_id`. No schema or backend contract change is required for analysis reconciliation.
- The browser resets the identifier and all deduplication state on file replacement or ejection.
- Upload and render retries receive incrementing `attempt_number` values. A terminal deduplication key
  prevents `completed` and `failed` from both being emitted for the same attempt.
- Full Master quota reservations do not currently persist this identifier. Therefore end-to-end
  reconciliation of Full Master quota rows with GA4 remains a known gap and requires a separately
  reviewed backend/logging change.

## Privacy, consent and retention

- `AnalyticsService` remains the single consent gate. No event is sent before Analytics consent.
- No user UUID, email, name, filename, S3 URL/key, presigned URL, token, audio content or `gclid` is
  included in a MASTER lifecycle event.
- `operation_id` exists in browser memory only until file replacement/ejection. The analysis-side copy
  is the existing `client_request_id`; this patch creates no new persistence.
- Target retention policy: GA4 event data at the minimum property retention compatible with reporting
  (recommended 2 months) and operational correlation identifiers for at most 30 days. The current GA4
  property setting and Supabase cleanup policy were not changed. Enforcing the 30-day operational
  limit requires separate review because `audio_intelligence_analyses.expires_at` is nullable and no
  cleanup mutation is part of this patch.
- Staging has `analyticsEnabled: false` and uses `src/index.staging.html`, which omits the production
  GTM bootstrap; Preview smoke tests cannot reach the commercial GA4 property.

## GA4 and Google Ads impact

- The audit evidence did not establish reportable `master_started` or `master_completed` rows for the
  historical window, despite the frontend source containing both events. Historical attribution is not
  reconstructed by this patch.
- New custom parameters require either separately approved GA4 custom-dimension registration or a GA4
  export before they are queryable in standard reports. This patch performs no GA4/GTM administration.
- `waitlist_joined` remains the only intended primary Public Beta conversion. No conversion or campaign
  configuration is changed here.
- MASTER navigation and lifecycle events remain product/optimization signals only; promoting any of
  them to a primary Google Ads conversion requires a later explicit decision.

## Smoke plan

1. Deploy the staging build to the isolated Preview branch and confirm the deployment uses the staging
   environment.
2. With Analytics consent accepted, verify that no request is sent to `google-analytics.com` because
   staging Analytics is disabled.
3. Exercise one successful and one failed upload, analysis and Preview using staging fixtures; verify
   UI behavior is unchanged and unit/integration assertions cover exact event triggers.
4. Exercise a successful Full Master only where staging quota/backend fixtures permit it; confirm the
   existing result/download behavior and that no quota/DSP behavior changed.
5. Verify auth restoration/refocus produces no `login`; verify one explicit test callback produces one
   `login` in the local instrumented test harness.
6. Verify failed waitlist API response produces no `waitlist_joined`; verify successful response does.
7. Before Production promotion, define a read-only GA4 validation query and an operational correlation
   query. Do not use Preview traffic to validate the commercial property.
