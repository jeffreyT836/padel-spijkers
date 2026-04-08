# Open Questions

## padel-spijkers-v1 - 2026-04-03

- [x] **Backend framework preference: Node.js/TypeScript or Python/FastAPI?** — **Beslissing: Node.js + TypeScript + Prisma** (ADR in plan)
- [x] **Flutter state management: Riverpod or Bloc?** — **Beslissing: Riverpod** (ADR in plan)
- [x] **Playpass API integration scope for v1** — **Beslissing: geen directe integratie v1**, manual match entry via admin. Playpass blijft voor live toernooi-management.
- [x] **Admin panel scope for v1: desktop app or API-only?** — **Beslissing: API-only + Postman voor v1** (snelheid boven comfort)
- [x] **WordPress site URL and API credentials** — **Opgelost: WordPress Application Password vereist**. Credentials als env vars: `WP_API_URL`, `WP_API_USER`, `WP_API_PASSWORD`
- [x] **WooCommerce webhook setup** — **Opgelost: Jeffrey configureert zelf** via WooCommerce → Instellingen → Geavanceerd → Webhooks (WP admin-toegang bevestigd)
- [x] **ELO K-factor value** — **Beslissing: gemengd systeem** — K=40 voor spelers met <30 matches, K=20 voor ≥30 matches. `matches_played` teller op Player entity.
- [x] **Hosting budget** — **Opgelost: eigen server met Docker**. Geen Railway nodig. Dockerfile + docker-compose.yml + Nginx + CI/CD via GitHub Actions → SSH deploy.
