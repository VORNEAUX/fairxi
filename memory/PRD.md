# FairXI PRD

## Problem Statement
Build a mobile-first web app called FairXI that solves unfair team balancing and unclear pitch cost splitting for casual/amateur football groups. Includes match creation, share-link joining, snake-draft team balancing, manual reassignment, per-player cost tracking, MVP voting with 24h auto-close, and cross-match player history keyed by phone number.

## User Personas
- **The Organizer**: books the pitch, wants fair teams and to know who has paid.
- **The Player**: joins via a shared WhatsApp link, wants a fair game and a chance to be named MVP.
- **The Visitor**: opening the site for the first time, needs to grasp the product instantly (via the live demo).

## Core Requirements
- 7 screens (Home w/ live demo, Create Match, Join, Admin, Teams result, MVP voting, Player history)
- Snake-draft algorithm (rating-desc, N-team snake, light position variety pass)
- Manual dropdown-based team reassignment (no drag/drop)
- Phone-based player identity (unique per match)
- One MVP vote per player, teammate-only, 24h auto-close
- Manual payment toggle only (no payment gateway)
- Pre-seeded demo match visible from the home page

## Architecture
- **Backend**: FastAPI + MongoDB (motor). All routes prefixed `/api`. Startup seeds a demo match tagged `is_demo:true` with 10 players, teams generated, MVP votes cast (Ben = MVP).
- **Frontend**: React + React Router + Tailwind + shadcn/ui + sonner. Bebas Neue (display) + Manrope (body) via Google Fonts. Volt Lime (`#CCFF00`) accent on deep-green-black base.
- **Team balancing** in `snake_draft()`: sort by rating desc → snake distribute → single-pass same-rating swap for position variety.

## Implemented (2026-02, **v1.3**)
### ESLint flat-config (dev-tooling fix)
- Added `/app/frontend/eslint.config.js` (minimal permissive flat config) — required by ESLint v9 which is installed as a devDependency
- Unblocks the pre-completion linter (`npx eslint src/` now runs with 0 errors)
- No functional code changed; CRA/react-scripts continues to handle build-time linting internally
- v1.3 regression (iteration_10): 68/68 pytest green + all frontend routes smoke-tested clean

## Implemented (2026-02, **v1.5** — Payment link WebView fix + DB hygiene)
### P0 — Payment Link opens in system browser (not WebView)
- **Root cause**: `<a href={link} target="_blank">` on the payment deep-link. In a Capacitor WebView this opens *inside* the embedded browser, where PayPal.me/Revolut/Satispay's amount-display scripts fail silently (blank profile page, no amount).
- **Fix**: added `/app/frontend/src/lib/openLink.js` — `openExternal(url)` that detects `Capacitor.isNativePlatform()` and calls `window.open(url, '_system')` (Capacitor hook that forces the OS default browser) on native, and `window.open(url, '_blank', 'noopener,noreferrer')` with a top-level nav fallback on web. Wired it into the PayPal.me deep-link tap in `AdminPanel.jsx` and the WhatsApp broadcast opener in `lib/broadcast.js`.
- **Verified**: 71/71 backend pytest green; smoke on preview home + demo match load OK. Real-device install/tap re-test required from the user — the sandbox has no physical Android.

### P1 — Production database cleanup + safe seeding
- **`SEED_DEMO` env gate** in `server.py` startup: demo match is only seeded when `SEED_DEMO=true`. Preview `.env` now has this flag; production must leave it unset so the live DB is never seeded with synthetic data.
- **`/app/backend/scripts/cleanup_test_data.py`** — production-safe cleanup script. Dry-run by default; prints counts before/after; requires typing the DB name to confirm; supports `--keep-demo` to preserve the seeded demo match. Reads `MONGO_URL`/`DB_NAME` from backend env so you point it at production by exporting the production connection string.
- **Preview DB cleaned**: removed 236 matches, 622 players, 19 mvp_votes, 322 rating_history, 105 player_stats, 55 groups. Preserved the demo match (1 match + 10 players + 10 votes) so the /demo route keeps working.
- **User action for production**: `export MONGO_URL=... DB_NAME=... && python -m scripts.cleanup_test_data --apply` from `/app/backend/`. (Do NOT set `SEED_DEMO=true` in production.)

