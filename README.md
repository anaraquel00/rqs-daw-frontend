# RQS Studio — Frontend

Web frontend for **RQS Studio / RaQuel Synths Digital Audio Workstation**, an actively developed web-based music technology product integrated with `rqs-daw-backend` for mastering, setlist generation, stem separation, deep links and authentication workflows.

> **Project status:** actively developed independent product. The `main` branch contains public-facing functionality as well as areas still being hardened for a future SaaS/B2B offering. This README intentionally distinguishes implemented functionality from partially integrated features and roadmap items.

## What is implemented

### Frontend stack

The current frontend is built with:

- Angular 20.3.x
- TypeScript 5.9.x
- Angular Standalone Components
- Angular SSR / prerender
- RxJS 7.8
- Supabase JS
- Express 5 for the SSR runtime
- Web Audio API
- AWS S3 uploads through backend-issued presigned URLs
- a Vercel serverless function for the RQS Pro waitlist

The current `package.json` also contains AWS SDK, Stripe and WebSocket dependencies. Their presence in the dependency graph is not treated here as proof that all three are active frontend capabilities.

## Application routes and rendering model

The application currently exposes:

- `/` — landing page
- `/app` — main RQS Studio workspace
- `/terms` — terms
- `/privacy` — privacy
- `/termos` and `/privacidade` — compatibility redirects

The landing page, terms and privacy routes are configured for prerendering. The `/app` workspace is explicitly client-rendered because it depends heavily on browser APIs including Web Audio, `localStorage`, `navigator.clipboard`, `Audio`, `URL.createObjectURL` and OAuth flows.

## Workspace architecture

The workspace combines four main product areas:

1. **Upload / Mastering Core**
2. **Setlist Engine**
3. **RQS Uplink Engine**
4. **Uplink Dashboard**

It also integrates authentication, PT/EN language switching, dynamic SEO metadata and legal navigation.

```text
Browser
  │
  ├── Angular Workspace
  │   ├── UploadZone
  │   │   ├── MasteringPanel
  │   │   └── EKG Monitor
  │   ├── MixPanel
  │   ├── RQS Uplink Engine
  │   └── Uplink Dashboard
  │
  ├── Supabase
  │   ├── Auth
  │   ├── profiles
  │   └── rqs_uplinks
  │
  ├── RQS backend / AWS Lambda
  │   ├── /mastering
  │   ├── /mix
  │   ├── /video
  │   └── /stems
  │
  └── /api/waitlist (Vercel)
      ├── Firestore REST API
      └── Brevo API
```

## Audio mastering workflow

### S3 upload path

The main upload flow accepts `.wav` and `.mp3` files through file selection or drag and drop. The frontend requests a presigned URL from the backend and uploads the binary directly to S3.

```text
File
  -> GET /mastering/presigned-url
  -> direct PUT to S3
  -> s3Key stored in client state
  -> POST /mastering/process
```

The backend base URL is read from `src/environments/environment.ts`.

### Mastering previews

`UploadZoneComponent` can request a batch of four previews for the creative profiles:

- `thunder`
- `clear_sky`
- `sunroof`
- `aurora`

Each preview reuses the uploaded `s3Key` and sends `preview=true`. Returned binary audio is converted into object URLs and cached locally so the user can switch between generated profiles without uploading the source again.

### Full mastering

The full-master flow calls `/mastering/process` and expects a JSON response containing at least `downloadUrl` and `fileName`.

After a successful response, the frontend:

- updates the A/B comparison state;
- records the completed master in the current quota model;
- exposes the download URL;
- stores the processed filename in the shared audio-comparison service.

## A/B comparison with Web Audio API

`AudioComparisonService` implements original/master comparison with:

- two `HTMLAudioElement` instances;
- an `AudioContext`;
- dedicated `GainNode` instances;
- a short crossfade when switching A/B;
- periodic playback-position synchronization;
- `full-track` and `preview-15s` modes.

The service also handles playback cleanup, state reset and `AudioContext` teardown.

## Mastering controls

`MasteringService` stores reactive mastering parameters with Angular Signals, including:

- low crossover cutoff;
- high crossover cutoff;
- stereo width;
- saturation amount;
- mono-bass frequency;
- limiter ceiling;
- limiter threshold.

`MasteringPanelComponent` exposes these controls and can produce a payload with fields such as `low_cutoff_hz`, `high_cutoff_hz`, `stereo_width`, `saturation_amount`, `mono_bass_frequency_hz`, `ceiling_dbtp` and `threshold_db`.

### Current integration limitation

On the audited `main` branch, `UploadZoneComponent.processarMaster()` receives `estilo`, `intensidade` and `preview`. Although `MasteringPanelComponent` also emits `customParams`, those custom parameters are not forwarded by this method to the backend.

