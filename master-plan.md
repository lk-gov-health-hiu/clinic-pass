# Clinic Pass: Master Plan and Handoff

Living document. **Read this first in every new session**, then `app/README.md`. Update the status, backlog and decisions log as you work.

Event: GovTech Technical Workshop 2.0 / Sandbox HandsOn Build Day 2, 14 Oct 2026, Mandarina Colombo. Team Smart Citizen (Health Informatics Unit, Ministry of Health). Topic: **Medical Clinic Registration** (`docs/brief.md`). Concept: **Clinic Pass** (`docs/concept-poster.md`).
Repository: https://github.com/lk-gov-health-hiu/clinic-pass (MIT).

## 1. What exists today

**One Node/Express server, two front-ends** in `app/`:

- **Patient app** `/patient/` (phone-sized): Login with SLUDI, PHN, describe the problem to an AI assistant, nearest hospital, choose an appointment (next 5 priority + next 5 normal slots), priority verification (pensioner / armed forces / health worker), appointment as a verifiable-credential-style pass, optional ambulance with payment, prescription wallet.
- **Hospital app** `/hospital/` (desktop): Registration counter (verify the pass, register), Clinician (consented record, AI triage summary, visit, signed prescription), Pharmacy (verify, dispense once).
- Hand-off between the two apps in the demo: patient taps **Show at registration counter / Show at pharmacy**, staff tap **Load from patient phone** (no camera needed). QR codes are displayed but not scanned.

### Real versus simulated (say this out loud in the demo)

| Piece | State | Where |
|---|---|---|
| Login with SLUDI (eSignet, auth code + PKCE S256 + private_key_jwt) | **Real**, tested with sandbox citizen | `app/server.js` section "Real Login with SLUDI" |
| Pensioner priority | **Real**: Pensioner Status Verification API (identity check on SLUDI name/NIC/address, then residency lookup by SLUDI id). No age check, no override | `pensionerRegistryCheck()` |
| Ambulance payment | **Real**: Payment Platform API (IPG sandbox); falls back to a labelled simulation if the call fails | `govPayCharge()` |
| AI triage (symptoms to specialty, urgency, summary) | **Real**: Anthropic Messages API with tool use; keyword fallback if no key or call fails | `claudeTriage()` / `keywordTriage()` |
| Ambulance fare estimate | **Simulated** tariff: LKR 1,500 base + LKR 100/km (straight-line km x 1.3, min LKR 2,000) between simulated towns; server recomputes it and sends it to the real payment call | `ambulanceQuote()`, `towns` in `app/data/seed.js` |
| Armed forces / health worker priority | Simulated NDX registry check (`demoPriorityAll`) | `/api/priority/verify` |
| Appointment and prescription credentials | **Simulated**: HMAC-signed JSON + QR (real VC issuance needs manual activation by sandbox ops) | `issueCredential()` |
| Digi-Sign signature on prescription | Simulated (no API published; portal flow only) | `digiSign()` |
| Hospital directory, slots, health record (by PHN), ambulance booking | Simulated "hospital system", labelled in the UI | `app/data/seed.js` |
| NDX data exchange | Not used yet (hosts did not resolve from our network) | none |

All data is synthetic.

## 2. Setup, run, test

See `app/README.md` for the full steps. Short version:

```
cd app
npm install
copy config.example.json config.json     # then fill in keys (git-ignored)
npm start                                 # http://localhost:3000/patient/  and  /hospital/
npm test                                  # API journey, needs the server running
npm run test:ui                           # browser journey (Playwright + installed Chrome)
```

Secrets (never commit): `app/config.json` (Anthropic key, DIS client id and API key, SLUDI OIDC client id) and `app/sludi-private-key.pem`. Both are git-ignored. If the PEM is lost it cannot be recovered: create a new OIDC client with the DIS MCP `create_sludi_oidc_client` (or `update_sludi_oidc_client` to add redirect URIs).

### Sandbox application (portal)