## Implemented (2026-02, **v1.4** — Android install hang fix)
### P0 — Maskable icon + manifest cleanup
- **Root cause identified**: `manifest.json` icons declared `"purpose": "any maskable"` but artwork extended to the outer 5-8% of the canvas (no safe zone). Android's adaptive-icon renderer requires ~20% padding; when it can't produce a valid adaptive icon, some Android versions silently hang the install. The SVG entry (`favicon.svg`, `sizes: "any"`) also confused Chrome-on-Android's icon picker.
- **Fix applied**:
  - Generated `/app/frontend/public/icon-512-maskable.png` and `icon-192-maskable.png` — original pitch artwork scaled to 66% of canvas, centered on the brand-color background (`#050A07`). Full safe-zone padding for any launcher mask.
  - Rewrote `manifest.json` icons array: 2× `"purpose": "any"` (original icons) + 2× `"purpose": "maskable"` (new padded icons). Dropped the SVG entry (still linked in `index.html` via `<link rel="icon">` for browser tabs).
  - Added `"id": "/"` for stable install-app identity.
  - Bumped SW cache to `fairxi-v3` and precached the new icons so returning users pick up the corrected manifest immediately.
- **Verification**:
  - `curl` confirms `/manifest.json`, `/icon-512-maskable.png`, `/icon-192-maskable.png`, `/service-worker.js` all serve 200 with correct content-type.
  - Mask-preview render (circle + squircle) confirms pitch artwork stays fully within safe zone under any launcher mask.
  - **Real-device install re-test required by the user** — sandbox has no physical Android device.

