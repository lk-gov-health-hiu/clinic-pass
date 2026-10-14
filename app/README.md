# Clinic Pass app

Two front-ends on one Node/Express server.

| URL | App |
|---|---|
| `/patient/` | Patient (phone-sized): SLUDI login, PHN, AI triage, hospital, appointment slots, priority verification, pass, ambulance (fare preview by pickup town and hospital), prescriptions |
| `/hospital/` | Hospital: Registration counter, Clinician, Pharmacy (hospital selector top right) |

## Setup

Requires Node 18+ (tested on Node 22) and, for the browser test, Google Chrome.

```
npm install
copy config.example.json config.json
```

Edit `config.json` (git-ignored, never commit):

| Key | Meaning |
|---|---|
| `anthropicApiKey` | Anthropic API key for AI triage. Empty means keyword fallback |
| `model` | `claude-haiku-5-5` for rehearsals, `claude-sonnet-5-5` for the demo |
| `port` | default 3000 |
| `disClientId`, `disApiKey` | Application credentials from the developer portal (My Applications). Used for the Payment and Pensioner Status Verification calls |
| `sludiClientId` | OIDC client id from the DIS MCP `create_sludi_oidc_client` |
| `paymentsMerchantId` | default `merch_5f8a9d2c` (sandbox merchant) |
| `demoPriorityAll` | `true` (default): armed-forces / health-worker verification passes with a "simulated" label. Pensioner is never overridden |
| `credentialSecret` | HMAC secret for the simulated credentials |

Also required for the real SLUDI login: `sludi-private-key.pem` in this folder (returned once when the OIDC client is created; git-ignored). Without it the login button reports an error; use **Offline fallback: use simulated login**.

## Run and test

```
npm start            # server on http://localhost:3000
npm test             # API journey (server must be running); prints PASS/FAIL per step
npm run test:ui      # Playwright browser journey with screenshots in ../tmp/
```

`npm test` covers: PHN check, triage, slots, priority refusal before verification, pensioner registry check, booking and double booking, tampered pass, consent-gated record, ambulance fare by distance and server-side charge, ambulance payment, signed prescription, one-time dispensing.

## Layout

```
server.js        all API routes, credential signing, DPI adapters, SLUDI flow, triage
data/seed.js     simulated hospital directory, specialties, patient, health record
data/runtime.json   bookings and prescriptions (git-ignored, created on first save)
public/          static front-ends (plain HTML + JS, no build step)
  patient/index.html   hospital/index.html   shared.css
test/            api-flow.js, ui-flow.js
```

### Where to change things

- Real DPI calls are in `server.js` sections **DPI adapters**, **Real Login with SLUDI**, **Appointment slots and priority verification**. Each simulated adapter is labelled `(simulated)` in its provider string and in the UI.
- Slot rules: `PRIORITY_TIMES`, `NORMAL_TIMES`, `nextSlots()`.
- Add a hospital or specialty: `data/seed.js`.
- Triage prompt and tool schema: `claudeTriage()`.

## API routes (summary)

`GET /api/status`, `POST /api/sludi/login` (simulated), `GET /api/sludi/start` and `GET /patient/callback` (real), `POST /api/phn`, `POST /api/triage`, `GET /api/slots`, `POST /api/priority/verify`, `POST /api/appointments`, `POST /api/ambulance`, `POST /api/share`, `GET /api/shared/...`, `GET /api/hospital/:hid/appointments`, `POST /api/verify/appointment`, `POST /api/appointments/:id/register`, `GET /api/appointments/:id/record`, `POST /api/appointments/:id/visit`, `GET /api/prescriptions/mine/:sludiId`, `POST /api/verify/prescription`, `POST /api/prescriptions/:id/dispense`, `POST /api/reset` (clears bookings; demo helper).

## Sharing on a network

The server listens on all interfaces. Share `http://<laptop LAN IP>:3000/patient/`. For the real SLUDI login from that address, register `http://<LAN IP>:3000/patient/callback` as a redirect URI on the OIDC client (DIS MCP `update_sludi_oidc_client` with `addRedirectUris`). Allow inbound TCP 3000 in the firewall. All testers share the same bookings.

## Security notes

The app has no authentication of its own and the triage route spends an API key: run it on trusted networks only. Credentials in the demo are HMAC-signed JSON, not production verifiable credentials.
