# Deep Interview Spec: Padel Spijkers — API Architectuur & App Platform

## Metadata
- Interview ID: padel-spijkers-001
- Rounds: 7
- Final Ambiguity Score: 16.8%
- Type: brownfield
- Generated: 2026-04-03
- Threshold: 20%
- Status: PASSED

## Clarity Breakdown
| Dimensie | Score | Gewicht | Gewogen |
|----------|-------|---------|---------|
| Goal Clarity | 0.90 | 35% | 0.315 |
| Constraint Clarity | 0.80 | 25% | 0.200 |
| Success Criteria | 0.82 | 25% | 0.205 |
| Context Clarity | 0.75 | 15% | 0.113 |
| **Total Clarity** | | | **0.833** |
| **Ambiguity** | | | **16.8%** |

---

## Goal

Bouw een multiplatform mobiele app (Flutter of React Native) voor Bandeja Padel Spijkers die:
1. Toernooien, lessen, trainingen en clinics toont met deeplinks naar de WordPress/WooCommerce website voor inschrijving en aankoop
2. Een publiekstoegankelijke ranglijst toont van alle spelers op basis van een ELO-ratingsysteem
3. Elke ingeschreven speler een persoonlijk profiel geeft met toernooi-geschiedenis en hun actuele ELO-ranking
4. Verbonden is met een centrale custom REST API die player-identiteit, ELO-berekeningen en toernooi-resultaten beheert

De website (WordPress + WooCommerce) blijft het primaire commerce-platform. De app is het engagement-platform.

---

## Constraints

- **Identity-matching is 100% verplicht bij inschrijving**: Een app-gebruiker (geïdentificeerd via email na WooCommerce-aankoop) moet gegarandeerd correct gekoppeld zijn aan hun toernooi-deelnames voor ELO-berekening. Geen fuzzy matching.
- **Playpass beperking**: Playpass.com identificeert spelers alleen op voornaam. Dit maakt directe Playpass→App koppeling onmogelijk zonder tussenstap. Playpass kan blijven voor live toernooi-beheer, maar is niet leidend voor identity.
- **WordPress blijft voor commerce**: WooCommerce blijft de aankoop- en inschrijvingsflow beheren. De app navigeert naar de website voor transacties (geen in-app purchases voor v1).
- **ELO vereist per-match data**: ELO berekening vereist individuele wedstrijdresultaten (speler A vs speler B, score), niet alleen eindposities.
- **Multiplatform**: App moet werken op iOS en Android.

---

## Non-Goals (v1)

- In-app aankopen of betalingen afhandelen
- Een volledig eigen toernooi-bracket systeem bouwen (Playpass kan blijven voor live beheer)
- Web-versie van de app
- Push notificaties (nice-to-have, niet MVP)
- Internationale ondersteuning / meerdere clubs

---

## Acceptance Criteria

- [ ] App toont lijst van actieve toernooien opgehaald via WordPress REST API
- [ ] Klikken op een toernooi opent de toernooi-detailpagina op de website (deeplink / in-app browser)
- [ ] App toont een ranglijst van alle spelers gesorteerd op ELO-score
- [ ] Ingelogde speler ziet hun eigen profiel met: ELO-score, gespeelde toernooien, W/L record
- [ ] Speler-profiel toont per-toernooi resultaten (tegenstanders, scores, gewonnen/verloren)
- [ ] App-gebruiker is via email (geverifieerd via WooCommerce-aankoop) 100% correct gekoppeld aan hun toernooi-deelnames
- [ ] App toont lessen, trainingen en clinics met deeplink naar website voor meer info / boeken
- [ ] ELO-scores worden herberekend na elk ingevoerd toernooi-resultaat
- [ ] Custom REST API is de enige bron van waarheid voor spelerdata, ELO en resultaten

---

## Aanbevolen Architectuur

### Drie-laags systeem

```
┌─────────────────────────────────────────────────────────────┐
│                      MOBIELE APP                            │
│              (Flutter of React Native)                       │
│         iOS + Android, multiplatform                         │
└───────────┬───────────────────────┬─────────────────────────┘
            │                       │
            ▼                       ▼
┌───────────────────┐   ┌──────────────────────────────────┐
│  WordPress        │   │  Custom REST API                 │
│  REST API         │   │  (Node.js / Python / Go)         │
│                   │   │                                  │
│  • Toernooien     │   │  • Player Registry (email-based) │
│  • Lessen         │   │  • ELO Engine                    │
│  • Clinics        │   │  • Match Results                 │
│  • Trainingen     │   │  • Tournament History            │
│  • (WooCommerce)  │   │  • Player Profiles               │
└───────────────────┘   └──────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │  Playpass (optioneel) │
                        │  Live tournament mgmt │
                        │  (admin-side only)    │
                        └───────────────────────┘
```