### Capacitor Native Wrap — infrastructure (P0)
- `@capacitor/core|cli|android|ios|share|app` v7 installed
- `/app/frontend/capacitor.config.json` — `appId: com.vorneaux.fairxi`, `appName: FairXI`, `webDir: build`, dark background color
- `/app/frontend/android/` — full Android Studio project scaffold, ready to open + sign + build (needs Android Studio + user's keystore)
- `/app/frontend/ios/` — full Xcode project scaffold, ready to open on a Mac (needs `pod install` + Apple developer account)
- **Native-safe web code**: `recap.js` `shareOrDownloadBlob` uses `@capacitor/share` when `Capacitor.isNativePlatform()`, falls back to Web Share API + download in browsers; `index.js` SW registration and `InstallPromptContext` beforeinstallprompt listener both no-op inside the native shell

### Router Unit Tests (P1)
- 20 new tests across `test_router_matches.py`, `test_router_mvp.py`, `test_router_groups.py`, `test_router_players.py` + shared `conftest.py` (session-scoped TestClient)
- Full backend pytest suite now **68/68 green** — protects the v1.2 split from future regressions

### MOTS Confetti (P2)
- 32-particle burst (lime + white, mixed squares/dots, randomised angles and spin) synced with the trophy pop
- `pointer-events: none`, `aria-hidden`, keyed to threshold → new burst on each reveal cycle
- On-brand, tasteful (~1.6s), doesn't block the backdrop-to-dismiss gesture

### Store Metadata Draft (P3)
- `/app/store_submission.md` — Play + App Store titles, short/full descriptions, keyword lists, content-rating questionnaire answers, App Privacy answers, screenshot shot list
- `/app/native_store_checklist.md` — the exact manual steps left for the user (keystore, pod install, Xcode archive, Play Console upload, App Store Connect flow)

## Store-Readiness Report (updated)
### Ready — new in v1.3
- Capacitor Android + iOS project scaffolds committed and ready to open
- All web code native-safe (no Web-only APIs blow up in a WebView)
- Complete store copy + questionnaire answers drafted
- 20 router unit tests protect the backend from future regressions

### Requires the user (manual, outside this environment)
1. Install Android Studio locally + open `/app/frontend/android/` → generate keystore → build signed `.aab`
2. On a Mac: install Xcode + CocoaPods → `cd /app/frontend/ios/App && pod install` → open in Xcode → Archive
3. Pay Google Play ($25) + Apple Developer ($99/yr) fees
4. Play Console + App Store Connect setup (see `/app/native_store_checklist.md`)
5. Optional: commission a 2732×2732 splash source PNG (current largest icon in repo is 512px)
### Backend router split (P0) — zero behavior change
- New `/app/backend/deps.py` — shared models, db client, api_router prefix, helpers (`snake_draft`, `rate_limit`, `is_voting_closed`, `get_match_or_404`, etc.)
- Endpoints extracted into `routers/matches.py`, `routers/mvp.py`, `routers/groups.py`, `routers/players.py`
- `server.py` reduced from 923 → 114 lines; only wires app + CORS + demo seed
- Full pytest suite (48/48 across all prior iterations) passes with **zero test modifications**

### Public Privacy page (P1) — store-submission blocker cleared
- `/privacy` route (public, no auth) styled with the FairXI design system (Bebas Neue hero, lime accents, glass sections, pitch-circle motif)
- Accurately describes what's collected today: phone, ratings, participation, MVP votes, payment toggles
- Explicit "no data sold, no third parties, payment links generated client-side"
- Global `AppFooter` component with `/privacy` link on every non-Home route; Home footer also links to `/privacy`

### MOTS Trophy Reveal (P2)
- `/app/frontend/src/components/MOTSReveal.jsx` — fullscreen slow-reveal splash
- Trigger thresholds default `[5, 10, 25, 50]` played matches (configurable via `computeRevealThreshold` prop)
- Fires **at most once per group per threshold**, tracked in `localStorage["fairxi_mots_reveals_seen"]`
- Slow reveal in 5 stages: tagline → label → trophy pop → name → CTAs
- Dismissible: X button, ESC key, or backdrop click; non-blocking (does not disable dashboard behind it)
- Reuses the existing `downloadGroupRecap` / `shareGroupRecap` for shareable season snapshot

## Store-Readiness Report (updated)
### Ready — new in v1.2
- Public `/privacy` URL you can paste into the Play/App Store submission form
- Backend structure now scales for future additions (routers not a monolith)

### Still outside this perimeter — next generation (Capacitor)
1. Capacitor wrap + Play/App Store submission (accounts, keystore, cert, screenshots, metadata, privacy questionnaire)
2. Real payment gateway (currently link-only, by design)
3. Multi-worker rate limiting via nginx/Cloudflare/Redis
4. Native push notifications
5. Admin token rotation policy

## Implemented (2026-02, **v1.1**)
### Dynamic Rating Engine (P0)
- `rating_engine.py` — Elo-inspired, 1.0–5.0 scale, K=0.15, MVP bonus 0.05/vote, clamped
- `POST /matches/{id}/admin/{token}/mark-played` accepts `{winning_team: int|null}`, is now **idempotent** (double-tap safe; re-scans rating_history before recomputing)
- `GET /players/{phone}/rating-history` — current rating + full history array
- `snake_draft` uses `effective_rating` (dynamic if known, else seed) — better balancing over time
- `db.player_stats` + `db.rating_history` collections

### Persistent Groups (P1)
- `POST /groups`, `GET /groups/{id}/admin/{token}` (dashboard w/ standings + MVP leaderboard + top gainers), `POST /groups/{id}/admin/{token}/matches`
- Frontend: `/groups` (create + list), `/group/:id/:token` (dashboard), `/group/:id/:token/new-match`
- Match doc gains optional `group_id`; ungrouped matches still work identically
- LocalStorage: `getMyGroups`, `addMyGroup`

### Season Recap + Man of the Season (P2)
- `renderGroupRecap` in `recap.js` — portrait 1080×1350 PNG with top-6 standings + MOTS + top gainer, Web Share API + download fallback
- MOTS leaderboard + Top Gainers panels on group dashboard

### WhatsApp broadcast + Payment deep-links (P3)
- `buildBroadcastMessage` + `openWhatsAppBroadcast` in `lib/broadcast.js` — one-tap pre-filled team announcement
- `PAY_PROVIDERS` (PayPal.me / Revolut / Satispay) — hardened builders that reject NaN/negative amounts and format to 2 decimals; organizer's handle persisted in localStorage
- `PaymentDeepLink` component embedded in Admin panel Payments section (Copy Link + open in provider app)

### Senior review fixes (P4)
- **mark-played idempotency** — flagged in code review, fixed same iteration; double-call no longer double-counts matches_played or duplicates rating_history rows
- Amount hardening in PAY_PROVIDERS builders
- PlayerHistory now shows dynamic `current_rating` + inline `RatingSparkline` when trend has >1 point
- New `Groups` link in nav (desktop + mobile menu)

## Store-Readiness Report (updated)
### Ready
- Manifest, 192/512 maskable + apple-touch icons, favicon.svg
- HTTPS PWA with SW v2 + update-notification flow, offline shell
- Admin tokens 192-bit entropy
- Idempotent match result flow (safe for retries/lossy networks)

### Still outside this perimeter (Capacitor wrap + store submission)
1. Capacitor wrap (`@capacitor/core` + `android` + `ios`), `cap init` + `cap add android/ios`
2. Google Play Console ($25) + Apple Developer Program ($99/yr) accounts
3. Splash screen 2732×2732 master
4. Store metadata + screenshots (Play: 2 phone; App Store: 6.5" + 5.5")
5. Public privacy policy URL (declares phone + rating collection)
6. Data safety / App Privacy questionnaires
7. Signed Android keystore + iOS distribution certificate/provisioning profile
8. Multi-worker rate limiting via nginx/Cloudflare/Redis
9. Admin token rotation policy
10. **Backend split** into routers (matches.py, groups.py, mvp.py, ratings.py) — server.py is ~920 lines; recommended before next major release
11. **Real payment gateway** (Stripe Connect etc.) — only link-generation today
12. **Native push notifications** — none yet

## Backlog
- P1: Optional rating recalibration per match (organizer edits player rating).
- P1: SMS/email notifications when teams are generated.
- P2: Group/league accounts to persist rosters across weeks.
- P2: Multi-language UI.
