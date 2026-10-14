# Reference: Developer Portal docs (staging), read 2026-10-14

Source: https://docs.staging.devportal.gov.lk/ (public). Portal: https://developer.staging.devportal.gov.lk . **This supersedes the Day 1 hosts** (`stg.devportal.gov.lk`, `gateway.stg.devportal.gov.lk`), which time out. Some doc pages show `*.dev.digieconcenter.gov.lk` or `sgateway.*` hosts: treat every URL as "confirm on the portal's API page".

## 1. Quick start (portal)
Sign in (GitHub/Google/SSO) -> Dashboard -> API Catalog (blocks: Identity, Payments, National Data Exchange, Verifiable Credentials, Digital Signatures) -> My Applications -> Create (name, platform, select API versions, **IP whitelist required**, comma-separated IPv4, no CIDR documented) -> **API key shown once** (rotate if lost) -> Playground (synthetic data) -> Metrics. Tiers: Free, Extended Sandbox (MVPs, hackathons), Pre-Production. Rate limit headers `X-RateLimit-*`, `Retry-After`.

Auth on gateway APIs: `X-DIS-CLIENT-ID` + `X-DIS-API-KEY`. Gateway errors: `DIS-GE-4001/4011/4012/4013` (missing/bad key, inactive app), `4021` (402 no credits), `4031` unknown client, **`4032` IP not whitelisted**, `4033` no access to API/version, `4291` rate limit, `5020/5030` gateway/backend down. Body has `error_code`; header `DIS-GATEWAY-ERROR-CODE`.

## 2. MCP server (use it)
- URL `https://mcp.staging.devportal.gov.lk/mcp` (reachable from this laptop: returns 401 until OAuth). Streamable HTTP, OAuth client id `dis-mcp`, scopes `openid profile email offline_access`. Sign in with your portal account.
- **Claude Code:** `claude mcp add --transport http dis https://mcp.staging.devportal.gov.lk/mcp`, then `/mcp` and authenticate in the browser (needs the user to log in).
- Claude Desktop: Settings -> Connectors -> Add custom connector, client id `dis-mcp`.
- Tools: catalogue read (`search_apis`, `get_api_summary`, `get_api_versions`, `get_api_documentation` = full OpenAPI, `get_api_endpoints`, `get_endpoint_detail`); apps (`list_my_applications`, `get_application`); Playground seed data (`get_playground_context`, `get_seed_tables`, `get_seed_table_rows` max 200, `update_seed_table` max 500 rows, `reset_seed_data`); SLUDI citizen collections (`list_collections`, `get_collection`, `list/get/create/update/delete_collection_record`, `reset_collection_to_seed`); Login with SLUDI (`get_sludi_oidc_client`, `create_sludi_oidc_client` private key returned once, `update_sludi_oidc_client` max 5 redirect URIs, `get_sludi_authorize_url`).
- **Why it matters:** we can create synthetic pensioner/patient citizen records ourselves and pull exact OpenAPI specs into `app/openAPI/`.
- Limits: 60 req/min, 10 writes/min; it cannot create apps or use the API key; SLUDI needs the "SLUDI API" selected on the app; one ACTIVE SLUDI client per app.

## 3. SLUDI (Login with SLUDI, eSignet)
- Authorize `https://api.dev.digieconcenter.gov.lk/authorize`; Token `https://api.dev.digieconcenter.gov.lk/v1/esignet/oauth/v2/token` (curl from here hit a certificate-name error on that host: check on venue network or use the URL shown in the portal).
- Create client: portal **My SLUDI -> Issuer Configuration -> Create OIDC Client** (org name, display name, redirect URI) or MCP `create_sludi_oidc_client`. Download `private-key.pem`.
- Scopes `openid profile individual_id`; **PKCE S256**; `acr_values=mosip:idp:acr:generated-code`; client auth **`private_key_jwt`** (claims iss=sub=client_id, aud=token URL, exp ~5 min, signed with the PEM; `client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer`). Userinfo endpoint not on this page: take it from the portal/OpenAPI or decode the ID token.
- Test users/OTP not documented: create a citizen with a UIN via MCP collection tools; ask organisers about OTP.

