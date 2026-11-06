# RQS Studio — Frontend

Web frontend for **RQS Studio / RaQuel Synths Digital Audio Workstation**, a browser-based music production and release workflow integrated with the companion `rqs-daw-backend`.

The current product is organized around four public Studio modules:

1. **MASTER** — DSP mastering and Audio Intelligence
2. **PITCH** — AI-assisted editorial release preparation
3. **BUILD** — setlist sequencing and continuous WAV rendering
4. **UPLINK** — release smart links and link management

`SPLIT` remains available as a technical/roadmap surface, but it is intentionally not exposed as one of the four commercial module cards.

> **Project status:** actively developed. This README documents the current frontend implementation and distinguishes implemented runtime behavior from planned pricing, entitlements and broader SaaS/B2B roadmap items.

## Frontend stack

The current frontend is built with:

- Angular 20.3.x
- TypeScript 5.9.x
- Angular Standalone Components
- Angular SSR / prerender
- RxJS 7.8
- Supabase JS
- Express 5 for the SSR runtime
- Web Audio API
- AWS S3 uploads through backend-issued presigned URLs in staging/production flows
- Vercel serverless functions for waitlist, contact and referral workflows

The current dependency graph does **not** contain frontend Stripe, AWS SDK or WebSocket packages. Backend infrastructure and billing-related responsibilities must not be inferred from frontend package presence.

## Application routes and rendering model

### Main public routes

The application currently exposes:

- `/` — public landing page
- `/app` — prerendered Studio module selector
- `/app/master` — MASTER workspace
- `/pitch` — dedicated PITCH workspace
- `/app/build` — BUILD / Setlist workspace
- `/app/uplink` — UPLINK workspace
- `/app/split` — SPLIT technical/roadmap surface
- `/app/learn` — learning surface
- `/app/account` — account surface
- `/master/online` — MASTER acquisition landing page
- `/pricing` — pricing / planned entitlement presentation
- `/contact` — contact
- `/terms` — terms
- `/privacy` — privacy
- `/cookies` — cookies
- `/referral-terms` — referral terms
- `/legacy` — legacy DAW mainframe

Compatibility redirects also exist for older `/studio/*` paths and Portuguese legal/contact aliases.

### Rendering

The following routes are currently prerendered:

- `/`
- `/terms`
- `/privacy`
- `/pricing`
- `/cookies`
- `/referral-terms`
- `/contact`
- `/master/online`
- `/app`

The workspaces under `/app/**`, the dedicated `/pitch` route and `/legacy` are client-rendered because they depend on browser-side audio, authentication, local state and interactive workflow APIs.

## Studio architecture

The current Studio shell owns navigation and retains visited module surfaces so that switching between modules does not unnecessarily destroy local audio/job state.

```text
Browser
  │
  ├── Angular Studio Shell
  │   ├── Module Selector
  │   │   ├── MASTER
  │   │   ├── PITCH
  │   │   ├── BUILD
  │   │   └── UPLINK
  │   │
  │   ├── MASTER
  │   │   ├── UploadZone
  │   │   ├── MasteringPanel
  │   │   ├── Audio DNA
  │   │   └── A/B Comparison
  │   │
  │   ├── PITCH
  │   │   ├── UploadZone (workspace="pitch")
  │   │   ├── Audio DNA / Audio Intelligence
  │   │   ├── Artist Confirmation
  │   │   └── AI Spotify Pitch
  │   │
  │   ├── BUILD
  │   │   └── Setlist Engine
  │   │
  │   └── UPLINK
  │       ├── Uplink Engine
  │       └── Uplink Dashboard
  │
  ├── Supabase
  │   ├── Auth
  │   ├── profiles
  │   └── rqs_uplinks
  │
  ├── RQS backend / AWS Lambda
  │   ├── /mastering/v2/*
  │   ├── /mix/*
  │   ├── /stems/*
  │   └── related audio-processing APIs
  │
  └── Vercel serverless APIs
      ├── /api/waitlist
      ├── /api/contact
      └── /api/referral/*
```

The commercial module selector currently presents **MASTER, PITCH, BUILD and UPLINK** in that order.

## MASTER — mastering and Audio Intelligence

