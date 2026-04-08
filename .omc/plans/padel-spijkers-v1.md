# Padel Spijkers v1 - Implementation Plan

**Date:** 2026-04-03
**Status:** DRAFT v3 - Open questions resolved
**Complexity:** HIGH (greenfield full-stack + mobile)

---

## Context

Bandeja Padel Spijkers has an existing static HTML/CSS website with brand guidelines and 8 detailed app screen mockups (`app/screens/`). The design system is fully defined in `app/css/app.css` with variables, colors (dark theme, green accent `#2ECC71`), typography (Barlow Condensed), and component patterns.

The goal is to build:
1. A **custom REST API** (source of truth for players, ELO, matches)
2. A **Flutter mobile app** (iOS + Android) that consumes the API and deeplinks to the existing WordPress/WooCommerce site for commerce

WordPress/WooCommerce remains the commerce platform. Playpass remains for live tournament management. The custom API owns player identity (email-based) and ELO ratings.

**Padel is always doubles (2v2).** Every match has 4 players across 2 teams. The data model, ELO engine, and all UI reflect this.

---

## Work Objectives

1. Stand up a production-ready REST API with player identity, doubles-ELO calculation, and tournament/match data
2. Build a Flutter app matching the existing mockup designs with real API integration
3. Connect to WordPress REST API for tournament/lesson/clinic listings
4. Implement email-based identity matching via WooCommerce webhook

---

## Guardrails

### Must Have
- Email as the sole identity key (verified via WooCommerce purchase)
- Per-match ELO calculation for all 4 players in a doubles match
- Deeplinks to WordPress for all commerce actions (registration, payment)
- Public leaderboard (no auth required)
- Authenticated player profile with history and ELO graph
- Custom API as single source of truth for player data
- 9-tier ranking system mapped from ELO scores

### Must NOT Have
- In-app payments or WooCommerce checkout in-app
- Custom tournament bracket system (Playpass handles this)
- Web version of the app
- Push notifications
- Multi-club support

---

## Task Flow (6 Phases)

### Phase 1: Project Scaffolding & Database Schema
**Goal:** Monorepo structure, database, and API skeleton running locally.

**Tasks:**
1. Initialize monorepo structure:
   ```
   padel-spijkers/
   ├── api/                  # Backend (Node.js/TypeScript)
   │   ├── src/
   │   │   ├── routes/
   │   │   ├── models/
   │   │   ├── services/
   │   │   ├── middleware/
   │   │   └── utils/
   │   ├── prisma/
   │   └── tests/
   ├── app_flutter/          # Flutter app
   │   ├── lib/
   │   │   ├── models/
   │   │   ├── providers/    # Riverpod providers
   │   │   ├── services/
   │   │   ├── screens/
   │   │   ├── widgets/
   │   │   └── theme/
   │   └── test/
   ├── docs/                 # API docs, architecture decisions
   └── app/                  # Existing mockups (preserved as reference)
   ```
2. Define PostgreSQL schema with migrations for 5 tables:
   - **Player** - `id`, `email`, `name`, `avatar_url`, `woocommerce_id`, `elo_rating` (default 1200), `matches_played` (default 0), `current_tier` (computed or cached), `role` (player/admin), `created_at`, `updated_at`
   - **Tournament** - `id`, `name`, `description`, `date`, `location`, `wp_post_id`, `status` (upcoming/active/completed), `created_at`
   - **Match** - `id`, `tournament_id` (FK), `round`, `team1_player1_id` (FK Player), `team1_player2_id` (FK Player), `team2_player1_id` (FK Player), `team2_player2_id` (FK Player), `score_team1`, `score_team2`, `winning_team` (1 or 2), `played_at`, `created_at`
   - **TournamentParticipation** - `id`, `tournament_id` (FK), `player_id` (FK), `partner_id` (FK Player, nullable), `final_position`, `registered_at`
   - **EloHistory** - `id`, `player_id` (FK), `match_id` (FK), `elo_before`, `elo_after`, `created_at`
3. Seed database with test data (10 players, 3 tournaments, sample doubles matches)
4. Basic health check endpoint running on localhost

**Acceptance Criteria:**
- [ ] `docker compose up` (or equivalent) starts PostgreSQL + API
- [ ] Migrations create all 5 tables (Player, Tournament, Match, TournamentParticipation, EloHistory) with correct relationships
- [ ] Match table enforces doubles structure: 4 player FK columns, team scores, winning_team constraint (1 or 2)
- [ ] Seed script populates test data with valid doubles matches
- [ ] `GET /health` returns 200