### Waarom NIET de WordPress REST API als enige backend

WordPress REST API is geschikt voor het ophalen van content (toernooien, lessen). Maar voor ELO-rankings en spelersprofielen is het **niet geschikt** omdat:
1. ELO vereist custom berekeningen en match-history — niet native in WordPress
2. WordPress Custom Post Types voor players/rankings worden complex en slecht schaalbaar
3. Identity-matching (email-verified users ↔ Playpass naam) vereist custom logica buiten WordPress
4. Security: spelerdata en authenticatie hoor je niet door WordPress te routeren

### Identity Flow (hoe de 100% koppeling werkt)

```
1. Speler koopt toernooi-inschrijving op WooCommerce
   → Email + naam worden vastgelegd in WooCommerce order

2. Custom API webhook ontvangt WooCommerce order
   → Maakt/update Player record: {email, naam, woocommerce_customer_id}

3. Admin voert toernooi-resultaten in via Custom Admin UI of app
   → Resultaten worden gekoppeld aan Player records (email-based, niet naam-based)
   → Playpass kan gebruikt worden voor live management, maar resultaten
      worden handmatig of via import in de Custom API ingevoerd

4. ELO engine berekent nieuwe scores na elk ingevoerd resultaat
   → Player profiles worden real-time bijgewerkt
```

### App Framework: Flutter vs React Native

| Criterium | Flutter | React Native |
|-----------|---------|--------------|
| Performance | Uitstekend (eigen rendering) | Goed |
| iOS + Android pariteit | Hoog | Goed |
| Web support (toekomst) | Ja | Beperkt |
| Desktopversie (admin) | Ja (macOS, Windows) | Nee (niet stabiel) |
| Community / plugins | Groeiend | Groot/mature |
| **Aanbeveling** | **✅ Flutter** | Alternatief |

**Flutter is aanbevolen** omdat: de klant een desktopversie (macOS) overweegt voor admin-beheer, Flutter native desktop support heeft, en de cross-platform pariteit beter is.

---

## Assumptions Exposed & Resolved

| Aanname | Challenge | Beslissing |
|---------|-----------|------------|
| WordPress API is voldoende als backend | Contrarian Round 4 | Nee — ELO en identity vereisen custom API |
| Playpass wordt vervangen | Contrarian Round 4 | Gedeeltelijk behouden voor live toernooibeheer, maar niet als data-bron voor identiteit |
| Ranking kan op naam worden gedaan | Simplifier Round 6 | Nee — klant vereist 100% identity match, dus email-based koppeling verplicht |
| MVP = alleen toernooien | Round 5 | Nee — MVP = toernooien + rankings + spelersprofiel + lessen/clinics/trainingen |

---

## Technical Context

**Bestaande systemen:**
- **Repo:** Static HTML/CSS/JS website met 8 app-scherm mockups (design is klaar)
- **WordPress + WooCommerce:** Extern gehost. Beheert toernooien als producten, lessen, clinics. REST API beschikbaar (`/wp-json/wp/v2/`, `/wp-json/wc/v3/`)
- **Playpass.com:** Extern toernooiplatform. API beschikbaar op https://playpass.com/support/ai-agents-api/developers-api. Identificeert spelers op voornaam (geen email). Beheert live toernooi-brackets en uitslagen.
- **App Design Mockups:** `app/screens/` bevat: home, toernooien, toernooi-detail, inschrijvingen, resultaten, profiel, partners, splash

**Technologie aanbevelingen voor Custom API:**
- Runtime: Node.js (TypeScript) of Python (FastAPI)
- Database: PostgreSQL (voor ELO history, relaties)
- Auth: JWT tokens, email-verificatie via WooCommerce webhook
- Hosting: VPS of cloud (bijv. Railway, Render, of DigitalOcean)

---

## Ontologie (Key Entities)