The current MASTER surface is available at `/app/master`.

The primary frontend orchestration lives in `UploadZoneComponent`, which coordinates source preparation, analysis, Mastering V2 processing, progress state and A/B playback.

### Source preparation

The source path depends on the environment:

- local development can use direct upload to the backend when `masteringV2DirectUpload=true`;
- staging and production use backend-issued presigned S3 URLs before analysis/processing.

The current V2 service surface includes:

- `GET /mastering/v2/capabilities`
- `GET /mastering/v2/presigned-url`
- `POST /mastering/v2/analysis`
- `GET /mastering/v2/analyses/:analysisId`
- `POST /mastering/v2/auto/recommend`
- `POST /mastering/v2/process`

Authenticated Mastering V2 requests send the Supabase access token as a bearer token.

### Audio analysis

The analysis flow can receive and persist:

- technical mastering metrics;
- RQS Audio DNA;
- Audio Intelligence V2;
- OpenAI Music Analyst output;
- an `analysis_id`;
- persisted artist-confirmation and pitch state.

The client protects analysis state against source-generation mismatches so analysis from one selected track is not silently reused for another.

### A/B comparison

`AudioComparisonService` implements original/master comparison using browser audio primitives, including:

- separate original and processed audio elements;
- Web Audio gain control;
- A/B switching;
- playback synchronization;
- preview and full-track behavior;
- cleanup/reset across source changes.

## PITCH — AI Release Intelligence

**PITCH is the newest public Studio module.**

The dedicated route is:

```text
/pitch
```

A compatibility redirect also maps `/studio/pitch` to `/pitch`. The Studio route tree additionally understands the `pitch` surface, while module-selector and top-navigation links use the dedicated `/pitch` URL.

### Authentication boundary

PITCH is protected by `studioAuthGuard`.

If the user is not authenticated, the frontend stores a safe return path, opens the sign-in flow and returns to the Studio selector until authentication is resolved.

### Workflow

The implemented product flow is:

```text
Audio source
    ↓
Mastering V2 analysis
    ↓
Audio DNA / Audio Intelligence
    ↓
Artist Confirmation
    ↓
Optional release context
    ↓
AI Spotify Pitch
    ↓
Editorial draft + evidence trace
```

The dedicated PITCH workspace reuses the upload/analyzer core with:

```html
<app-upload-zone workspace="pitch">
```

and then renders `PitchWorkspacePanelComponent`.

### Audio Intelligence and artist control

When analysis is ready, the PITCH surface can expose detected musical evidence and asks the artist to confirm or adjust the final release description before generation.

The current V2 confirmation model includes:

- genre family;
- subgenres;
- moods;
- instruments;
- vocals;
- production elements.

The artist can accept, remove, correct or add values before generating the editorial draft.

The frontend tests explicitly verify that the V2 pitch request uses artist-confirmed values after editing and does not include raw audio, base64 audio, audio URLs or filenames inside the release-intelligence payload.

### Optional artist context

The user can optionally add contextual information such as:

- song story;
- what is different about the release;
- why the track is being released now;
- real-world context;
- collaboration information;
- collaborator roles;
- cultural or geographic context;
- promotion channels;
- confirmed promotion details.

This context is optional. The UI can keep pitch generation available when the required sound confirmation is complete even if optional context fields are empty.

### Backend endpoints

The PITCH frontend currently uses:

- `GET /mastering/v2/spotify-pitch/quota`
- `POST /mastering/v2/spotify-pitch`
- `PATCH /mastering/v2/analyses/:analysisId/artist-confirmation`
- `GET /mastering/v2/analyses/:analysisId`

Generation requests use an idempotency key.

The PITCH UI is also capability-gated by the backend `spotify_pitch_enabled` feature flag returned from `/mastering/v2/capabilities`.

### Persistence and restoration

The current flow can restore an existing analysis and its persisted state instead of forcing a new generation.

The frontend supports:

- persisted `analysis_id`;
- artist-confirmed sound;
- flow stage;
- confirmation timestamp;
- persisted pitch result.

A valid analysis can be restored from the `analysis` query parameter or from the current authenticated user's last-analysis pointer. The actual analysis/pitch state is reloaded from the backend.

### Pitch output

