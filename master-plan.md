# Build Day 2 — Master Plan

Living document. Update it as topic, constraints and APIs become known. Date: 2026-10-14.

## 1. Status

| Item | State |
|---|---|
| Topic / use case | **Unknown — awaiting announcement** |
| Team / members | Smart Citizen (assumed same as Day 1 — confirm) |
| Sandbox APIs available | Unknown — check the API catalog on the day |
| Credentials (`DIS_CLIENT_ID`, `DIS_API_KEY`) | Need to confirm Day 1 ones still work, or get new |
| Demo / judging format | Unknown |
| Deadline | Unknown |

## 2. Inputs to collect (fill in as they arrive)

- [ ] Topic brief / problem statement (paste verbatim into `docs/brief.md`)
- [ ] Judging criteria and demo format
- [ ] Time schedule (build window, demo time, cutoff)
- [ ] Updated API catalog (save PDF in `docs/`)
- [ ] Which APIs are live vs "conceptual" (Day 1: Birth Registration was conceptual; Payments, DRP, NIC were real)
- [ ] Known sandbox bugs or restrictions announced

## 3. Plan, once the topic is known

1. **Frame (15 min)**: restate the problem, who the user is, one-sentence value. Write to `docs/spec.md`.
2. **Map APIs (15 min)**: for each step in the flow, which sandbox API serves it; mark real vs simulated. Smoke-test every real API call with curl *before* building on it.
3. **Cut scope**: pick one end-to-end happy path that can be demoed in about 3 minutes. Everything else goes in "out of scope".
4. **Scaffold (30 min)**: Node/Express app in `app/`, same layout as Day 1 (`server.js`, `*Client.js`, `public/`, `.env.example`).
5. **Build vertical slice first**: UI -> server -> real API call -> visible result. Mocks for anything not live.
6. **Test + harden**: run the happy path repeatedly; handle sandbox errors visibly in the UI.
7. **Demo prep**: write `demo-guide.md` (script, seed data, restart steps), and record fallback screenshots.

## 4. Reuse from Day 1 (`../API Sandbox/Team Name - Samrt Citizen/`)

- `app/birth-registration-app/paymentsClient.js`: Payments API client
- `app/birth-registration-app/nicClient.js`: real NIC lookup via DRP
- `app/birth-registration-app/sludiMock.js`, `otpMock.js`: mocks for identity/OTP
- `.env.example` pattern, `demo-guide.md`, `restart-guide.md`, `team-master.md` structure
- `DIS App Development Quick Start Guide.pdf`: auth/gateway conventions

## 5. Lessons from Day 1 to apply

- Verify API behaviour with real calls early; the sandbox had a data-isolation bug between Death Registration and Death Notification that cost time (see Day 1 `build-status-and-sandbox-issue.md`).
- "Conceptual" catalog entries have no backend: simulate them, and say so in the demo.
- Pivoting is OK: Day 1 switched use case mid-day. Keep the codebase modular so a pivot is cheap.
- Keep a demo guide and restart guide current as you go, not at the end.

## 6. Decisions log

| Time | Decision | Why |
|---|---|---|
| | | |

## 7. Open questions

- What is the topic?
- Is this the same team and the same sandbox environment as Day 1?
- Do Day 1 credentials carry over?
