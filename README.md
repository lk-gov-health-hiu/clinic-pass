# Smart Citizen — Build Day 2

New app for GovTech Sandbox HandsOn Build Day 2 (2026-10-14).

Day 1 work lives in the repo root and `../API Sandbox/Team Name - Samrt Citizen/app/` (bereavement hold, birth registration).

## Layout

- `docs/` — use case, spec, notes for today's app
- `app/` — the app code (one folder per app/service)

## Status

- [ ] Pick use case
- [ ] Spec in `docs/spec.md`

See [`master-plan.md`](master-plan.md) for the full plan.
- [ ] Scaffold app in `app/`

## Reusable from Day 1

- `../API Sandbox/Team Name - Samrt Citizen/app/birth-registration-app/paymentsClient.js` — sandbox Payments API client
- `../API Sandbox/Team Name - Samrt Citizen/app/birth-registration-app/nicClient.js` — real NIC lookup
- `.env` pattern: `DIS_CLIENT_ID`, `DIS_API_KEY`, gateway base URLs (see `../API Sandbox/Team Name - Samrt Citizen/app/birth-registration-app/.env.example`)