Therefore, **the advanced controls are implemented in frontend UI/state, but the current `main` branch does not provide evidence that those values are applied by the remote DSP path**.

## Setlist Engine

`MixPanelComponent` implements a setlist workflow with:

- drag and drop / file picker;
- WAV and MP3 inputs;
- individual background uploads to S3;
- track ordering and removal;
- per-track duration;
- configurable crossfades;
- `linear`, `equal-power` and `fast-cut` transition curves;
- `off`, `perceived` and `normalize` loudness modes;
- local transition preview through Web Audio API;
- final server-side rendering through `/mix/generate-s3`.

### Audit notes

The visual waveform shown by the current Setlist Engine is not derived from decoded audio samples. `getCachedPeaks()` generates deterministic bar heights from the filename. It should therefore be understood as a **UI visualization**, not a measured waveform.

Similarly, the current sample-rate and bit-depth warning helpers infer differences from filename strings such as `48k` and `16bit`; they do not inspect the actual audio metadata.

## Stem separation

The frontend exposes stem extraction through `/stems/split-s3`.

The already-uploaded S3 object is referenced by `s3Key`, and the backend returns a presigned URL for the resulting stem archive. Source separation itself is not performed in the browser; it is delegated to the backend.

## RQS Uplink Engine

The Uplink module creates short links under `go.raquelsynths.com` and recognizes platforms including:

- Spotify
- Bandcamp
- YouTube
- SoundCloud

Link creation requires an authenticated session and inserts records into the Supabase `rqs_uplinks` table.

The current frontend limit for non-premium users is three links.

### Current dashboard state

`RqsUplinkDashboardComponent` currently reads its primary displayed dataset from `localStorage` (`rqs_uplink_database`). Link creation also inserts data into Supabase, but the dashboard on the audited `main` branch does not read its records back from Supabase.

As a result:

- displayed clicks, conversion rate and traffic-source data may represent local cached state;
- deleting a link from the dashboard removes the local entry;
- the audited branch does not provide evidence that this dashboard action deletes the corresponding Supabase record.

The current dashboard should therefore not be described as consolidated server-side analytics.

## Authentication and quotas

`AuthService` uses Supabase Auth with OAuth providers for:

- GitHub
- Google

Reactive account state includes:

- session;
- `free | premium` role;
- completed-master count;
- remaining quota;
- link limit.

### Free mastering quota

The current UI model allows three free mastering operations.

For authenticated users, `completed_masters` is read from and updated in the Supabase `profiles` table. For anonymous users, the count is stored in `localStorage` and reset after 30 days.

### Security boundary

Frontend quota and entitlement checks are UX controls, not an authorization boundary. A browser client can be modified by the user. A SaaS/B2B version must enforce subscription entitlement, quotas and authorization on trusted server-side infrastructure as well.

### Local development behavior

On the audited `main` branch, authenticated sessions running on `localhost` or `127.0.0.1` receive `premium` locally for development purposes. This is a development behavior and must not be interpreted as a production permission model.

## RQS Pro waitlist

`api/waitlist.js` is a serverless function separate from the Angular client bundle.

The endpoint currently:

- accepts `POST` and `OPTIONS`;
- applies an origin allowlist;
- uses a `website` honeypot field;
- normalizes and validates email addresses;
- creates a deterministic SHA-256 identifier from the email;
- attempts persistence through the Firestore REST API;
- creates or updates a Brevo contact;
- reads Brevo credentials from environment variables.

A Firestore `409` response is handled as an already-registered user.

## SEO and SSR

The frontend contains a dedicated `SeoService` for:

- document title;
- meta description;
- robots directives;
- Open Graph metadata;
- Twitter cards;
- canonical URLs;
- JSON-LD.

The workspace publishes structured data using `SoftwareApplication` / `Digital Audio Workstation` terminology and positions the offer as SaaS. This metadata expresses product positioning; **it is not evidence by itself of B2B SaaS maturity, multi-tenant billing or enterprise operation**.

Public SEO-related assets also include:

- `robots.txt`;
- `sitemap.xml`;
- favicon assets;
- platform images.

## Internationalization

The application contains an internal `LanguageService` that reactively switches between Portuguese and English.

The main runtime does not depend on an external i18n library for this behavior.

## Repository structure

