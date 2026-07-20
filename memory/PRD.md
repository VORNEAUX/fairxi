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

## Implemented (2026-02, **v1.2**)
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