---

### Phase 2: Core API - Auth & Player Management
**Goal:** JWT authentication, player CRUD, WooCommerce webhook integration with signature verification.

**Tasks:**
1. Implement JWT auth flow: register (email+password), login, refresh token
2. Player endpoints: `GET /players`, `GET /players/:id`, `PUT /players/:id`
3. WooCommerce webhook receiver: `POST /webhooks/woocommerce/order-completed`
   - Validate `X-WC-Webhook-Signature` header using HMAC-SHA256 with shared secret
   - On order completion, match customer email to existing player or create new player record
   - Store `woocommerce_id` for future reference
   - Reject requests with invalid or missing signature (401)
   - **Setup:** Jeffrey configures the webhook directly in WooCommerce → Instellingen → Geavanceerd → Webhooks (WP admin access confirmed)
4. Email verification flow (lightweight: confirm email matches a WooCommerce purchase)
5. Public vs. authenticated route middleware

**Acceptance Criteria:**
- [ ] Register/login returns valid JWT; protected routes reject invalid tokens
- [ ] WooCommerce webhook validates `X-WC-Webhook-Signature` (HMAC-SHA256) before processing
- [ ] Webhook rejects requests with invalid/missing signature with 401
- [ ] WooCommerce webhook creates/links player record by email
- [ ] Player profile endpoint returns full player data when authenticated
- [ ] Public endpoints (leaderboard) work without auth

---

### Phase 3: Core API - Tournaments, Matches, ELO Engine & Tier System
**Goal:** Full tournament/match data model with working doubles-ELO calculation and tier mapping.

**Tasks:**
1. Tournament endpoints: `GET /tournaments`, `GET /tournaments/:id` (includes participants & matches)
2. Match endpoints: `POST /matches` (admin), `GET /matches?tournament_id=X`
   - Match creation requires all 4 player IDs, both team scores, and winning_team
3. Doubles-ELO engine service:
   - Team rating = average of both team members' individual ELO
   - Apply standard ELO formula: expected score based on team rating difference
   - **K-factor: gemengd systeem** — K=40 voor spelers met <30 gespeelde matches, K=20 voor spelers met ≥30 matches
   - K-factor per speler afzonderlijk berekend op basis van hun `matches_played` teller
   - All 4 players in a match are updated: winners gain ELO, losers lose ELO
   - Store before/after ELO per player in `EloHistory` (4 records per match)
   - Support bulk recalculation (admin: rebuild all ELO from match history)
   - Add `matches_played` counter to Player (increment on each match entry)
4. **Tier System:**
   - 9 tiers mapped from ELO ranges:
     | Tier | Name | KNLTB Equivalent |
     |------|------|------------------|
     | 1 | Elite | KNLTB 1-2 |
     | 2 | Pro+ | KNLTB 2-3 |
     | 3 | Pro | KNLTB 3-4 |
     | 4 | Semi-Pro | KNLTB 4-5 |
     | 5 | Advanced | KNLTB 5-6 |
     | 6 | Intermediair | KNLTB 6-7 |
     | 7 | Beginner+ | KNLTB 7-8 |
     | 8 | Beginner | KNLTB 8-9 |
     | 9 | Starter | Ongerankt |
   - ELO-to-tier boundary values stored in DB config table (admin-adjustable)
   - Player `current_tier` is a computed property derived from `elo_rating` + tier config
   - "X toernooien tot volgende niveau" calculation: based on average ELO gain per tournament for that player (or global average if insufficient data)
5. Tournament participation: link players to tournaments with partner and final position
6. Leaderboard endpoint: `GET /leaderboard` (sorted by ELO, includes tier, paginated, public)
7. Player stats aggregation: W/L record, tournaments played, ELO history, tier progression
8. Partner stats endpoint: `GET /players/:id/partners`
   - Aggregates match data per team combination (partner_id, matches_together, wins, losses, win_rate)
   - Returns sorted by matches_together descending
   - **Scope decision: Partners screen is v2.** This endpoint enables basic partner data on the profile screen. The full Partners screen (`partners.html` mockup with detailed analytics, shared match history, "Samen inschrijven" CTA) is deferred to v2.

