# Day 2 App Spec

Draft. Full proposal and API mapping: `docs/proposal.md`. Brief: `docs/brief.md`.

## Use case

Medical Clinic Registration ("Clinic Pass"): a pensioner registers for a special clinic and arrives ready, without re-entering details, carrying records, or guessing specialist availability.

## APIs used (sandbox)

Must: SLUDI, Pensioner Eligibility Services, Specialist Duty Log, eHealth OPD booking, Verifiable Credentials (issue and verify).
Should: NDX (consented clinic-summary fetch), Payments, Digital Signature.
Could: Telco MSISDN/NIC linkage and OTP channel, Pharmacy availability, G2P benefit engine.

## Flow

See proposal section 2 (11-step journey). Real vs simulated to be decided after Sprint 1 smoke tests.

## Out of scope / simulated

Land, vehicle, business registries; education, agriculture and government-operations APIs. Any API found conceptual or unreachable is mocked with a visible "Simulated" badge.