| Entity | Type | Fields | Relationships |
|--------|------|--------|---------------|
| Player | core domain | id, email, naam, elo_score, woocommerce_id, created_at | heeft veel MatchResults, heeft veel TournamentParticipations |
| Tournament | core domain | id, naam, datum, locatie, type, wp_post_id, status | heeft veel TournamentParticipations, heeft veel Matches |
| Match | core domain | id, tournament_id, ronde, speler1_id, speler2_id, score, winnaar_id | behoort tot Tournament, koppelt twee Players |
| TournamentParticipation | supporting | id, player_id, tournament_id, eindpositie, punten_delta | koppelt Player aan Tournament |
| EloHistory | supporting | id, player_id, elo_voor, elo_na, match_id, timestamp | behoort tot Player en Match |
| Ranking | supporting | player_id, positie, elo_score, periode | afgeleide view van Player ELO |
| WordPressTournament | external system | wp_post_id, titel, datum, inschrijf_url, prijs | gelezen via WordPress REST API |
| WordPressLesson | external system | wp_post_id, type (les/training/clinic), datum, url | gelezen via WordPress REST API |
| AppUser | supporting | player_id, device_token, last_login | behoort tot Player |
| PlaypassEvent | external system | playpass_id, naam, datum | optioneel: bron voor match-import |
| WooCommerceOrder | external system | order_id, customer_email, product_id | trigger voor Player-registratie via webhook |

---

## Ontologie Convergentie

| Ronde | Entiteiten | Nieuw | Gewijzigd | Stabiel | Stabiliteit |
|-------|-----------|-------|-----------|---------|-------------|
| 1 | 5 | 5 | - | - | N/A |
| 2 | 7 | 2 | 0 | 5 | 71% |
| 3 | 9 | 2 | 0 | 7 | 78% |
| 4 | 10 | 1 | 0 | 9 | 90% |
| 5 | 11 | 1 | 0 | 10 | 91% |
| 6 | 11 | 0 | 0 | 11 | 100% |
| 7 | 11 | 0 | 0 | 11 | 100% |

---

## Interview Transcript

<details>
<summary>Volledig Q&A (7 rondes)</summary>

### Ronde 1
**Q:** Wat is de langetermijnvisie voor de verhouding website vs app?
**A:** Website blijft primair voor verkoop van toernooien. App toont lijst toernooien en navigeert bij inschrijving naar website. Ook lessen/clinics/training via app → website.
**Ambiguity:** 74.5% (Goal: 0.50, Constraints: 0.10, Criteria: 0.10, Context: 0.20)

### Ronde 2
**Q:** Bestaat het ranking-systeem voor spelers al ergens?
**A:** Volledig nieuw — er is geen bestaand rankingsysteem.
**Ambiguity:** 68.5% (Goal: 0.65, Constraints: 0.10, Criteria: 0.10, Context: 0.25)

### Ronde 3
**Q:** Hoe worden toernooi-resultaten ingevoerd? Wie doet dat?
**A:** Klant gebruikt Playpass.com — handmatig invoeren van inschrijvingen vanuit WordPress. Tijdens toernooi worden standen ingevoerd. Playpass heeft een API beschikbaar. Vraag: integreren of eigen systeem bouwen?
**Ambiguity:** 56% (Goal: 0.70, Constraints: 0.40, Criteria: 0.10, Context: 0.45)

### Ronde 4 (Contrarian Mode)
**Q:** Wat als je Playpass NIET vervangt maar als backend gebruikt?
**A:** Probleem: Playpass identificeert spelers alleen op voornaam, maar app-gebruikers zijn geverifieerd via email (WooCommerce aankoop). Directe koppeling is niet mogelijk.
**Ambiguity:** 47% (Goal: 0.75, Constraints: 0.60, Criteria: 0.10, Context: 0.60)

### Ronde 5
**Q:** Wat is het absolute minimum voor de eerste versie (MVP)?
**A:** Alle drie: toernooien + inschrijven, ranking-overzicht, volledig spelersprofiel + lessen/trainingen/clinics.
**Ambiguity:** 30% (Goal: 0.82, Constraints: 0.60, Criteria: 0.65, Context: 0.65)

### Ronde 6 (Simplifier Mode)
**Q:** Is zelf-service identity-matching goed genoeg of moet de koppeling 100% zeker zijn?
**A:** 100% zeker vereist bij inschrijving.
**Ambiguity:** 23.5% (Goal: 0.85, Constraints: 0.75, Criteria: 0.70, Context: 0.70)

### Ronde 7
**Q:** Hoe wordt de ranking van een speler bepaald?
**A:** ELO / dynamisch systeem.
**Ambiguity:** 16.8% ✅ (Goal: 0.90, Constraints: 0.80, Criteria: 0.82, Context: 0.75)

</details>