The current response model can contain:

- Spotify metadata suggestions;
- editorial pitch;
- possible editorial positioning;
- explanation of why the pitch works;
- evidence trace;
- warnings;
- updated quota state.

The UI presents the result as an **editorial draft / suggestion**, not as a guarantee of Spotify playlist inclusion.

### PITCH quota model

The runtime PITCH quota is read from the backend and is treated as authoritative by the frontend.

The current pricing UI also contains **planned** entitlement values:

| Plan | Planned AI Spotify Pitches |
| --- | ---: |
| Free | 3 total |
| Master | 10 / month |
| Plus | 30 / month |
| Pro | 60 / month |

These values come from `PLANNED_PLAN_ENTITLEMENTS` and must not be interpreted as proof that paid subscription billing or those paid-plan limits are already active in production. Runtime quota responses remain authoritative.

## BUILD — Setlist Engine

The BUILD surface is available at `/app/build`.

`MixPanelComponent` implements a setlist workflow with:

- drag and drop / file picker;
- WAV and MP3 inputs;
- individual source uploads;
- ordering and removal;
- per-track duration;
- per-transition crossfade configuration;
- `linear`, `equal-power` and `fast-cut` curves;
- `off` and `normalize` loudness modes;
- local transition preview through Web Audio API;
- final server-side rendering through `/mix/generate-s3`;
- WAV export contract.

The frontend request supports both a default transition curve and per-transition curve overrides.

## UPLINK — release smart links

The UPLINK surface is available at `/app/uplink`.

The module creates and manages release links associated with `go.raquelsynths.com`.

The current frontend recognizes release destinations such as Spotify, Bandcamp, YouTube and SoundCloud.

### Server-backed dashboard

The Uplink Dashboard is now backed by Supabase rather than by the old local-only dashboard model.

`DeepLinkService` currently:

- reads records from the `rqs_uplinks` table;
- creates links through the `create_rqs_uplink` RPC;
- deletes links through the `delete_rqs_uplink` RPC;
- refreshes the displayed list from Supabase after mutations;
- tracks session epochs so stale async responses are not applied across identity changes.

The current non-premium UI limit is three links.

## SPLIT — stem separation surface

`/app/split` remains routable but is intentionally not included in the four-card commercial module selector.

The frontend still exposes backend stem-separation calls including:

- `POST /stems/split`
- `POST /stems/split-s3`

Source separation itself is backend work; it is not performed in the browser.

## Authentication and quota boundaries

`AuthService` uses Supabase Auth and currently supports:

- Google OAuth;
- GitHub OAuth;
- email magic-link / OTP sign-in.

The Studio keeps a sanitized return path across authentication so users can return to protected workflows such as PITCH.

### Mastering quota

The frontend still exposes free/premium account state and a three-master free UI model.

For authenticated secure Mastering V2 flows, the backend is the authority. Legacy browser-side anonymous counters remain for compatibility but must not be treated as a security boundary.

### PITCH quota

PITCH reads quota from the backend through `/mastering/v2/spotify-pitch/quota`. Generation is blocked when the authoritative response reports no remaining quota.

### Local development bypass

Only the local development environment enables `localAuthProfileBypass`.

Staging and production explicitly disable that bypass so they exercise real Supabase profile/auth state.

## Serverless frontend APIs

The repository contains Vercel serverless functions in addition to the Angular application.

Current frontend-owned API areas include:

- waitlist handling;
- contact handling;
- founding-referral activation/status flows.

These functions are separate from the audio DSP backend.

## SEO and SSR

The frontend contains a dedicated `SeoService` for:

- document title;
- meta description;
- robots directives;
- Open Graph metadata;
- Twitter cards;
- canonical URLs;
- JSON-LD.

The current routing also includes host/canonical containment checks and dedicated SEO test scripts.

Available commands include:

```bash
npm run test:seo
npm run test:seo:build
npm run test:host-containment
```

Public SEO-related assets include:

- `robots.txt`;
- `sitemap.xml`;
- favicon / webmanifest assets;
- public product imagery.

## Internationalization

The main Studio UI supports four languages:

- English (`en`)
- Portuguese (`pt` / PT-BR)
- Polish (`pl`)
- French (`fr`)

