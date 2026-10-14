# Clinic Pass: demo guide (about 5 minutes)

Team Smart Citizen · Medical Clinic Registration · 14 Oct 2026

## Before you go on stage (10 minutes earlier)

1. Laptop on the venue network. In the developer portal, check My Applications > Smart Citizen Clinic Pass > IP whitelist includes the venue's public IP (see https://api.ipify.org). If calls fail with `DIS-GE-4032`, this is the cause.
2. `cd app` then `npm start`. The console must show `Claude triage: ON`. For the demo, set `"model": "claude-sonnet-5-5"` in `app/config.json` first (Haiku is for rehearsals).
3. Reset data: `curl -X POST localhost:3000/api/reset` (or restart the server).
4. Two browser windows side by side: **Patient** `http://localhost:3000/patient/` (narrow, like a phone) and **Hospital** `http://localhost:3000/hospital/` (wide). Pick the hospital the patient will book in the Hospital window's selector (the nearest one that offers the specialty: Ragama for eyes, Colombo North for heart).
5. Open the SLUDI test login once beforehand so you know the test citizen works (see "Login" below). Keep the "Use simulated login" button as the fallback.
6. Have `tmp/` screenshots ready as a backup if the network fails.

## The story (say this first, 20 seconds)

"Mr Perera is 74, takes medicine for diabetes and blood pressure every day, and has a new problem. He does not know which clinic to go to, who to ask, or how to prove he is a pensioner. Clinic Pass fixes that, end to end, using the national building blocks: SLUDI, NDX, verifiable credentials, Digi-Sign and GovPay."

## Run of show

| # | Where | Action | What to say | DPI shown |
|---|---|---|---|---|
| 1 | Patient | Click **Login with SLUDI**, sign in as the sandbox citizen | "One national login. No new account, no form." | SLUDI (real) |
| 2 | Patient | Enter PHN, Continue | "His health number links the hospital's record, only when he consents." | PHN |
| 3 | Patient | Type: *"My vision has been blurry for two weeks and I get morning headaches"*, click **Find the right clinic** | "He describes the problem in his own words. The AI assistant picks the clinic, knows his diabetes and blood pressure, and warns if it is an emergency. It guides, it does not diagnose." | Claude triage |
| 4 | Patient | Tap the nearest hospital, leave the consent box ticked | "Nearest hospital with an eye clinic. He consents to share his record for this visit only." | consent |
| 5 | Patient | Point at **Priority: pensioner verified via NDX** | "Pensioner priority is verified through NDX, so no certificate to carry." (Say honestly: NDX check is simulated today, hosts not reachable from our network.) | NDX |
| 6 | Patient | Click **Book ambulance** | "Optional ambulance, paid through GovPay." Open the payment link if time allows. | Payments (real API) |
| 7 | Patient | Click **Show at registration counter** | "His appointment is a verifiable credential in his wallet." | VC |
| 8 | Hospital > Counter | Click **Load from patient phone**, then **Register and send to clinician** | "The nurse verifies the credential. Signature checked, nothing re-typed." Optionally edit one character of the pass first to show it is rejected. | VC verify |
| 9 | Hospital > Clinician | Open the patient | "The clinician sees his past record, only because he consented, plus a summary of his own description." | consent, PHN |
| 10 | Hospital > Clinician | Diagnosis, one medicine, click **Update record, sign and issue prescription** | "Record updated. The prescription is signed with Digi-Sign and sent to his wallet. Prescriptions are free in Sri Lanka, so there is no payment step." | Digi-Sign (simulated), VC |
| 11 | Patient | Click **Check for prescriptions**, **Show at pharmacy** | "He can use any pharmacy." | VC |
| 12 | Hospital > Pharmacy | **Load from patient phone**, **Mark dispensed**, then load again | "Verified, dispensed once. A second attempt is refused." | VC verify |

Closing line: **"Describe once. Consent once. Walk in ready."**

## What is real and what is simulated (say it before they ask)

| Real sandbox calls | Simulated (labelled in the app) |
|---|---|
| Login with SLUDI (eSignet, authorization code + PKCE + private_key_jwt) | NDX pensioner check (hosts not reachable from our network) |
| GovPay / IPG payment (Payment Platform API) | Verifiable credentials: signed JSON with QR, because issuance needs manual activation by sandbox ops |
| Claude triage (Anthropic API) | Digi-Sign signature (no API published; portal flow only) |
| | Hospital directory, health record by PHN, ambulance booking |

All data is synthetic.

## Login with SLUDI (sandbox citizen)

The seeded sandbox citizens are in the Citizen Collection of the application. The first one is Kamal A. Perera, individual ID `9876543210` (PIN/OTP: see the citizen's SLUDI extension in the portal Collections). The login page offers OTP or biometrics; if neither accepts the PIN, ask the organisers for the OTP method, or use **Use simulated login**.

## If something fails

| Symptom | Fix |
|---|---|
| Triage says "AI unavailable" | Network or key problem. The keyword fallback still picks a clinic; carry on |
| Payment shows "simulated; API call failed" | IP not whitelisted (`DIS-GE-4032`) or no network; it still completes |
| SLUDI login errors | Click **Use simulated login** |
| A pass is "Not valid" | Booked in a different hospital than the one selected in the Hospital window |
| Everything is stuck | `POST /api/reset`, refresh both windows |

## Likely questions

- *Why is the clinic list simulated?* The portal's Medical Clinic Integration API is a conceptual spec; we kept our own hospital system and label it.
- *Is health data safe?* Record is released only with the patient's consent, tied to the appointment, and the demo uses synthetic data only.
- *Why not a real wallet?* Credential issuance needs sandbox ops activation; the design swaps in the Inji wallet without changing the flow.