- Developer portal: https://developer.staging.devportal.gov.lk . Application "Smart Citizen Clinic Pass" subscribes to: SLUDI, National Data Exchange, Verifiable Credentials, Digital Signature, Medical Clinic Integration APIs, Payment Platform API, Payment Gateway, Pensioner Status Verification.
- The API key was shown once at registration. If lost: portal, My Applications, Rotate API Key, then update `config.json`.
- **IP whitelist** holds the public IP of the machine used so far. At a new venue or network, add the new public IP (portal, My Applications, Edit, Configuration) or gateway calls fail with `DIS-GE-4032`.
- SLUDI OIDC redirect URIs registered: `http://localhost:3000/patient/callback` plus the laptop LAN address when sharing. The app builds the redirect from the request host, so every new host must be added with the DIS MCP `update_sludi_oidc_client` (`addRedirectUris`).
- Data the pensioner check relies on (portal, Playground, Pensioner Status Verification, **Data Editor** tab; tables `persons`, `identity_aliases`): rows for the sandbox citizen Kamal A. Perera (`person-005`) and the simulated patient K. A. Perera (`person-006`). **The name, NIC and address must match exactly what SLUDI sends** (address is `street_address, locality`, upper-cased, for example `10, MAIN STREET, LANE 1, COLOMBO`). The server logs the SLUDI claims it receives (`SLUDI claims received:`) to help with this.
- The SLUDI sandbox citizens are in the application's **Citizen Collection** (DIS MCP `list_collection_records`). We set Kamal A. Perera's date of birth to 1952-03-14 so he shows as 74.

## 3. Backlog: next improvements (suggested order)

1. **NDX**: replace the simulated armed-forces / health-worker checks with real NDX queries once the hosts resolve (token `POST https://ndx-thunderid.stg.dis.govtech.lk/oauth2/token`, data `https://ndx-consumer-app.stg.dis.govtech.lk/api/query/person`, consent portal flow). Needs a Consumer Console client id and secret. Details in `docs/reference-devportal-docs.md` section 4.
2. **Medical Clinic Integration APIs**: read its endpoints (DIS MCP `get_api_endpoints`, `get_api_documentation`); it may replace our simulated clinic directory, queue and health record.
3. **Real verifiable credentials**: ask sandbox ops to activate templates (My SLUDI, Verifiable Credentials), then issue via Mimoto/Inji instead of `issueCredential()`; add a real wallet scan (camera) instead of "Load from patient phone".
4. **Digi-Sign**: no API is published; either redirect to the Digi-Sign portal flow (PDF digest signing with MySLUDI) or keep the labelled simulation.
5. **Persistence and multi-user**: SLUDI sessions and live patients are kept in memory (a server restart logs everyone out); appointments are shared by all testers. Add per-session separation and persist sessions.
6. **Docs to refresh**: `docs/demo-guide.md` and the team sheet (`docs/test-sheet.docx`, not in the repo) still describe the old booking step; update them for the slot picker and registry-based pensioner check.
7. **Quality**: unit tests for slot generation and credential signing, input validation, rate-limit the triage endpoint (it spends an API key), accessibility pass, Sinhala/Tamil labels.
8. **Medical safety**: the triage assistant gives guidance only; add a clinician-review note and keep the emergency warning. Never send real patient data to an external API.

## 4. Gotchas learned (save yourself time)

- **Restarting the server clears login sessions.** Anyone signed in must sign in again. After editing `server.js`, restart: `taskkill //F //IM node.exe` (Git Bash on Windows) then `npm start`.
- **Anthropic API**: forced `tool_choice` is rejected by the current models; the code uses `auto` and the system prompt demands the tool. Haiku sometimes leaves `reason` empty (the server fills a default). Model is set in `config.json` (`claude-haiku-5-5` for rehearsal, `claude-sonnet-5-5` for the demo).
- **DIS MCP quirks**: `create_collection_record` returns 400 without detail; `update_collection_record` works with plain values inside `base`, for example `{"base":{"DOB":"1952-03-14"}}`. `update_seed_table` replaces the whole table, so send every row. `get_seed_table_rows` needs `tableName`. API ids are needed as `apiId` and `apiVersionId` (they were equal for every API here).
- **Gateway paths** need the version: `https://api.staging.devportal.gov.lk/<api-slug>/v1.0.0/...`. A path without the version returns `DIS-GE-4042`. Day 1 client ids return `DIS-GE-4031` on Day 2.
- **Hosts**: `esignet.staging.devportal.gov.lk` and `api.staging.devportal.gov.lk` are reachable from our laptop; `gateway.stg.*`, `ndx-*.stg.dis.govtech.lk` and `*.dev.digieconcenter.gov.lk` were not (timeouts, no DNS, certificate errors). Re-test at the venue.
- **Browser automation** may not type credentials into the SLUDI login page; a person must enter the UIN and OTP. For tests, use **Offline fallback: use simulated login**.
- **LAN sharing**: the server listens on all interfaces; Windows Firewall may need an inbound rule for port 3000; the SLUDI redirect for the LAN address must be registered; testers share the same bookings.
- **Priority slots** need a verified category server-side; the UI only disables the buttons.
- Sandbox data is synthetic; keep real patient data out of the demo and out of the repo.

