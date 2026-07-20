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

## Implemented (2026-02, v1.0-rc)
- **Backend**: /matches CRUD, /join, /generate-teams, /reassign, /payment, **/rating**, /mark-played, /open-mvp, /mvp/verify, /mvp/vote (real-time results, 24h auto-close), /history, /demo, /bulk-add. Admin tokens strengthened to 32-char (~192 bits). Lightweight in-memory `rate_limit()` on create/join/vote.
- **Frontend**: Home (hero + live demo), CreateMatch (Load Saved Squad + **inline validation, focus-first-error**), MatchCreated (public/admin/vote links, WhatsApp share), JoinPage (rating slider + waitlist + checkmark + **inline phone/name validation**), AdminPanel (roster, **inline rating dropdown**, generate teams w/ stagger, dropdown reassign, payments, mark-played, open-MVP, Save/Load Squad, Recap card, **empty-state hero**), MVPVoting (verify + teammate picker + live bar chart + checkmark + Recap Share/Download), PlayerHistory (**EmptyState for 0 matches**), MyMatches (organizer dashboard).
- **Architecture fix (P0)**: `InstallPromptProvider` at App root captures `beforeinstallprompt` once for the whole session; both desktop and mobile `InstallButton` consume via `useContext`. Solves the "install button disappears after menu reopen" bug.
- **PWA**: manifest.json, service-worker.js v2 with SKIP_WAITING message flow, `fairxi:update-available` custom event + sonner toast with Reload action, `controllerchange` auto-refresh; 192/512 maskable icons + apple-touch-icon.
- **Performance**: All routes lazy-loaded via `React.lazy` + `Suspense` with a themed `PageLoader` skeleton.
- **Recap Card**: Canvas 2D 1080×1350 PNG generator with teams grid + MVP hero + FairXI branding. Web Share API with download fallback.
- Design system: stadium-at-night theme, geometric pitch-line motifs, glassmorphism panels, spin-slow center circles, no generic icons. `.tap` utility for consistent press feedback, 44px min touch targets on mobile.

## Store-Readiness Report (P3)
### Ready
- Manifest v1 with name/short_name/scope/display=standalone/orientation=portrait
- Icons 192 + 512 (maskable) + apple-touch-icon (180)
- Theme + background colors, favicon SVG
- HTTPS, service worker, offline shell
- Admin tokens with 192-bit entropy in URLs

### Missing for actual Play/App Store publication (outside this perimeter)
1. **Capacitor wrap** — install `@capacitor/core` + `@capacitor/android` + `@capacitor/ios`, run `npx cap init`, point `webDir` to the React `build/`, then `cap add android` and `cap add ios`. Not implemented — requires a native build environment.
2. **Store accounts** — Google Play Console ($25 one-time) and Apple Developer Program ($99/year).
3. **Splash screens** — Capacitor generates from icons; needs a 2732×2732 source PNG for best quality.
4. **Store metadata** — app title (max 30 chars), short description, full description, category, content rating questionnaire.
5. **Store screenshots** — Play Store requires 2 phone screenshots minimum; App Store requires 6.5" + 5.5" iPhone screenshots.
6. **Privacy policy URL** — required by both stores; must live at a public HTTPS URL and cover phone number collection.
7. **Data safety form** (Play) / **App Privacy** (Apple) — declare that phone numbers, self-ratings, and match data are collected; declare no third-party sharing.
8. **Signed builds** — Android needs keystore (long-lived); iOS needs distribution certificate + provisioning profile.
9. **Multi-worker rate limiting** — current `rate_limit()` is in-memory and doesn't scale across workers/pods; put nginx/Cloudflare/Redis rate limit in front before opening to real traffic.
10. **Admin token rotation** — currently a token lives forever; consider expiring admin tokens after N days as a defense-in-depth measure.

## Backlog
- P1: Optional rating recalibration per match (organizer edits player rating).
- P1: SMS/email notifications when teams are generated.
- P2: Group/league accounts to persist rosters across weeks.
- P2: Multi-language UI.