**Acceptance Criteria:**
- [ ] Adding a match result updates all 4 players' ELO and creates 4 EloHistory records
- [ ] Team ELO is calculated as average of both team members' ratings
- [ ] Player tier is correctly derived from ELO rating using configurable tier boundaries
- [ ] Tier boundaries are stored in DB and adjustable by admin
- [ ] "Toernooien tot volgende niveau" calculation returns a reasonable estimate
- [ ] Leaderboard returns players sorted by ELO with rank position and tier
- [ ] Player profile includes tournament history, W/L stats, ELO graph data, and current tier
- [ ] `GET /players/:id/partners` returns partner win-rate aggregations
- [ ] Full ELO rebuild from scratch produces identical results to incremental calculation

---

### Phase 4: WordPress Integration Layer
**Goal:** Proxy/aggregate WordPress content for the app.

**Tasks:**
1. WordPress service: fetch tournaments, lessons, clinics from WP REST API (`/wp-json/wp/v2/`)
   - **Auth:** WordPress Application Password vereist (`Authorization: Basic base64(user:app_password)`)
   - Sla credentials op als environment variables: `WP_API_URL`, `WP_API_USER`, `WP_API_PASSWORD`
2. Caching layer: cache WP responses (5-15 min TTL) to avoid rate limits
3. Content endpoints:
   - `GET /content/tournaments` - upcoming tournaments with WP post data + custom API tournament data merged
   - `GET /content/lessons` - lessons/trainingen from WP
   - `GET /content/clinics` - clinics from WP
4. Deeplink URL builder: generate correct WooCommerce product/registration URLs for each item

**Acceptance Criteria:**
- [ ] App receives tournament list combining WP content (title, image, description) with API data (participants, results)
- [ ] Lessons and clinics return with correct deeplink URLs to WooCommerce
- [ ] WP data is cached; API remains responsive if WP is slow

---

### Phase 5: Flutter App - UI & Integration
**Goal:** Fully functional Flutter app matching the existing mockup designs.

**Tasks:**
1. Flutter project setup with theme system matching `app/css/app.css`:
   - Dark theme: `#0E1014` background, `#2ECC71` accent, Barlow Condensed typography
   - Design tokens mapped from CSS variables to Flutter ThemeData
   - Ranking color palette (rank-1 through rank-9 tier colors)
2. State management: **Riverpod** for all app state (providers for auth, player, tournaments, matches, leaderboard)
3. Implement screens (matching existing HTML mockups):
   - **Splash** (`splash.html`) - animated logo
   - **Home** (`home.html`) - greeting, upcoming tournaments, quick stats, leaderboard preview section
   - **Toernooien** (`toernooien.html`) - tournament list with search/filter
   - **Toernooi Detail** (`toernooi-detail.html`) - tournament info + "Inschrijven" button (see task 6 for flow)
   - **Profiel** (`profiel.html`) - player profile with ELO, tier badge, badges, stats, partner summary
   - **Resultaten** (`resultaten.html`) - match results with W/L summary tiles, doubles format (team vs team)
   - **Inschrijvingen** (`inschrijvingen.html`) - registration history with segment control
   - ~~**Partners** (`partners.html`)~~ - **Deferred to v2.** Basic partner data visible on Profiel screen via partner stats endpoint.
4. API service layer: HTTP client with JWT token management, retry logic
5. Deep linking: open WooCommerce URLs in external browser for registration/payment
6. **Bottom tab navigation (5 tabs matching mockups):**
   - Home
   - Toernooien
   - Inschrijven (center FAB / prominent action button)
   - Resultaten
   - Profiel

   Note: Leaderboard/Ranglijst is NOT a tab. It appears as a section within Home and/or as a sub-view accessible from Resultaten.
7. **"Inschrijven" flow (v1 = deeplink to WooCommerce):**
   - The in-app UI shows a pre-fill form with partner selection (matching the toernooi-detail mockup)
   - On "Bevestigen", the app constructs a WooCommerce deeplink URL with pre-filled parameters (tournament product ID, partner name/email)
   - The actual transaction completes in the device browser via WooCommerce
   - This keeps commerce on WordPress (Principle 1) while giving users partner selection UX in-app

