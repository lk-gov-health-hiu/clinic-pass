# Clinic Pass (Smart Citizen, Build Day 2)

GovTech Sandbox HandsOn Build Day 2 (2026-10-14), Health Informatics Unit, Ministry of Health. Public repo: https://github.com/lk-gov-health-hiu/clinic-pass (MIT).

## Start here

1. Read `master-plan.md` (state, real vs simulated, backlog, gotchas, decisions). Update it as you work.
2. Read `app/README.md` for setup, config, tests and layout.
3. Run `cd app && npm start`, then `npm test` and `npm run test:ui` before and after any change.

## Rules

- **Never commit secrets**: `app/config.json`, `app/sludi-private-key.pem`, any key or token. They are git-ignored; keep it that way. Do not print keys in chat or docs.
- Data is synthetic. Label every simulated piece as simulated in the UI and in `master-plan.md`.
- Do not type credentials on external login pages (SLUDI): ask the user to enter the UIN and OTP, or use the simulated login for tests.
- Restarting the server clears login sessions. Tell the user before restarting while they are mid-test.
- Sandbox calls need `disClientId` / `disApiKey` in `app/config.json` and the calling IP whitelisted in the developer portal. Smoke-test a real call with curl before building on it.
- Prefer the DIS MCP server (`mcp__dis__*`) for the API catalogue, application info, Playground data and SLUDI client management. Quirks are listed in `master-plan.md` section 4.
- Keep the code simple: plain HTML/JS front-ends, one `server.js`. No build step.

## Commands

```
cd app
npm install
npm start          # http://localhost:3000/patient/  /hospital/
npm test           # API journey (needs the server running)
npm run test:ui    # browser journey, screenshots in ../tmp/
```

## Conventions

- Document decisions and findings in `master-plan.md` (decisions log, gotchas, open questions).
- Reference digests of the portal docs: `docs/reference-devportal-docs.md`, `docs/reference-sludi-ndx.md`.
- Day 1 repo (older clients and mocks, not public): `../API Sandbox/Team Name - Samrt Citizen/`.