## 4. NDX (exact, usable)
- Token: `POST https://ndx-thunderid.stg.dis.govtech.lk/oauth2/token`, client credentials, HTTP Basic (client_id:client_secret), `grant_type=client_credentials`, 3600 s.
- Data API base `https://ndx-consumer-app.stg.dis.govtech.lk`, Bearer token. **Only two documented endpoints:** `POST /api/query/person` `{"idCardNumber":"736604450V"}` -> `data.nicInfo` (id, fullNameEnglish, fullNameSinhala, nicStatus, issueDate, placeOfBirthEnglish, contactPhoneNo); `POST /api/query/farmer` -> `data.farmerInfo`.
- **Consent:** first call returns `data: null` + error `CE_NOT_APPROVED` with `extensions.consentPortalUrl` (portal `https://ndx-consent-portal.stg.dis.govtech.lk`); send the citizen there, then retry. This is the consent screen we want in the demo.
- Not documented: civil/business/land/vehicle registries, health records. These hosts did not resolve from this laptop (internal DNS): need venue network. Repo: `GovTech-SL/dis-open-ndx`.

## 5. G2P Subsidy (OpenG2P facade): real, useful for us
Base `https://sgateway.dev.digieconcenter.gov.lk/g2p/v1.0.0`, headers `X-DIS-CLIENT-ID`, `X-DIS-API-KEY`, JSON. **May be hidden in the catalog: request early access from the DIS platform team.** Needs a SLUDI sandbox UIN.
- `POST /schemes` (name, `pbmsProgramId` unique, currency, `benefitAmount`, `totalQuota`, `eligibilityCriteria` e.g. `requiresLowIncomeFlag`, `minAge`) -> 201 `schemeId`
- `GET /schemes/{id}`; `GET /schemes/{id}/quota` (total, reserved, committed, used, remaining)
- `POST /eligibility/check` `{schemeId, uin}` -> `{eligible, beneficiaryId, entitlementAmount, reasons[]}`
- `POST /disbursements` (`Idempotency-Key` header; schemeId, beneficiaryId, amount, currency) -> 202 PENDING; `GET /disbursements/{id}` -> PENDING / SUCCEEDED / FAILED. `financialAddress` ending `0000` forces FAILED (where the field goes is unclear).
- Errors: 400 bad_request, 404 scheme/beneficiary_not_found, 409 scheme_conflict / quota_exhausted / ineligible_for_disbursement.

## 6. Digital signature (Digi-Sign): portal flow, no API documented
User flow: Digi-Sign portal -> MySLUDI login (UIN + OTP) -> upload PDF -> only the SHA-256 digest is sent -> download signed PDF. Verify page needs no login (valid / altered / invalid / cannot be confirmed / unknown signer). Backend uses a CSC v2 API but no endpoints are published. In our app: **redirect the patient to Digi-Sign for the registration/consent form**, or simulate.

## 7. Payments (IPG Simulator)
`POST https://paymentgateway.dev.digieconcenter.gov.lk/IPG/v2.0.0/api/sandbox/initiate` (curl from here: certificate-name error), header `X-DIS-CLIENT-ID` (Day 1 also sent the API key). Body: merchant_id, amount, currency LKR, notify_url, return_url, metadata {first_name, last_name, email}. Returns `transaction_id` and `redirect_url` (simulator page where the outcome can be changed). Webhook to `notify_url` with status SUCCESS or CANCELED. Day 1: merchant id came from Playground `GET /playground-action/merchants`.

## 8. Verifiable credentials (Inji / Certify / Mimoto)
Issuance **needs manual onboarding by sandbox ops**: create template + attribute mappings in **My SLUDI -> Verifiable Credentials**, ask sandbox ops support to activate (they register on the Certify issuer registry, set trust bindings, reload Mimoto mappings); then request issuance from Mimoto via the gateway and deliver the JSON credential, or import into **Inji Wallet**. No endpoints published. **Request activation in the first minutes**, and plan a mocked VC (signed JSON + QR) as fallback.

## 9. Other
- NIC verification example: `POST /v1/nic/verify` on `https://api.developer.gov.lk/v1` returns status, nic, name, dob (docs example host; confirm).
- Changelog: Oct 2026 MCP sandbox collections + Login with SLUDI; Aug 2026 MCP server; Jun 2026 1.0.0.
- Reachability from this laptop (14 Oct ~11:00): MCP host reachable; Day 1 `*.stg.devportal.gov.lk` hosts still time out; `ndx-*.stg.dis.govtech.lk` do not resolve; `*.digieconcenter.gov.lk` hosts give a certificate-name error. Re-check on the venue network.
