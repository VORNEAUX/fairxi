# FairXI — Store Submission Metadata Draft (v1.3)

This is a **text-only draft** for the Play Store and App Store listings.
Copy-paste into the store consoles. Nothing here needs code changes —
review the wording, tweak to taste, and paste.

**Public URL:** https://fairxi.vorneaux.com
**Privacy Policy URL:** https://fairxi.vorneaux.com/privacy
**Bundle / Application ID:** `com.vorneaux.fairxi`
**Category (both stores):** Sports (secondary: Utilities)
**Content rating:** Everyone / 4+ (no user-generated content in the traditional sense — only names and self-declared skill ratings, no chat, no images).

---

## APP TITLE (max 30 chars — both stores)
Options (pick one):
- **`FairXI — Balanced Football`**  *(29 chars)*
- **`FairXI · Balanced Teams`**  *(23 chars)*
- **`FairXI: 5-a-Side Teams`**  *(22 chars)*

## SHORT DESCRIPTION (Play Store — max 80 chars)
> Balanced 5-a-side teams and fair pitch cost splitting for your football group.

*(79 chars)*

Alternative:
> Fair teams for casual football. Split the pitch. Vote MVP. Zero drama.

*(70 chars)*

## SUBTITLE (App Store — max 30 chars)
> **Balanced teams, split pitch** *(27 chars)*

## PROMOTIONAL TEXT (App Store — max 170 chars, updatable without review)
> Auto-balance 2/3/4 teams from your squad, split the pitch cost, vote MVP after
> the whistle, and track dynamic ratings across every match in your group.

## FULL DESCRIPTION (both stores)

```
FairXI turns "who's on which team?" and "who owes what?" into a two-tap
problem — for the Sunday-morning crew, the Tuesday-night regulars, and
every casual football group in between.

WHAT IT DOES
• Balanced teams — one tap generates fair 2, 3, or 4-team sides using a
  snake-draft on player ratings.
• Split the pitch cost — every player sees their share of the rental fee.
• MVP voting — after the match, teammates vote for who ran the show.
  Auto-closes 24 hours after opening.
• Persistent groups — save your regular crew and see cumulative standings,
  rating trends, and the Man of the Season across all your matches.
• Recap cards — share a portrait match or season recap PNG on WhatsApp
  or Instagram in one tap.
• Payment deep-links — one tap opens PayPal.me, Revolut or Satispay with
  the amount pre-filled (FairXI never touches money).
• Player history — enter your phone number to see your matches, rating
  trend, and MVP count.

HOW IT'S DIFFERENT
• Mobile-first, ad-free, no accounts. Just create a match and share the link.
• No SMS, no email, no push spam. Phone numbers are used only as a
  uniqueness key across matches.
• The MVP vote is one-vote-per-player, teammate-only, verified by phone.
• Ratings evolve — an Elo-style engine adjusts each player's rating after
  every match based on the result and MVP votes received.

PRIVACY (short version)
We store phone numbers, self-declared and dynamic ratings, MVP votes,
match participation, and the payment toggle. We do not sell or share
your data. Payment links are generated in your browser — no money moves
through FairXI. Full policy at https://fairxi.vorneaux.com/privacy.

Balanced teams. Split the pitch. Zero drama.
```

## KEYWORDS (App Store — max 100 chars, comma-separated)
```
football,soccer,5aside,team,pickup,match,mvp,pitch,split,fair,squad,elo,rating,casual
```

## LOCALIZATION
Ship English (EN) only for v1.0 store release. Italian (IT) is a good v1.1 add given the deploy domain.

---

## CONTENT RATING QUESTIONNAIRE

### Google Play — Content Rating Tool answers
- **Violence?** No
- **Sexual content?** No
- **Profanity?** No
- **Controlled substance references?** No
- **User-generated content?** Yes — players enter their name and self-declared skill rating (1-5). No chat, no images, no long-form UGC.
- **User-to-user contact?** No direct messaging; only MVP vote (single-select once per match).
- **Location sharing?** No
- **Personal information collected?** Phone numbers (uniqueness key, never used for contact). No email, no address.
- **Ads?** No (as of v1.3)
- **In-app purchases?** No
- **Digital purchases from users?** No (payment links open third-party apps)

Expected outcome: **Everyone** / **PEGI 3**

### Apple App Store — App Privacy questionnaire
Under "Data Linked to You":
- **Contact Info → Phone Number**: Purpose = App Functionality (uniqueness key). NOT used for tracking. NOT shared.
- **Identifiers → User ID**: The phone number *is* the identifier. Same declaration.
- **User Content → Other User Content**: player name, self-declared rating, MVP vote target. Purpose = App Functionality.
- **Usage Data**: NOT collected.
- **Diagnostics**: NOT collected.
- **Location**: NOT collected.
- **Purchases**: NOT collected (no IAP, no store transactions).
- **Tracking**: **No, this app does not use the user's data for tracking.**

---

## SCREENSHOTS

Google Play requires **at least 2** phone screenshots. App Store requires screenshots at **6.5"** (1284×2778) and **5.5"** (1242×2208). Same shots work — just re-export.

### Recommended shot list (7 total; ship the first 2-6 as you have budget)

1. **Live demo home hero** (`/`)
   Frame: "BALANCED TEAMS. SPLIT THE PITCH. ZERO DRAMA." headline + Create a Match CTA. This is the elevator pitch.

2. **Generated teams on Admin panel** (`/admin/:id/:token` after Generate Teams on a real match)
   Frame: Two colored team chips with 4-5 players each, showing positions + ratings. Sells the balancing feature.

3. **MVP vote in progress** (`/vote/:id`)
   Frame: The teammate picker on the left + Live Results bars on the right with one clear MVP leading.

4. **Group dashboard with standings** (`/group/:id/:token` — use the demo group)
   Frame: STANDINGS table + MOTS Leaderboard + Top Rating Gainers all visible.

5. **MOTS Trophy Reveal splash** (staged screenshot of the reveal overlay open on a group with 5+ matches)
   Frame: Big lime trophy + "MAN OF THE SEASON" + winning name + confetti burst caught mid-fire. Emotional shot.

6. **Season Recap PNG preview** (open the generated PNG at full resolution)
   Frame: The rendered portrait card. Doubles as feature graphic on Play.

7. **Player history with rating sparkline** (`/history` after searching a real phone)
   Frame: The three stats cards + rating trend sparkline + match rows with MVP badges.

### Feature graphic (Play Store, 1024×500)
Reuse the stadium-at-night hero background + FAIRXI logo + "Balanced teams. Split the pitch. Zero drama." tagline. Existing brand assets in `/app/frontend/public/` are the source.