```text
.
├── api/
│   └── waitlist.js
├── public/
│   ├── assets/images/
│   ├── robots.txt
│   └── sitemap.xml
├── src/
│   ├── MANUAL_MASTERIZACAO.md
│   ├── app/
│   │   ├── components/
│   │   │   ├── crossover-control/
│   │   │   ├── ekg-monitor/
│   │   │   ├── limiter-control/
│   │   │   ├── mastering-panel/
│   │   │   ├── privacy/
│   │   │   ├── redirect-simulator/
│   │   │   ├── rqs-uplink-dashboard/
│   │   │   ├── stereo-control/
│   │   │   ├── terms/
│   │   │   └── upload-zone/
│   │   ├── landing-page/
│   │   ├── mix-panel/
│   │   ├── rqs-uplink-engine/
│   │   ├── services/
│   │   │   ├── audio-comparison.service.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── deep-link.service.ts
│   │   │   ├── dsp.ts
│   │   │   ├── language.service.ts
│   │   │   ├── mastering.service.ts
│   │   │   └── seo.service.ts
│   │   └── workspace/
│   └── environments/
├── angular.json
├── package.json
└── README.md
```

## Local development

### Requirements

- Node.js 22 recommended
- npm

### Install

```bash
npm ci
```

### Development server

```bash
npm start
```

or:

```bash
ng serve
```

### Tests

```bash
npm test
```

The script invokes `ng test`. The existence of a test command does not imply complete test coverage; effective coverage should be measured and reported separately.

### Production build

```bash
npm run build
```

### SSR runtime

```bash
npm run serve:ssr:rqs-daw
```

This command assumes the corresponding SSR build already exists at `dist/rqs-daw/server/server.mjs`.

## Backend configuration

`DspService` reads `environment.baseUrl`.

On the audited `main` branch, **`environment.ts` and `environment.prod.ts` are identical and both target the public AWS Lambda backend URL**. Local `ng serve` therefore uses the remote backend unless the configuration is changed manually.

A separate development/staging configuration is recommended before broader SaaS/B2B operation.

## Audit findings and hardening priorities

### High priority

1. **Enforce entitlements and quotas server-side**
   - `canMaster()` and `canCreateLink()` are client-side controls.
   - The backend must become the final authority for a SaaS product.

2. **Move Uplink Dashboard state to a server-side source of truth**
   - reads, deletion and metrics are not fully synchronized with Supabase in the audited branch.

3. **Complete advanced mastering-control integration**
   - `MasteringPanel` emits `customParams`;
   - the main `UploadZone.processarMaster()` flow does not currently forward them.

4. **Separate development, staging and production environments**
   - development and production configuration currently point to the same remote backend.

5. **Replace Setlist metadata approximations where product behavior depends on them**
   - waveform bars are synthetic;
   - sample-rate and bit-depth warnings currently depend on filenames.

### Medium-term hardening

- organization/tenant model;
- RBAC (`owner`, `admin`, `member`);
- server-side billing and entitlement lifecycle;
- persistent processing-job history;
- server-side usage accounting;
- request/job observability and tracing;
- server-backed Uplink analytics;
- separate staging environment;
- frontend/backend integration tests;
- explicit audio-file retention and deletion policies.

## SaaS / B2B readiness

The current codebase demonstrates a meaningful foundation for a web-based music technology product:

- authentication;
- free/premium account state;
- waitlist infrastructure;
- remote backend integration;
- S3-backed audio uploads;
- remote audio processing;
- A/B audio comparison;
- stem-separation workflow;
- setlist workflow;
- deep-link creation;
- SEO infrastructure;
- SSR/prerender support.

The audited `main` branch does **not** yet provide enough evidence to classify RQS Studio as a production-grade B2B SaaS platform. In particular, organization-level multi-tenancy, enterprise RBAC, server-authoritative entitlements, complete subscription lifecycle management, tenant isolation, audit logging, operational observability and tested recovery procedures still require implementation or validation.

This distinction is intentional: implemented product capabilities and future SaaS requirements are documented separately rather than presented as equivalent.

## Relationship to the backend

This repository owns the browser-facing product experience and orchestration layer. DSP, Demucs source separation, FFmpeg rendering, S3-backed processing and Stripe webhook handling belong to the companion backend repository:

`anaraquel00/rqs-daw-backend`

Keeping this boundary explicit makes it easier to reason about security, product responsibilities and future SaaS architecture.

## Evidence policy

This README follows an evidence-first documentation policy:

- repository presence does not automatically mean a feature is active in every user flow;
- UI controls are not described as backend DSP behavior unless the integration path is present;
- client-side quota checks are not described as security controls;
- synthetic visualizations are not described as measured audio analysis;
- roadmap capabilities are not presented as implemented SaaS features;
- performance claims should be supported by reproducible measurements before being documented as benchmarks.

## Current direction

RQS Studio is being evolved from an independent web-based audio tool into a more structured SaaS product. The current engineering priorities are to preserve the working audio workflows while strengthening authorization, billing, persistence, environment separation, observability and tenant-aware product architecture.
