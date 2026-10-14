# Reference: SLUDI + NDX + Sandbox (from webinars 1.0 and 2.0)

Sources (in `docs/reference/`): `SLUDI Webinar Presentation.pdf` (webinar 1.0), `Sandbox webinar 2.0 content deck.pptx` (NDX). Slides only, so this contains concepts and flows, **not endpoint URLs or payload schemas**. Get those from the Developer Portal API catalogue on the day.

## 1. Sandbox in one paragraph

Safe environment to build and test DPI integrations with **synthetic data**, no live government systems. Developer flow: register and sign in -> browse API Catalogue (docs, sample requests, SDKs) -> register the application and obtain scoped sandbox credentials -> test in your own isolated Playground. The pitch: prove the *whole citizen journey* across several APIs, not one API at a time.

## 2. The DPI building blocks

| Block | What it is | Use it for |
|---|---|---|
| **SLUDI** | National digital identity, anchored to DRP civil registry, built on MOSIP | Sign in with SLUDI, eKYC (yes/no or minimal attributes with consent) |
| **NDX** | National Data Exchange. Stores no data; routes consented, policy-checked requests to authoritative providers | Fetch verified records instead of asking for certificates |
| **GovPay** | National payment rail | Collect fees, disburse benefits |
| **AAR** | Authoritative Address Register | One current address per person, shared with subscribers |
| **VDD** | Verifiable digital documents | Issue certificates, licences, permits verifiable anywhere |
| Super App, National Single Window, bank/telco channels, ministry portals | Service layer on top | Where the citizen sees value |

Day 1 mapping: Payments, DRP, NIC were real; Birth Registration was conceptual (see master plan).

## 3. SLUDI integration (OIDC-style, three endpoints)

1. **Authorize**: redirect citizen to the SLUDI login page; they sign in (OTP or other method) and consent to share details.
2. **Token**: after authentication the app receives an access token. The app never sees a password.
3. **UserInfo**: with the token, retrieve the **SLUDI ID, mapped NIC and profile details**.

Notes: the SLUDI ID is the join key used to match records across systems (e.g. NDX listeners match by SLUDI). Request only the attributes needed (consent-based, minimal, PDPA No. 9 of 2022).

## 4. NDX integration

**Developer steps (from the portal):**
1. *Explore*: Developer Portal -> Services -> NDX; browse data registries in the **Provider Console**.
2. *Register*: in the **Consumer Console** register your app as a consumer; get **Client ID and Client Secret**.
3. *Build and test*: implement the exchange flow, test with synthetic data.

**Consumer flow (fertiliser-subsidy example the demo used):**
citizen signs in with SLUDI -> app (consumer) requests data via NDX with a declared **purpose** + SLUDI -> citizen sees a **consent screen** (what and why) -> citizen consents -> NDX gets data from the provider and returns **only permitted fields** -> app continues the application.

**Four validation checks before any data leaves a provider:** identity (requester authenticated and active), policy (a policy statement covers requester + purpose), lawful basis (which fields statute allows vs need consent), consent (where needed). Fail any one and the exchange stops with the reason recorded. Every step is audited.

**Three exchange patterns:**
- *Data queries*: ask, get an answer; can be a bounded yes/no (e.g. "over 18?" without the DOB).
- *Events*: provider publishes once (e.g. `address-changed`), NDX delivers to permitted subscribers with only permitted fields, holds and resends in order if a listener is offline, listener acknowledges. Listener admin subscribes once and registers an endpoint.
- *Batch queries*: many records, on demand or scheduled (e.g. pension reconciliation).

Example providers named: Registration of Persons (DRP), Registrar General, Sri Lanka Medical Council, Inland Revenue, Dept. of Meteorology. Example consumers: Immigration and Emigration, Election Commission.

## 5. Reference journeys (good demo templates)

- **First passport application**: SLUDI sign-in -> consent and fetch birth registry data via NDX -> pay fee via GovPay -> notification "ready to collect". Pitch line: no single system does everything; the service orchestrates several DPIs, SLUDI is the trust thread.
- **Passport renewal (NDX)**: one request `passport-renewal` + SLUDI; registries answer; officer approves in real time.
- **Fertiliser subsidy**: farmer signs in with SLUDI, consents, app fetches eligibility data via NDX.
- **Citizen vignettes** (webinar 1.0): bank account + SIM in minutes, business registration, overseas worker getting a certified document, school-age enrolment, flood relief via GovPay, pension without a bus trip, DS office verifying in seconds, bank eKYC, ministry retiring its own login DB, school admissions without certified copies.

## 6. What good looks like (messaging for judges)