## 5. Decisions log

| When (14 Oct 2026) | Decision | Why |
|---|---|---|
| Afternoon, late | Ambulance price preview: pickup and hospital dropdowns re-quote the fare before booking (replaces the flat LKR 2,500); no "demo only" labels in the UI, fare note says simulated | User request, to show price changing with addresses |
| Afternoon, late | Repo published as `lk-gov-health-hiu/clinic-pass` under MIT; workshop recordings, slide images and downloaded reference PDFs excluded; secrets git-ignored; tests added (`app/test`) | Open source for reuse by the Health Informatics Unit and others |
| Afternoon, late | Pensioner priority uses **only** the Pensioner Status Verification API; SLUDI age check and demo override removed for pensioners. Registry rows added to the API's Playground tables to match SLUDI's name/address | User instruction: verify with the pensioner registry, not age |
| Afternoon | Slot picker: next 5 priority and 5 normal slots, priority needs a verified category (pensioner / armed forces / health worker) | User requirement |
| Afternoon | Real Login with SLUDI (eSignet) wired in; NIC box removed so people enter their ID only once, on the SLUDI page | Avoid double entry |
| Afternoon | Registered application "Smart Citizen Clinic Pass" (sandbox); real payment call for the ambulance; Day 1 credentials found dead on Day 2 | `DIS-GE-4031` |
| Afternoon | Built `app/` (patient + hospital apps, shared server, Claude triage with keyword fallback, signed JSON + QR credentials, "Show at counter / pharmacy" hand-off). Haiku for rehearsal, Sonnet for the demo | Two apps show both sides of the credential handoff |
| Late morning | Poster v3: elderly pensioner with a new issue; AI triage; priority for pensioners; appointment and prescription as credentials; ambulance via GovPay as the only payment (prescriptions are free); G2P and registration fee dropped | Team lead's storyline |
| Late morning | Read docs.staging.devportal.gov.lk (digest in `docs/reference-devportal-docs.md`) | Day 1 hosts time out; Day 2 uses new hosts and an MCP server |
| Morning | Concept: **Clinic Pass** | Matches the brief; chains SLUDI, NDX, VC, Digi-Sign, payment |

## 6. Schedule of the event (for reference)

Registration 08:30; sprints 09:45-10:30, 10:50-13:00, 14:15-15:30; demo session 15:30-16:30; awards 16:30. Build time about 5 hours; stop building by about 15:15.

## 7. Open questions

- Is the venue network able to reach the NDX hosts and the old gateway hosts? Which public IP must be whitelisted there?
- Will sandbox ops activate verifiable credential templates?
- Which health-sector APIs are real versus conceptual (Medical Clinic Integration APIs were published on 13 Oct as a conceptual spec)?
- Can the sandbox citizen records (name, address, date of birth, NIC) be edited from the portal, so the demo patient can match the story exactly?

## 8. Document map

| File | Purpose |
|---|---|
| `README.md` | Repository front page |
| `app/README.md` | How to run, configure, test, extend the app |
| `CLAUDE.md` | Instructions for AI coding sessions in this repo |
| `docs/concept-poster.md` / `.docx` | A2 concept poster text (v3) |
| `docs/demo-guide.md` | Five-minute demo script and fixes |
| `docs/brief.md`, `docs/proposal.md`, `docs/spec.md` | Brief, early proposal, spec drafts |
| `docs/reference-devportal-docs.md`, `docs/reference-sludi-ndx.md` | Digests of the developer portal docs and webinars |
| `docs/screenshots/` | Screenshots of the working app |