**Acceptance Criteria:**
- [ ] 7 screens implemented (Partners deferred to v2) and visually match the HTML mockups
- [ ] Login/register flow works end-to-end with the API
- [ ] 5-tab navigation: Home, Toernooien, Inschrijven (center FAB), Resultaten, Profiel
- [ ] Leaderboard appears as section in Home, not as a separate tab
- [ ] Leaderboard shows real ELO data with tier badges, updates after match entry
- [ ] Match results display doubles format (team1 vs team2, all 4 players shown)
- [ ] "Inschrijven" flow shows in-app partner selection, then deeplinks to WooCommerce for transaction
- [ ] Deeplinks open correct WooCommerce pages in device browser
- [ ] Riverpod manages all app state (auth, data, UI state)
- [ ] Player profile shows current tier, tier name, and "toernooien tot volgend niveau"
- [ ] App works on both iOS and Android simulators

---

### Phase 6: Admin Features & Deployment
**Goal:** Admin can enter match results; app is deployed to test environment.

**Tasks:**
1. Admin role in API (simple role field on Player, admin middleware)
2. Admin endpoints: create tournament, enter match results (all 4 players + scores), trigger ELO rebuild
3. Admin match entry validation: all 4 player IDs must be valid, winning_team must be 1 or 2, scores must be consistent with winning_team
4. macOS desktop admin panel (Flutter desktop target) OR simple admin routes in API + Postman collection
5. **Deployment: eigen server met Docker**
   - Schrijf `Dockerfile` voor de Node.js API (multi-stage build)
   - Schrijf `docker-compose.yml` met services: `api`, `postgres`
   - Environment variables via `.env` file op de server (niet in git)
   - Nginx reverse proxy voor HTTPS (Let's Encrypt)
   - GitHub Actions CI/CD: build Docker image → push naar registry → deploy op server via SSH
6. CI/CD: GitHub Actions voor API tests + Flutter build + Docker image push
7. TestFlight (iOS) en internal testing track (Android) setup

**Acceptance Criteria:**
- [ ] Admin can create a tournament and enter doubles match results (4 players, team scores, winning team)
- [ ] Match result entry triggers ELO recalculation for all 4 players automatically
- [ ] Admin can adjust tier boundary configuration
- [ ] API is deployed and accessible via HTTPS
- [ ] App builds successfully for iOS and Android in CI
- [ ] At least 1 test user can install via TestFlight/internal track

---

## Success Criteria (Overall v1)

- [ ] App shows tournaments fetched from WordPress REST API
- [ ] Tapping "Inschrijven" shows in-app partner selection then deeplinks to WooCommerce
- [ ] Public leaderboard sorted by ELO with tier badges is accessible without login
- [ ] Logged-in player sees profile: ELO score, tier (1-9), tournament history, W/L record
- [ ] Per-tournament results visible with doubles format (all 4 players per match)
- [ ] 100% email-based player identity matching (WooCommerce webhook with signature verification)
- [ ] Lessons/clinics/trainingen visible with deeplinks
- [ ] ELO recalculates correctly for all 4 players after each match result entry
- [ ] 9-tier system correctly maps ELO ranges to tier names
- [ ] Custom REST API is the sole source of truth for player data and ELO
- [ ] 5-tab navigation matches mockup structure

---

## Deferred to v2

| Feature | Reason | Reference |
|---------|--------|-----------|
| Partners screen (full `partners.html`) | Complex analytics, not core to MVP | Phase 5 task 3 |
| In-app WooCommerce checkout | Principle 1: commerce stays on WordPress | Guardrails |
| Push notifications | Not in MVP scope | Guardrails |
| OpenAPI auto-generation | Nice-to-have, add tsoa/swagger-jsdoc later | ADR follow-up |

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend framework | Node.js/TypeScript (Express or Fastify) | Language consistency with Dart, speed to v1 |
| ORM/DB toolkit | Prisma | Type-safe queries, excellent migrations |
| Flutter state mgmt | Riverpod | Simpler than Bloc for this scope, sufficient for app complexity |
| Hosting | Eigen server + Docker | Bestaande server beschikbaar, geen hostingkosten, volledige controle |
| Admin panel | API-only + Postman for v1 | Faster than building a UI |

---

# RALPLAN-DR Summary

## Principles (5)

1. **WordPress stays for commerce** - The app never handles payments. All purchase flows deeplink to WooCommerce. The "Inschrijven" flow provides in-app partner selection UX but the transaction completes in WooCommerce via browser deeplink.
2. **Email is the identity anchor** - Player identity is resolved exclusively via email. No username-based matching, no Playpass ID dependency.
3. **ELO requires match-level granularity (doubles)** - ELO is calculated per individual doubles match. Team rating = average of both players' ELO. All 4 players are updated per match. The data model captures every match with 4 player references.
4. **API as single source of truth** - The custom API owns all player/ELO/match data. WordPress and Playpass are data sources, not authorities.
5. **Mockups are the design spec** - The 8 HTML mockups in `app/screens/` define the UI contract. The Flutter app must match these designs (5-tab navigation, tier badges, doubles results format).

## Decision Drivers (Top 3)

1. **Speed to v1** - This is a club app for a padel community, not enterprise software. Getting a working v1 out fast matters more than architectural perfection.
2. **Maintainability by a small team** - Likely 1-2 developers. Tech choices must minimize operational overhead and cognitive load.
3. **Reliable ELO calculation** - The ELO rating is the core differentiating feature. It must be correct for doubles, auditable (history table with 4 records per match), and rebuildable from scratch.

## Viable Options

### Option A: Node.js + TypeScript + Prisma (Chosen)

**Pros:**
- Same language (TypeScript/Dart) across stack reduces context switching
- Prisma provides type-safe database access with excellent migration tooling
- Largest ecosystem for JWT, webhooks, REST APIs
- Easy deployment on Railway with zero config

**Cons:**
- Node.js single-threaded model (not an issue at this scale)
- Prisma adds a build step and binary dependency

### Option B: Python + FastAPI + SQLAlchemy (Not chosen)

**Pros:**
- FastAPI auto-generates OpenAPI docs (useful for Flutter client generation)
- Python numerical libraries available if ELO calculation becomes complex
- SQLAlchemy is battle-tested and flexible

**Cons:**
- Two completely different languages in the stack (Python + Dart)
- FastAPI deployment requires more config (uvicorn, gunicorn)
- Async SQLAlchemy has a steeper learning curve than Prisma

**Why Option B was not chosen:** For a small-team club app, the cognitive overhead of maintaining two language ecosystems (Python backend + Dart frontend) outweighs the OpenAPI auto-generation benefit. The ELO calculation is standard arithmetic that does not benefit from Python's scientific libraries.

## ADR: Backend Technology Choice

- **Decision:** Node.js + TypeScript + Prisma + PostgreSQL
- **Drivers:** Speed to v1, small team maintainability, language consistency with Flutter/Dart
- **Alternatives considered:** Python + FastAPI + SQLAlchemy
- **Why chosen:** Minimizes context switching for a 1-2 person team; Prisma provides type-safe migrations and queries; simplest deployment path on Railway
- **Consequences:** Team must be comfortable with TypeScript; Prisma binary adds ~15MB to deployment; no auto-generated OpenAPI docs (must add manually or use tsoa/swagger-jsdoc)
- **Follow-ups:** If OpenAPI auto-generation becomes important, consider adding tsoa or swagger-jsdoc to the Node.js API

## ADR: Doubles Match Data Model

- **Decision:** Match table stores 4 player FKs (`team1_player1_id`, `team1_player2_id`, `team2_player1_id`, `team2_player2_id`), `score_team1`, `score_team2`, `winning_team` (1 or 2)
- **Drivers:** Padel is always doubles; ELO must update all 4 players; UI must show team compositions
- **Alternatives considered:** (a) Separate MatchPlayer join table with team assignment, (b) Singles-style player1/player2 columns
- **Why chosen:** Fixed 4-column structure is simpler to query and enforce than a join table; padel never has singles or >2-per-team so flexibility is unnecessary. Option (b) was invalid because padel is always doubles.
- **Consequences:** Schema is rigid to exactly 4 players per match (correct for padel); queries for "all matches involving player X" need OR across 4 columns (mitigated by indexed FKs)
- **Follow-ups:** If mixed doubles or other formats emerge, revisit with join table approach

## ADR: Inschrijven Flow (v1)

- **Decision:** In-app partner selection UI that deeplinks to WooCommerce for the actual transaction
- **Drivers:** Principle 1 (commerce on WordPress), mockup shows in-app form with partner selection
- **Alternatives considered:** (a) Full in-app form with WooCommerce API write, (b) Direct deeplink without in-app UI
- **Why chosen:** Option (a) requires WooCommerce API write access and payment handling complexity inappropriate for v1. Option (b) ignores the mockup's partner selection UX. The hybrid approach gives users the expected UX while keeping commerce on WordPress.
- **Consequences:** Partner selection data must be encodable in a URL; WooCommerce product pages may need customization to accept pre-filled partner data
- **Follow-ups:** If WooCommerce URL pre-fill proves too limited, consider WooCommerce API integration in v2
