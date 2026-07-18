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

## Implemented (2026-02)
- Backend: /matches CRUD, /join, /generate-teams, /reassign, /payment, /mark-played, /open-mvp, /mvp/vote (real-time results, 24h auto-close), /history, /demo.
- Frontend: Home (hero + live demo), CreateMatch, MatchCreated (public/admin/vote links, WhatsApp share), JoinPage (with rating slider + waitlist), AdminPanel (roster, generate teams, dropdown reassign, payment checkboxes, mark-played, open-MVP), MVPVoting (phone verify + teammate picker + live bar chart), PlayerHistory.
- Design system: stadium-at-night theme, geometric pitch-line motifs, glassmorphism panels, spin-slow center circles, no generic icons.

## Backlog
- P1: Optional rating recalibration per match (organizer edits player rating).
- P1: SMS/email notifications when teams are generated.
- P2: Group/league accounts to persist rosters across weeks.
- P2: Multi-language UI.
