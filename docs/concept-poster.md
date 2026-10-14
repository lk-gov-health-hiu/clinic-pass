# GovTech Concept Poster — DRAFT v3 (A2, Technical Workshop 2.0, 14 Oct 2026)

**Concept name:** Clinic Pass
**Team / agency:** Smart Citizen
**Participant names:** _(fill in)_
**Table no:** _(fill in)_

---

## 01 USE CASE (one sentence, no jargon)

An older pensioner with a new health problem describes it to an AI assistant, is guided to the right specialty and the nearest hospital, gets a priority appointment as a digital pass, and leaves the clinic with a signed digital prescription that any pharmacy can fill.

## 02 WHO IT'S FOR

- **Patient**: an older pensioner with chronic conditions on regular medication, who has a new health issue and does not know which specialty to see.
- **Clinic registration nurse**, who verifies the appointment and sends the patient to the clinician.
- **Clinician**, who reviews the patient's past health record (with consent) and issues the prescription.
- **Pharmacist**, who verifies and dispenses the prescription.

## 03 PROBLEM

- The patient does not know which specialty fits the new problem, so they pick wrongly or queue and get redirected.
- Finding the nearest hospital that offers the service, and getting an appointment, takes many calls or visits.
- Pensioners are entitled to priority, but staff cannot easily verify it.
- Patients repeat personal details and carry old reports; clinicians lack the history.
- Paper prescriptions are lost or hard to verify, and reaching the hospital (ambulance) is a separate problem.

## 04 API / DPI's USED (all documented on the Sandbox Developer Portal)

| DPI / API | Used for |
|---|---|
| **SLUDI** (Login with SLUDI, eKYC) | Sign in; fetch demographic data |
| **National Data Exchange (NDX)** | Verify pensioner status (priority appointment); consented retrieval of the patient's data |
| **Verifiable Credentials** (issuer, VC engine, wallet) | Issue the Appointment pass and the Prescription to the patient's wallet; nurse and pharmacist verify by scan |
| **Digi-Sign** (digital signature) | Clinician signs the prescription (and the patient signs the consent form) |
| **GovPay / Digital Payment** (IPG simulator) | Optional ambulance booking only. Consultation and prescription need no payment in Sri Lanka |

Our own simulated systems (labelled as such, no government API claimed): the **AI triage chatbot** (symptoms to specialty), **hospital and clinic directory** with appointment slots, **ambulance booking**, and the **health record** keyed by Personal Health Number (PHN).

## 05 HOW IT WORKS (draw the journey, stick figures welcome)

1. **Sign in** with SLUDI; eKYC fetches the patient's demographic data. The patient enters their **PHN** so health data can be retrieved during the visit.
2. **Describe the problem** to the AI chatbot, which resolves it to the most suitable **specialty**.
3. **Find the nearest hospital** offering that specialty and attempt to book.
4. **Priority for pensioners**: the platform verifies pensioner status through NDX and gives a priority slot.
5. **Appointment issued as a Verifiable Credential** into the patient's wallet.
6. *(Value-added)* **Book an ambulance** to the hospital and pay through GovPay.
7. **At the hospital**, the patient shows the VC at the registration counter; the nurse verifies it and sends the patient to the clinician.
8. **Clinician reviews the past health record, with the patient's consent.**
9. **After the visit**, the health record is updated, and the **prescription is issued as a VC, signed with Digi-Sign**. The patient presents it at any pharmacy. No payment step.

Key message on the poster: **Describe once. Consent once. Walk in ready.**

## 06 MINIMUM VIABLE PROTOTYPE (what you could demo in two hours)

A working web app with three screens:
1. **Patient:** SLUDI sign-in, PHN entry, chatbot to specialty, nearest hospital, priority booking (NDX check), Appointment VC.
2. **Clinic:** nurse scans the Appointment VC; clinician sees the consented health record and issues the signed prescription VC.
3. **Pharmacy:** scan and verify the Prescription VC, mark dispensed.

**Status:** the app is built and running; claude-powered triage and the full patient-to-pharmacy journey work today. Real sandbox calls: SLUDI, NDX pensioner check (being connected); GovPay ambulance payment is coded against the real Payment Platform API. If time allows: Digi-Sign signature, GovPay ambulance payment. The chatbot, hospital directory, health record and ambulance booking are simulated and labelled. Credential issuance needs manual activation by sandbox ops; if it is not ready, the passes are signed mock JSON with QR, clearly labelled.

---
_Technical Workshop 2.0 · Digital Integration Sandbox · 14 October 2026 · A2_