- Identity is the backbone, not the destination; the value is simpler, safer services.
- Build once, use everywhere: reuse shared rails instead of rebuilding.
- Trust by design: data stays in Sri Lanka, encrypted, least-privilege, full audit trail, consent backed by law (PDPA No. 9 of 2022).
- Show consent and audit **visibly in the UI**; it is the differentiator the organisers keep stressing.
- Ask-once, share-safely: show the paperwork that disappears (before/after).

## 7. Timeline context (from deck)

First real identities by Dec 2026 (selected government servants, DRP Colombo); NDX, GovPay, AAR, VDD onboarding in parallel; nationwide enrolment target Q4 2027 (subject to readiness).

## 8. Open items to confirm on the day

- Which of SLUDI / NDX / GovPay / AAR / VDD are live in the sandbox vs conceptual.
- Exact base URLs, auth scheme and header names (Day 1 used `DIS_CLIENT_ID` / `DIS_API_KEY`; NDX uses Client ID + Client Secret from the Consumer Console, may differ).
- Which providers/registries and synthetic records are seeded in NDX Provider Console.
- Whether Day 1 credentials carry over.

## 9. API list as briefed by the consultant (Day 2 intro) and what we know

Briefed list: SLUDI identity, G2P benefit engine, National Data Exchange, verifiable credentials, digital signature, digital payment, and playground APIs. NDX sits over four registries: **civil, business, land, vehicle**.

| API | What we know | Source |
|---|---|---|
| SLUDI identity | OIDC: authorize, token, userinfo (SLUDI ID, NIC, profile). GovTech's public GitHub (`GovTech-SL`) holds MOSIP forks incl. **eSignet** (OpenID auth), so expect eSignet-style OIDC; Day 1 judged it heavy, so budget time | Webinar 1.0; github.com/GovTech-SL |
| NDX | Consumer Console gives Client ID + Secret; consent screen; purpose-bound requests; four registries above | Webinar 2.0 |
| Verifiable credentials | Per consultant: **full trust lifecycle = issuer app -> VC engine -> citizen wallet** (issue, hold, present, verify). GovTech's GitHub has `inji-web` (MOSIP Inji wallet/verify family), so the VC engine is probably Inji-based (inference, unconfirmed). Webinar name for it: VDD (verifiable digital documents) | Consultant; GitHub; webinar 1.0 |
| Digital payment | Payments API: `POST /api/sandbox/initiate`, `merchant_id` from Playground `GET /playground-action/merchants`. Public GovPay (ICTA + LankaPay, CBSL oversight, 50+ agencies, ~700 services) is the real-world counterpart | Day 1 build; govinsider |
| G2P benefit engine, digital signature | No public info found; check catalog/OpenAPI on the day | n/a |
| Playground | Isolated test area per developer; Authorize dialog shows real auth headers; Day 1 also used it to pull merchant IDs | Day 1 notes |

### Hard facts from Day 1 (still the best guide to how the gateway behaves)
- Portal: `https://stg.devportal.gov.lk/api-catalog`. Real gateway host is `https://gateway.stg.devportal.gov.lk/<api>/v1.0.0`, **not** the catalog's `sgateway` host.
- Auth: two headers, `X-DIS-API-KEY` and `X-DIS-CLIENT-ID`. API key is shown once (use Rotate + Copy).
- Application setup: whitelist an IP (guide used `192.168.2.1`), bind only the needed APIs, save OpenAPI YAMLs in `openAPI/` plus CSV seed data in `openAPI/seed-data/<api>/`.
- Catalog was 71 APIs in 12 building blocks; many marked "conceptual" (no backend). Day 1 tier was "Tier 1 - Explorer (3,000 points)".
- DRP NIC lookup needs token -> agreement -> subscription chain; seed NICs `736604450V`, `845231907V`, `901245667V`.
- Official starter: `GovTech-SL/dis-demo-nextjs-starter-template` (404 publicly, so likely private; organisers may share access). Quick Start Guide PDF in the Day 1 repo.
- Staging hosts were unreachable (timeout) from this laptop on 14 Oct 09:50; likely venue-network only.

### Public context (web search, 14 Oct 2026)
- SLUDI full rollout reported delayed pending grant/vendor; MVP built in-house on MOSIP; first IDs to a selected cohort by end 2026 (so production is not the point, the sandbox is).
- Business registry real-world: Dept. of Registrar of Companies, eROC (`eroc.drc.gov.lk`); sole proprietors/partnerships register at DS offices and have no unique number (expect gaps in synthetic business data).
- No public API docs exist for NDX, G2P engine, VC or signature APIs; the portal is the only source.