`LanguageService` supports stored user preference, browser-language detection and server-side `Accept-Language` resolution.

The runtime does not require an external i18n library for this behavior.

## Environment separation

The frontend now has explicit development, staging and production environment files:

```text
src/environments/
├── environment.ts
├── environment.staging.ts
└── environment.prod.ts
```

Current behavior:

- **development** targets a local backend and enables local auth-profile bypass;
- **staging** targets a remote staging backend with the bypass disabled;
- **production** targets a separate production backend and production Supabase project with the bypass disabled.

This replaces the older configuration in which development and production shared the same remote backend target.

## Repository structure

```text
.
├── api/
│   ├── contact.js
│   ├── referral/
│   └── waitlist.js
├── public/
│   ├── assets/
│   ├── robots.txt
│   ├── sitemap.xml
│   └── site.webmanifest
├── scripts/
│   ├── canonical-host-routing.test.mjs
│   ├── rqs-build.mjs
│   ├── seo-build-check.mjs
│   └── seo-static-check.mjs
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── audio-dna-card/
│   │   │   ├── pitch-workspace-panel/
│   │   │   ├── spotify-pitch-panel/
│   │   │   ├── rqs-uplink-dashboard/
│   │   │   └── upload-zone/
│   │   ├── landing-page/
│   │   ├── master-landing-page/
│   │   ├── mix-panel/
│   │   ├── pricing-page/
│   │   ├── rqs-uplink-engine/
│   │   ├── services/
│   │   ├── studio/
│   │   │   ├── module-selector.*
│   │   │   ├── studio-auth.guard.ts
│   │   │   ├── studio-shell.*
│   │   │   ├── studio.routes.ts
│   │   │   └── studio-seo.ts
│   │   └── workspace/
│   └── environments/
│       ├── environment.ts
│       ├── environment.staging.ts
│       └── environment.prod.ts
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

API tests:

```bash
npm run test:api
```

### Production build

```bash
npm run build
```

The default build script runs `scripts/rqs-build.mjs`.

Explicit environment builds are also available:

```bash
npm run build:staging
npm run build:production
```

### SSR runtime

```bash
npm run serve:ssr:rqs-daw
```

This command assumes the corresponding SSR build already exists at `dist/rqs-daw/server/server.mjs`.

## Current product boundaries

The current codebase provides a meaningful web music-production and release workflow, but several concepts should remain distinct:

- client-side UX checks are not a substitute for backend authorization;
- planned pricing/entitlements are not proof of an active paid subscription lifecycle;
- PITCH produces an editorial draft and metadata suggestions, not a playlist-placement guarantee;
- SPLIT remains a technical/roadmap surface rather than a current commercial pillar;
- organization-level tenancy, enterprise RBAC and broader B2B operational controls are not established merely by the current frontend;
- production readiness should be evaluated across the frontend, backend, infrastructure, observability, billing and recovery procedures together.

## Relationship to the backend

This repository owns the browser-facing Studio experience, client orchestration, public acquisition surfaces and selected Vercel serverless workflows.

The companion backend repository owns trusted audio-processing and persistence responsibilities used by the Studio, including Mastering V2, Audio Intelligence, pitch generation, setlist rendering, stem separation and related S3-backed processing.

Companion repository:

```text
anaraquel00/rqs-daw-backend
```

## Evidence policy

This README follows an evidence-first documentation policy:

- repository presence does not automatically mean a feature is active in every user flow;
- UI controls are not described as backend DSP behavior unless the integration path exists;
- browser-side quota displays are not described as security boundaries;
- planned paid-plan entitlements are labeled as planned;
- AI editorial output is not described as guaranteed platform acceptance or playlist placement;
- roadmap capabilities are not presented as fully commercialized features;
- performance claims should be supported by reproducible measurements before being documented as benchmarks.

## Current direction

RQS Studio is evolving into an integrated workflow that connects **audio preparation, release intelligence, set construction and release distribution**.

The current product sequence is now:

```text
MASTER → PITCH → BUILD → UPLINK
```

with PITCH adding the release-intelligence layer between audio preparation and distribution: **Audio DNA → Artist Confirmation → AI-assisted editorial pitch**.
