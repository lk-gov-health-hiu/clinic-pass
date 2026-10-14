# Proposal: "Clinic Pass" — register once, walk in ready

Use case (see `docs/brief.md`): Medical Clinic Registration. Patient, e.g. a pensioner at a special clinic, should not re-enter details, carry old records, or guess specialist availability.

Sources: Day 1 API catalog (71 APIs, `../API Sandbox/API Catalog - Sandbox HandsOn Build Day.pdf`), the webinars, and the consultant's Day 2 list (SLUDI, G2P benefit engine, NDX with civil/business/land/vehicle registries, verifiable credentials, digital signature, digital payment). **Catalog is Day 1's; the portal on the day is the source of truth.** Status column below is from the catalog wording only; confirm live vs conceptual in the portal.

## 1. One-line pitch

A pensioner books a specialist clinic on their phone, signs in once with SLUDI, consents to share records through NDX, gets a verified clinic credential in their wallet, and at the counter the nurse scans it: registered in seconds, nothing carried, nothing retyped.

## 2. Patient journey (the 3-minute demo)

| # | Step | What the user sees | DPI / API used | Catalog status |
|---|---|---|---|---|
| 1 | Sign in | "Sign in with SLUDI", OTP, redirected back | **SLUDI** authorize / token / userinfo (SLUDI ID, NIC, name, DOB) | DPI, expected live |
| 2 | Profile pre-filled | Name, DOB, NIC, address auto-filled; patient only confirms | SLUDI eKYC; **Health eKYC Client Registration** `getCitizenEkycDetails`; NDX civil registry (address) with consent | eKYC DPI live; Health one "conceptual" in Day 1 |
| 3 | Pensioner recognised | Badge "Pensioner: priority queue, fee waived" | **Pensioner Eligibility Services** (is confirmed pensioner, EPF/ETF); optionally Pensioner Status Verification | Social Protection; check live |
| 4 | Find clinic and specialist | Special clinic list, which specialist is on duty and when | **Specialist Duty Log** `getSpecialistAvailability`, Emergency Facility Routing `searchFacilities` | Health, has conceptual twin |
| 5 | Book | Pick slot, get reference and status | **eHealth OPD** `bookOpdAppointment`, `getAppointmentStatus` | Health, has conceptual twin |
| 6 | Bring records without carrying them | Consent screen: "Clinic X asks for your previous clinic summary for treatment" -> Allow | **NDX** consented query to a provider (hospital/lab registry, synthetic) | NDX, exact registries TBD |
| 7 | Sign registration and consent form | Redirect to signing, signed PDF returned | **Digital Signature** (portal redirect flow, 2 endpoints) | DPI |
| 8 | Fee (if not exempt) | Pay registration or pharmacy fee, or "waived" for pensioners | **Payments** `POST /api/sandbox/initiate` (proven on Day 1) | Live (Day 1) |
| 9 | Clinic Pass issued | "Clinic Pass" card appears in the wallet | **Verifiable Credentials**: issuer app -> VC engine -> citizen wallet | Per consultant |
| 10 | At the counter | Nurse scans QR; verified name, clinic, appointment, pensioner flag, consent summary; one click to confirm arrival | **VC verify** (+ SLUDI re-auth if needed) | Per consultant |
| 11 | Reminders | SMS/OTP to a number verified as the patient's | Telco **Verify MSISDN and NIC Linkage**, **Preferred OTP Channel** | Ideabiz, check live |

Nice-to-have: after the visit, **Pharmacy** `searchMedicineAvailability` ("is your medicine in stock at the hospital pharmacy"); **G2P benefit engine** for a pensioner medical or transport allowance (unknown, ask on the day).

## 3. Who uses what (shows the full trust lifecycle)

- **Patient app** (mobile web): journey above, holds the wallet.
- **Clinic counter app** (nurse): scan/verify credential, see pre-filled record, mark arrived, issue the credential (issuer role).
- **Hospital back-end** (mock): specialist duty roster, appointment store, plays NDX provider for the clinic summary if no real provider exists.

## 4. APIs deliberately NOT used

Land, vehicle and business registries, Education, Agriculture, Government Operational Services: no honest role in clinic registration. Using them to "tick boxes" would weaken the story. If asked: the NDX query pattern is the same, so the design extends. (Vehicle registry could stretch to "arrive by own vehicle" parking, not worth it.)

## 5. Priorities (build order)

**Must** (vertical slice): SLUDI sign-in -> pensioner flag -> specialist availability -> OPD booking -> issue and verify Clinic Pass.
**Should**: NDX consented records fetch with visible consent screen and audit trail; Payments with pensioner waiver; Digital Signature.
**Could**: Telco OTP/linkage, pharmacy, G2P, Sinhala/Tamil labels, accessibility (large text for older users).

## 6. Real vs simulated plan

Rule from Day 1: smoke-test each API with curl first; anything conceptual or failing is simulated behind a client with the same response shape and a visible "Simulated" badge. Keep one `*Client.js` per API with a `useMock` switch so a pivot is cheap.

## 7. Why it should score

- Shows the whole DPI stack in one human story: identity, data exchange with consent, signature, payment, credential, verification.
- Strong user: older patient, low-tech counter, real hospital pain (queues, repeated forms).
- Trust visible in UI: consent screen, only-permitted-fields, audit trail, credential verify.

## 8. Risks

- Staging gateway unreachable from this laptop on 14 Oct; test on venue network first.
- Many health APIs conceptual; VC and G2P specs unseen. Mitigate with mocks and early portal check.
- Sandbox seed data is limited (Day 1: only 3 NICs in DRP). Find which synthetic patients/pensioners exist before designing the demo around them.
- SLUDI OIDC was too heavy on Day 1: timebox to 45 min, else mock the redirect and keep real userinfo if possible.

## 9. Time plan (from agenda)

- Sprint 1 (09:45-10:30): portal tour, create app, credentials, subscribe APIs, curl smoke tests, download OpenAPI to `app/openAPI/`, decide real vs mock table.
- Sprint 2 (10:50-13:00): Must slice end to end, then NDX consent.
- Sprint 3 (14:15-15:15): Payments, signature, polish, `demo-guide.md`, screenshots, rehearse x2.
- 15:30 demo.

## 10. Decisions needed from the team

1. Confirm the persona and name ("Clinic Pass").
2. Who owns: patient app, counter app/VC, API clients, demo script.
3. Real vs mock after the Sprint 1 smoke tests.

## 11. Update after reading the Developer Portal docs (see `docs/reference-devportal-docs.md`)

- **G2P is real and fits:** use the G2P Subsidy facade for a pensioner clinic benefit (scheme with `minAge`, e.g. medical/transport allowance: eligibility check by SLUDI UIN, disbursement, quota). Promote from stretch to **Should**; request early access now.
- **NDX documents only `person` and `farmer` queries**, with a real consent portal (`CE_NOT_APPROVED` -> consent URL -> retry). Use `person` for identity/contact data with the real consent screen; the "previous clinic summary" is a simulated provider (say so).
- **Verifiable credentials need ops activation** (Certify/Mimoto/Inji): request immediately; keep a mock signed-JSON + QR credential as fallback.
- **Digital signature is a portal redirect** (Digi-Sign + MySLUDI login), not an API: Could; demo as a redirect or simulate.
- **Payments** via IPG Simulator; pensioners are fee-waived, so payment shows on the non-pensioner or pharmacy path.
- **Use the MCP server** to create synthetic patients (USER collection records with UINs) and seed data, and to pull OpenAPI specs.
- Health APIs (OPD booking, specialist duty log) are known only from the Day 1 catalog; check via MCP `search_apis`.
