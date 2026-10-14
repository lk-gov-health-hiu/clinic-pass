// Clinic Pass demo server: one backend for the Patient app and the Hospital app.
// Simulated pieces are labelled as such. Real DPI calls (SLUDI, NDX, VC, Digi-Sign, GovPay)
// replace the functions in the "DPI adapters" section when the sandbox is reachable.

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');
const seed = require('./data/seed');

// ---------- config ----------
const CONFIG_PATH = path.join(__dirname, 'config.json');
let config = { anthropicApiKey: '', model: 'claude-sonnet-5-5', port: 3000, credentialSecret: 'demo-secret' };
try {
  config = { ...config, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
} catch {
  console.warn('No app/config.json found; using defaults (triage falls back to keyword matching).');
}

// ---------- runtime state (persisted) ----------
const STATE_PATH = path.join(__dirname, 'data', 'runtime.json');
let state = { appointments: [], prescriptions: [], ambulances: [], priority: {}, seq: 1 };
try { state = { ...state, ...JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) }; } catch { /* fresh */ }
const save = () => fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
const nextId = (p) => `${p}-${String(state.seq++).padStart(4, '0')}`;

// ---------- credential signing (simulated VC; swap for Inji/Certify when activated) ----------
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const hmac = (data, key) => crypto.createHmac('sha256', key).update(data).digest('base64url');

function issueCredential(type, subject, issuer, keyLabel) {
  const payload = { '@context': 'clinic-pass/v1', type, issuer, issuedAt: new Date().toISOString(), subject };
  const body = b64(payload);
  const sig = hmac(body, config.credentialSecret + ':' + keyLabel);
  return `${body}.${sig}`;
}
function verifyCredential(token, keyLabel) {
  const [body, sig] = String(token || '').trim().split('.');
  if (!body || !sig) return { valid: false, reason: 'Malformed credential' };
  if (hmac(body, config.credentialSecret + ':' + keyLabel) !== sig) {
    return { valid: false, reason: 'Signature check failed (credential altered or not issued by us)' };
  }
  try { return { valid: true, payload: JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) }; }
  catch { return { valid: false, reason: 'Unreadable credential' }; }
}
const qr = (token) => QRCode.toDataURL(token, { margin: 1, width: 240 });

// ---------- DPI adapters (SIMULATED for now) ----------
const livePatients = [];
const findPatient = (sludiId) => livePatients.find((p) => p.sludiId === sludiId) || seed.patients.find((p) => p.sludiId === sludiId);
const sludiLogin = (nic) => seed.patients.find((p) => p.nic === nic) || seed.patients[0]; // Login with SLUDI + eKYC
const ndxIsPensioner = (patient) => !!patient.pensioner;                                   // NDX pensioner status check
// Digi-Sign: real Digital Signature API (CSC v2, sandbox) when it is live and the doctor's SLUDI eKYC is configured;
// otherwise a labelled simulation. The signer is a SLUDI citizen (doctor details come from seed.doctors, mirroring the Citizen Collection).
const DIGISIGN_BASE = () => config.digiSignBase || 'https://api.staging.devportal.gov.lk/digital-signature/v1.0.0';
async function digiSign(rxPayload, doctor, speciality) {
  const hash = crypto.createHash('sha256').update(JSON.stringify(rxPayload));
  const sig = { signer: doctor.name, slmcRegNo: doctor.slmcRegNo, speciality, sludiId: doctor.sludiId, collectionRecord: doctor.collectionRecord,
    signedAt: new Date().toISOString(), digest: hash.copy().digest('hex') };
  if (config.disClientId && config.disApiKey && config.doctorEkyc) {   // doctorEkyc: signed eKYC JWS from the doctor's SLUDI login (short-lived; UNTESTED until the API is activated)
    try {
      const h = { 'content-type': 'application/json', 'X-DIS-CLIENT-ID': config.disClientId, 'X-DIS-API-KEY': config.disApiKey };
      const call = async (p, body) => { const r = await fetch(DIGISIGN_BASE() + p, { method: 'POST', headers: h, body: JSON.stringify(body) }); const j = await r.json(); if (!r.ok) throw new Error(j.error_description || j.error || r.status); return j; };
      const credentialID = `sludi:${doctor.sludiId}`, hashes = [hash.copy().digest('base64')];
      const a = await call('/csc/v2/credentials/authorize', { credentialID, numSignatures: 1, hash: hashes, ekyc: config.doctorEkyc, acr: 'mosip:idp:acr:generated-code', OTP: '111111' });
      const s = await call('/csc/v2/signatures/signHash', { credentialID, SAD: a.SAD, hash: hashes, signAlgo: '1.2.840.113549.1.1.11' });
      return { ...sig, method: 'Digi-Sign API (sandbox)', jws: s.signatures[0], x5c: s.x5c, transactionId: s.transactionId, signedAt: s.signingTime || sig.signedAt };
    } catch (e) { console.error('Digi-Sign API failed, using simulation:', e.message); }
  }
  return { ...sig, method: 'Digi-Sign (simulated)' };
}
// Payments: real call to the Payment Platform API (IPG simulator) when DIS credentials are in config.json;
// falls back to a labelled simulation if the call fails (same pattern as Day 1).
async function govPayCharge(amountLkr, ref, who) {
  const base = config.paymentsBaseUrl || 'https://api.staging.devportal.gov.lk/payment-gateway/v1.0.0'  // Payment Gateway API: its transaction store backs the checkout page (Payment Platform API links 404);
  if (config.disClientId && config.disApiKey) {
    try {
      const r = await fetch(`${base}/api/sandbox/initiate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-DIS-CLIENT-ID': config.disClientId, 'X-DIS-API-KEY': config.disApiKey },
        body: JSON.stringify({
          merchant_id: config.paymentsMerchantId || 'merch_5f8a9d2c', amount: amountLkr, currency: 'LKR',
          notify_url: `http://localhost:${config.port}/api/payment-webhook`, return_url: `http://localhost:${config.port}/patient/`,
          metadata: { first_name: who || 'Patient', last_name: 'Demo', email: 'demo@example.com', reference: ref },
        }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error_code || body.message || r.status);
      return { provider: 'GovPay / IPG sandbox (real API)', amountLkr, ref, status: 'INITIATED', transactionId: body?.data?.transaction_id, redirectUrl: body?.data?.redirect_url, simulated: false };
    } catch (e) {
      console.warn('Payments API failed, simulating:', e.message);
      return { provider: 'GovPay (simulated; API call failed: ' + e.message + ')', amountLkr, ref, status: 'PAID', simulated: true };
    }
  }
  return { provider: 'GovPay (simulated)', amountLkr, ref, status: 'PAID', simulated: true };
}

// ---------- AI triage ----------
function keywordTriage(text) {
  const t = text.toLowerCase();
  let best = { id: 'general-medicine', score: 0 };
  for (const s of seed.specialties) {
    const score = s.keywords.filter((k) => t.includes(k)).length;
    if (score > best.score) best = { id: s.id, score };
  }
  const urgent = /chest pain|can't breathe|cannot breathe|unconscious|stroke|severe bleeding/.test(t);
  return {
    specialty: best.id,
    reason: best.score ? 'Matched keywords in your description (offline fallback).' : 'No clear match; general medicine can direct you (offline fallback).',
    urgency: urgent ? 'emergency' : 'routine',
    summary: { symptoms: [text.slice(0, 160)], duration: 'not stated', redFlags: urgent ? ['Possible emergency symptom'] : [] },
    source: 'keyword-fallback',
  };
}

async function claudeTriage(text, history) {
  const specialtyIds = seed.specialties.map((s) => s.id);
  const body = {
    model: config.model,
    max_tokens: 700,
    system:
      'You are a triage assistant for a Sri Lankan public-hospital clinic booking service. ' +
      'The patient is an older adult. Read their description and choose the single most suitable clinic specialty ' +
      'from the allowed list. You give guidance only, never a diagnosis. If symptoms suggest an emergency ' +
      '(e.g. chest pain with breathlessness, stroke signs, severe bleeding), set urgency to "emergency". ' +
      'Known chronic conditions: ' + history.conditions.join('; ') + '. Regular medicines: ' + history.regularMedicines.join('; ') + '. ' +
      'Be brief. "duration" is ONLY how long the symptoms have lasted, as the patient said (e.g. "2 weeks"), or "not stated"; never a recommendation. ' +
      '"symptoms" are short phrases (max 5) and must not repeat known chronic conditions. "redFlags" has at most 3 short items (under 12 words each), only if relevant. ' +
      'Always answer by calling the record_triage tool.',
    tools: [{
      name: 'record_triage',
      description: 'Record the triage result.',
      input_schema: {
        type: 'object',
        properties: {
          specialty: { type: 'string', enum: specialtyIds },
          reason: { type: 'string', description: 'One plain sentence for the patient explaining the choice.' },
          urgency: { type: 'string', enum: ['routine', 'soon', 'emergency'] },
          symptoms: { type: 'array', items: { type: 'string' } },
          duration: { type: 'string' },
          redFlags: { type: 'array', items: { type: 'string' } },
        },
        required: ['specialty', 'reason', 'urgency', 'symptoms'],
      },
    }],
    tool_choice: { type: 'auto' }, // forced tool_choice is rejected by this model; the system prompt requires the tool call
    messages: [{ role: 'user', content: text }],
  };
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': config.anthropicApiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const tool = (data.content || []).find((c) => c.type === 'tool_use');
  if (!tool) throw new Error('No tool_use in response');
  const i = tool.input;
  return {
    specialty: i.specialty,
    reason: i.reason || `Based on what you described, ${specialtyName(i.specialty)} is the most suitable clinic.`, // Haiku sometimes omits it
    urgency: i.urgency,
    summary: { symptoms: i.symptoms || [], duration: i.duration || 'not stated', redFlags: i.redFlags || [] },
    source: 'claude:' + config.model,
  };
}

// ---------- app ----------
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const find = (id) => state.appointments.find((a) => a.id === id);
const hospitalById = (id) => seed.hospitals.find((h) => h.id === id);
const specialtyName = (id) => (seed.specialties.find((s) => s.id === id) || {}).name || id;

app.get('/api/status', (req, res) => res.json({ claudeConfigured: !!config.anthropicApiKey, model: config.model }));

// ---------- Real Login with SLUDI (eSignet): authorization code + PKCE S256 + private_key_jwt ----------
const ESIGNET = config.esignetBase || 'https://esignet.staging.devportal.gov.lk';
const SLUDI_CLIENT_ID = config.sludiClientId || ''; // OIDC client id from create_sludi_oidc_client (config.json)
const SLUDI_REDIRECT = `http://localhost:${config.port}/patient/callback`;
const PEM_PATH = path.join(__dirname, 'sludi-private-key.pem');
const sludiPending = new Map();   // state -> { verifier, nonce }
const sludiSessions = new Map();  // sid -> patient
const b64u = (buf) => Buffer.from(buf).toString('base64url');

function clientAssertion() {
  const header = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const claims = b64u(JSON.stringify({ iss: SLUDI_CLIENT_ID, sub: SLUDI_CLIENT_ID, aud: `${ESIGNET}/v1/esignet/oauth/v2/token`, jti: crypto.randomUUID(), iat: now, exp: now + 300 }));
  const sig = crypto.sign('RSA-SHA256', Buffer.from(`${header}.${claims}`), crypto.createPrivateKey(fs.readFileSync(PEM_PATH)));
  return `${header}.${claims}.${b64u(sig)}`;
}
const decodeJwtPayload = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8'));

function patientFromClaims(c) {
  const name = typeof c.name === 'object' ? (c.name.en || Object.values(c.name)[0]) : c.name;
  const dob = c.birthdate || '';
  const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) : null;
  const addr = typeof c.address === 'object' ? [c.address.street_address, c.address.locality].filter(Boolean).join(', ') : (c.address || '');
  return {
    sludiId: 'SLUDI-' + (c.individual_id || c.sub), nic: c.nic || '', name, dob, age, phone: c.phone_number || '', address: addr,
    // NDX is not reachable here, so pensioner status is a labelled demo flag (demoForcePensioner:false uses age >= 60)
    pensioner: config.demoForcePensioner === false ? (age != null && age >= 60) : true,
    phn: 'PHN-0001-2345', real: true,
  };
}

app.get('/api/sludi/start', (req, res) => {
  if (!SLUDI_CLIENT_ID) return res.status(503).json({ error: 'sludiClientId is not set in app/config.json' });
  if (!fs.existsSync(PEM_PATH)) return res.status(503).json({ error: 'SLUDI private key not found (app/sludi-private-key.pem)' });
  const state = crypto.randomBytes(12).toString('hex'), nonce = crypto.randomBytes(12).toString('hex');
  const verifier = crypto.randomBytes(32).toString('base64url');
  const redirect = `http://${req.headers.host}/patient/callback`;
  sludiPending.set(state, { verifier, nonce, redirect });
  const q = new URLSearchParams({
    client_id: SLUDI_CLIENT_ID, redirect_uri: redirect, response_type: 'code', scope: 'openid profile email',
    state, nonce, code_challenge: crypto.createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256',
    acr_values: 'mosip:idp:acr:static-code mosip:idp:acr:biometrics',
  });
  res.json({ url: `${ESIGNET}/authorize?${q}` });
});

app.get('/patient/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const pend = sludiPending.get(state);
  if (error || !code || !pend) return res.redirect('/patient/?sludi_error=' + encodeURIComponent(error_description || error || 'Invalid login response'));
  sludiPending.delete(state);
  try {
    const tok = await fetch(`${ESIGNET}/v1/esignet/oauth/v2/token`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: pend.redirect, client_id: SLUDI_CLIENT_ID,
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer', client_assertion: clientAssertion(), code_verifier: pend.verifier }),
    });
    const tj = await tok.json();
    if (!tok.ok) throw new Error(tj.error_description || tj.error || 'Token exchange failed');
    const ui = await fetch(`${ESIGNET}/v1/esignet/oidc/userinfo`, { headers: { authorization: 'Bearer ' + tj.access_token } });
    const text = await ui.text();
    if (!ui.ok) throw new Error('Userinfo failed: ' + text.slice(0, 120));
    let claims; try { claims = JSON.parse(text); } catch { claims = decodeJwtPayload(text); }
    console.log('SLUDI claims received:', JSON.stringify({ ...claims, picture: claims.picture ? '<omitted>' : undefined }));
    const patient = patientFromClaims(claims);
    const i = livePatients.findIndex((p) => p.sludiId === patient.sludiId);
    if (i >= 0) livePatients[i] = patient; else livePatients.push(patient);
    const sid = crypto.randomBytes(8).toString('hex'); sludiSessions.set(sid, patient);
    res.redirect('/patient/?sid=' + sid);
  } catch (e) {
    console.error('SLUDI login error:', e.message);
    res.redirect('/patient/?sludi_error=' + encodeURIComponent(e.message));
  }
});

app.get('/api/sludi/session/:sid', (req, res) => {
  const p = sludiSessions.get(req.params.sid);
  p ? res.json({ patient: p, source: 'Login with SLUDI (real, sandbox)' }) : res.status(404).json({ error: 'Session expired' });
});

// Patient: SLUDI login (simulated fallback) + PHN
app.post('/api/sludi/login', (req, res) => res.json({ patient: sludiLogin(req.body.nic), source: 'simulated' }));

app.post('/api/phn', (req, res) => {
  const p = findPatient(req.body.sludiId);
  if (!p) return res.status(404).json({ error: 'Unknown patient' });
  const norm = (x) => String(x || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (norm(req.body.phn) !== norm(p.phn) && norm(req.body.phn) !== norm(p.phn).replace(/^PHN/, '')) {
    return res.status(400).json({ error: `PHN not recognised. For this demo use ${p.phn}` });
  }
  res.json({ ok: true, conditions: seed.records[p.phn].conditions });
});

// Triage
app.post('/api/triage', async (req, res) => {
  const text = String(req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Please describe the problem' });
  const patient = findPatient(req.body.sludiId) || seed.patients[0];
  const history = seed.records[patient.phn];
  let result;
  try {
    result = config.anthropicApiKey ? await claudeTriage(text, history) : keywordTriage(text);
  } catch (e) {
    console.error('Triage error, using fallback:', e.message);
    result = { ...keywordTriage(text), note: 'AI unavailable, used fallback' };
  }
  result.specialtyName = specialtyName(result.specialty);
  const hospitals = seed.hospitals
    .filter((h) => h.specialties.includes(result.specialty))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .map((h) => ({ id: h.id, name: h.name, distanceKm: h.distanceKm }));
  res.json({ ...result, hospitals });
});

// ---------- Appointment slots and priority verification ----------
const PRIORITY_TIMES = ['08:00', '08:15', '08:30', '08:45', '09:00'];
const NORMAL_TIMES = ['09:30', '09:45', '10:00', '10:15', '10:30', '10:45', '11:00', '11:15'];
const PRIORITY_CATEGORIES = {
  pensioner: 'Pensioner',
  armed_forces: 'Armed forces (serving or retired)',
  health_worker: 'Health worker',
};
const hashStr = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

function slotTaken(hospitalId, specialty, date, time) {
  if (state.appointments.some((a) => a.hospitalId === hospitalId && a.specialty === specialty && a.date === date && a.time === time && a.status !== 'CANCELLED')) return true;
  return hashStr(`${hospitalId}|${specialty}|${date}|${time}`) % 4 === 0; // looks like a real, partly booked clinic
}

function nextSlots(hospitalId, specialty, type, count = 5) {
  const times = type === 'priority' ? PRIORITY_TIMES : NORMAL_TIMES;
  const out = [];
  for (let d = 1; d <= 45 && out.length < count; d++) {
    const dt = new Date(Date.now() + d * 86400000);
    if ([0, 6].includes(dt.getUTCDay())) continue; // clinics run on weekdays
    const date = dt.toISOString().slice(0, 10);
    for (const time of times) {
      if (out.length >= count) break;
      if (!slotTaken(hospitalId, specialty, date, time)) {
        out.push({ date, time, type, weekday: dt.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' }) });
      }
    }
  }
  return out;
}

app.get('/api/slots', (req, res) => {
  const { hospitalId, specialty } = req.query;
  if (!hospitalById(hospitalId) || !specialty) return res.status(400).json({ error: 'hospitalId and specialty are required' });
  res.json({ priority: nextSlots(hospitalId, specialty, 'priority'), normal: nextSlots(hospitalId, specialty, 'normal'), categories: PRIORITY_CATEGORIES });
});


// Pensioner Status Verification API (real sandbox): identity check on the SLUDI-verified name / NIC / address,
// then a residency lookup by SLUDI id. A match means the person is in the pensioner registry.
async function pensionerRegistryCheck(patient) {
  if (!config.disClientId || !config.disApiKey) return { found: false, error: 'no API credentials' };
  const base = config.pensionerApiBase || 'https://api.staging.devportal.gov.lk/pensioner-status-verification/v1.0.0';
  const headers = { 'content-type': 'application/json', 'X-DIS-CLIENT-ID': config.disClientId, 'X-DIS-API-KEY': config.disApiKey };
  try {
    const call = async (p, body) => { const r = await fetch(base + p, { method: 'POST', headers, body: JSON.stringify(body) }); return { ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) }; };
    const id = await call('/identity-verification', { name: String(patient.name || '').toUpperCase(), address: String(patient.address || '').toUpperCase(), idNumber: patient.nic });
    if (id.status >= 400) return { found: false, error: id.body.error_code || id.status };
    if (id.body.data && id.body.data.verificationStatus === 'VERIFIED') {
      return { found: true, how: 'name, NIC and address match a pensioner record', detail: `Registry request ${id.body.requestId}.` };
    }
    const sludiRef = String(patient.sludiId || '');
    if (sludiRef) {
      const res = await call('/residency-vital-status-validation', { sludi: sludiRef });
      if (res.ok && res.body.status === 'SUCCESS' && res.body.data) {
        return { found: true, how: `SLUDI id found in pensioner registry, residency ${res.body.data.residencyStatus}`, detail: `Registry request ${res.body.requestId}.` };
      }
    }
    return { found: false };
  } catch (e) { return { found: false, error: e.message }; }
}

// Priority verification: pensioner is checked against the patient's SLUDI identity (verified date of birth, age 60+).
// Armed forces and health worker need the relevant registries via NDX, which are not reachable here: simulated and labelled.
app.post('/api/priority/verify', async (req, res) => {
  const patient = findPatient(req.body.sludiId);
  const category = req.body.category;
  if (!patient || !PRIORITY_CATEGORIES[category]) return res.status(400).json({ error: 'Unknown patient or category' });
  const demo = config.demoPriorityAll !== false;
  let verified = false, method = '', detail = '';
  if (category === 'pensioner') {
    // Pensioner status comes ONLY from the Pensioner Status Verification API (Pensions Department registry).
    // No age check and no demo override here.
    const reg = await pensionerRegistryCheck(patient);
    console.log(`Pensioner registry check for ${patient.sludiId} (${patient.nic}): ${JSON.stringify(reg)}`);
    verified = !!reg.found;
    method = verified ? `Pensioner Status Verification API (Pensions Department registry): ${reg.how}`
      : 'Pensioner Status Verification API (Pensions Department registry): no matching pensioner record';
    detail = verified ? reg.detail : (reg.error ? `Registry call failed (${reg.error}).` : 'This person is not listed as a pensioner.');
  } else {
    verified = demo;
    method = 'NDX registry check (simulated: ' + (category === 'armed_forces' ? 'Ministry of Defence' : 'Ministry of Health') + ' registry not reachable here)';
  }
  state.priority = state.priority || {};
  state.priority[patient.sludiId] = { category, verified, method, at: new Date().toISOString() };
  save();
  res.json({ verified, category, label: PRIORITY_CATEGORIES[category], method, detail });
});

// Book the chosen slot -> Appointment VC
app.post('/api/appointments', async (req, res) => {
  const { sludiId, hospitalId, specialty, triage, consentRecord, slot } = req.body;
  const patient = findPatient(sludiId);
  const hospital = hospitalById(hospitalId);
  if (!patient || !hospital || !specialty || !slot) return res.status(400).json({ error: 'Missing patient, hospital, specialty or slot' });
  const { date, time, type } = slot;
  const times = type === 'priority' ? PRIORITY_TIMES : NORMAL_TIMES;
  if (!['priority', 'normal'].includes(type) || !times.includes(time)) return res.status(400).json({ error: 'Invalid slot' });
  if (slotTaken(hospitalId, specialty, date, time)) return res.status(409).json({ error: 'That slot was just taken. Please pick another.' });

  let priorityInfo = null;
  if (type === 'priority') {
    const v = (state.priority || {})[sludiId];
    if (!v || !v.verified) return res.status(403).json({ error: 'Priority slots need a verified priority category (pensioner, armed forces or health worker).' });
    priorityInfo = { category: v.category, label: PRIORITY_CATEGORIES[v.category], method: v.method };
  }

  const appt = {
    id: nextId('APT'), sludiId, patientName: patient.name, nic: patient.nic, phn: patient.phn,
    hospitalId, hospitalName: hospital.name, hospitalAddress: hospital.address, specialty, specialtyName: specialtyName(specialty),
    date, time, slotType: type, priority: type === 'priority', priorityCategory: priorityInfo ? priorityInfo.label : null, priorityMethod: priorityInfo ? priorityInfo.method : null,
    consentRecord: !!consentRecord, triage: triage || null, status: 'BOOKED', createdAt: new Date().toISOString(),
  };
  appt.credential = issueCredential(
    'ClinicAppointmentCredential',
    { appointmentId: appt.id, name: patient.name, nic: patient.nic, phn: patient.phn, hospitalId, hospital: hospital.name, hospitalAddress: hospital.address, specialty: appt.specialtyName, date, time, slotType: type, priorityCategory: appt.priorityCategory },
    'Clinic Pass hospital system (simulated issuer)', 'appointment'
  );
  state.appointments.push(appt); save();
  res.json({ appointment: appt, qr: await qr(appt.credential) });
});

// Google Wallet "Generic" pass object for an appointment. UNSIGNED: a real "Add to Google Wallet" link needs a
// Google Wallet issuer account (config.googleWalletIssuerId) and a service-account-signed JWT; not available yet.
app.get('/api/appointments/:id/wallet', (req, res) => {
  const a = find(req.params.id);
  if (!a) return res.status(404).json({ error: 'Appointment not found' });
  const issuer = config.googleWalletIssuerId || 'ISSUER_ID_NOT_CONFIGURED';
  const h = hospitalById(a.hospitalId), t = h && townById(h.town);
  res.json({ simulated: true, signed: false, note: 'Unsigned pass object. Needs a Google Wallet issuer account and a signed JWT to be added for real.',
    genericClass: { id: `${issuer}.clinic_pass_appointment` },
    genericObject: {
      id: `${issuer}.${a.id}`, classId: `${issuer}.clinic_pass_appointment`, state: 'ACTIVE',
      cardTitle: { defaultValue: { language: 'en', value: 'Clinic Pass' } },
      header: { defaultValue: { language: 'en', value: a.patientName } },
      subheader: { defaultValue: { language: 'en', value: `${a.specialtyName} clinic` } },
      textModulesData: [
        { id: 'hospital', header: 'Hospital', body: a.hospitalName },
        { id: 'address', header: 'Address', body: a.hospitalAddress || '' },
        { id: 'when', header: 'Date and time', body: `${a.date} at ${a.time}` },
        { id: 'phn', header: 'PHN', body: a.phn || '' },
        { id: 'appt', header: 'Appointment ID', body: a.id },
        { id: 'type', header: 'Type', body: a.priority ? `Priority: ${a.priorityCategory}` : 'Normal appointment' },
      ],
      barcode: { type: 'QR_CODE', value: a.credential, alternateText: a.id },
      locations: t ? [{ latitude: t.lat, longitude: t.lon }] : [],
      hexBackgroundColor: '#1d4ea1',
    } });
});

app.get('/api/appointments/mine/:sludiId', (req, res) => {
  res.json(state.appointments.filter((a) => a.sludiId === req.params.sludiId));
});

// Ambulance (value-added) + GovPay. Fare estimate is a simulated tariff.
const AMB_BASE = 1500, AMB_PER_KM = 100, AMB_MIN = 2000, ROAD_FACTOR = 1.3;
const townById = (id) => seed.towns.find((t) => t.id === id);
// The pickup is the patient's profile address (SLUDI), matched to a known town by name.
const townFromAddress = (addr) => { const a = String(addr || '').toLowerCase(); return seed.towns.find((t) => a.includes(t.name.toLowerCase())); };
function ambulanceQuote(pickupTownId, hospitalId) {
  const from = townById(pickupTownId), hospital = hospitalById(hospitalId), to = hospital && townById(hospital.town);
  if (!from || !to) return null;
  const rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(to.lat - from.lat) / 2) ** 2 + Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(rad(to.lon - from.lon) / 2) ** 2;
  const km = Math.round(2 * 6371 * Math.asin(Math.sqrt(a)) * ROAD_FACTOR * 10) / 10;
  const fareLkr = Math.max(AMB_MIN, Math.round((AMB_BASE + AMB_PER_KM * km) / 50) * 50);
  return { from: from.name, to: to.name, hospital: hospital.name, km, fareLkr, base: AMB_BASE, perKm: AMB_PER_KM, min: AMB_MIN, simulated: true };
}
app.get('/api/ambulance/quote', (req, res) => {
  const town = req.query.address ? (townFromAddress(req.query.address) || {}).id : req.query.pickupTown;
  const q = ambulanceQuote(town, req.query.hospitalId);
  q ? res.json(q) : res.status(400).json({ error: 'We could not place your profile address near a known town' });
});
app.get('/api/ambulance/options', (req, res) => {
  res.json({ towns: seed.towns.map((t) => ({ id: t.id, name: t.name })), hospitals: seed.hospitals.map((h) => ({ id: h.id, name: h.name })) });
});
app.post('/api/ambulance', async (req, res) => {
  const appt = find(req.body.appointmentId);
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });
  const town = req.body.address ? (townFromAddress(req.body.address) || {}).id : (req.body.pickupTown || 'colombo');
  const quote = ambulanceQuote(town, req.body.hospitalId || appt.hospitalId);
  if (!quote) return res.status(400).json({ error: 'We could not place your profile address near a known town' });
  const booking = { id: nextId('AMB'), appointmentId: appt.id, pickup: quote.from, to: quote.hospital, km: quote.km,
    payment: await govPayCharge(quote.fareLkr, appt.id, (appt.patientName || '').split(' ')[0]) };
  state.ambulances.push(booking); save();
  res.json(booking);
});

// Hospital: list + verify + register
app.get('/api/hospital/:hid/appointments', (req, res) => {
  res.json(state.appointments.filter((a) => a.hospitalId === req.params.hid).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)));
});

app.post('/api/verify/appointment', (req, res) => {
  const v = verifyCredential(req.body.token, 'appointment');
  if (!v.valid) return res.json(v);
  const appt = find(v.payload.subject.appointmentId);
  if (!appt) return res.json({ valid: false, reason: 'No such appointment in this system' });
  res.json({ valid: true, appointment: appt, payload: v.payload });
});

app.post('/api/appointments/:id/register', (req, res) => {
  const a = find(req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  if (req.body.hospitalId && req.body.hospitalId !== a.hospitalId) return res.status(409).json({ error: `This appointment is for ${a.hospitalName}` });
  a.status = 'REGISTERED'; a.registeredAt = new Date().toISOString(); save();
  res.json(a);
});

// Clinician: consented record, visit, prescription VC signed with Digi-Sign (simulated)
app.get('/api/appointments/:id/record', (req, res) => {
  const a = find(req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  if (a.status === 'BOOKED') return res.status(403).json({ error: 'Patient not yet registered at the counter' });
  if (!a.consentRecord) return res.status(403).json({ error: 'Patient has not consented to share the health record' });
  res.json({ record: seed.records[a.phn], triage: a.triage, source: 'simulated health record, released with patient consent' });
});

app.post('/api/appointments/:id/visit', async (req, res) => {
  const a = find(req.params.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  const { diagnosis, notes, medicines } = req.body;
  const meds = (medicines || []).filter((m) => m.name);
  const rxId = nextId('RX');
  const subject = { prescriptionId: rxId, patient: a.patientName, phn: a.phn, hospital: a.hospitalName, specialty: a.specialtyName,
    date: new Date().toISOString().slice(0, 10), diagnosis, medicines: meds, payment: 'None (free of charge)' };
  const signature = await digiSign(subject, seed.doctors[0], a.specialtyName);
  const rx = { id: rxId, appointmentId: a.id, status: 'ISSUED', subject, signature };
  rx.credential = issueCredential('PrescriptionCredential', { ...subject, signature }, 'Clinic Pass hospital system (simulated issuer)', 'prescription');
  state.prescriptions.push(rx);
  seed.records[a.phn].visits.unshift({ date: subject.date, clinic: a.specialtyName, note: `${diagnosis}. ${notes || ''}`.trim() });
  a.status = 'COMPLETED'; a.visit = { diagnosis, notes }; save();
  res.json({ prescription: rx, qr: await qr(rx.credential) });
});

// Patient wallet: prescriptions
app.get('/api/prescriptions/mine/:sludiId', async (req, res) => {
  const mine = state.prescriptions.filter((r) => {
    const a = find(r.appointmentId); return a && a.sludiId === req.params.sludiId;
  });
  res.json(await Promise.all(mine.map(async (r) => ({ ...r, qr: await qr(r.credential) }))));
});

// Pharmacy
app.post('/api/verify/prescription', (req, res) => {
  const v = verifyCredential(req.body.token, 'prescription');
  if (!v.valid) return res.json(v);
  const rx = state.prescriptions.find((r) => r.id === v.payload.subject.prescriptionId);
  if (!rx) return res.json({ valid: false, reason: 'No such prescription in this system' });
  if (rx.status === 'DISPENSED') return res.json({ valid: false, reason: `Already dispensed at ${rx.dispensedAt}`, prescription: rx });
  res.json({ valid: true, prescription: rx });
});

app.post('/api/prescriptions/:id/dispense', (req, res) => {
  const rx = state.prescriptions.find((r) => r.id === req.params.id);
  if (!rx) return res.status(404).json({ error: 'Not found' });
  rx.status = 'DISPENSED'; rx.dispensedAt = new Date().toISOString(); save();
  res.json(rx);
});

// Demo shortcut: patient taps "Show at counter / pharmacy"; the hospital app loads the latest shared credential
app.post('/api/share', (req, res) => {
  const a = find(req.body.id); const rx = state.prescriptions.find((r) => r.id === req.body.id);
  const item = a || rx;
  if (!item) return res.status(404).json({ error: 'Not found' });
  item.sharedAt = new Date().toISOString(); save(); res.json({ ok: true });
});
app.get('/api/shared/appointment/:hid', (req, res) => {
  const list = state.appointments.filter((a) => a.hospitalId === req.params.hid && a.sharedAt && a.status === 'BOOKED').sort((x, y) => y.sharedAt.localeCompare(x.sharedAt));
  list.length ? res.json({ token: list[0].credential }) : res.status(404).json({ error: 'No pass has been shown by a patient yet' });
});
app.get('/api/shared/prescription', (req, res) => {
  const list = state.prescriptions.filter((r) => r.sharedAt && r.status === 'ISSUED').sort((x, y) => y.sharedAt.localeCompare(x.sharedAt));
  list.length ? res.json({ token: list[0].credential }) : res.status(404).json({ error: 'No prescription has been shown by a patient yet' });
});

// Demo helpers: the tests save the live data, clear it, then put it back (so they never lose real appointments)
app.get('/api/snapshot', (req, res) => res.json(state));
app.post('/api/restore', (req, res) => { state = { ...state, ...req.body }; save(); res.json({ ok: true }); });
app.post('/api/reset', (req, res) => { state = { appointments: [], prescriptions: [], ambulances: [], priority: {}, seq: 1 }; save(); res.json({ ok: true }); });

app.listen(config.port, () => {
  console.log(`Clinic Pass demo running`);
  console.log(`  Patient app : http://localhost:${config.port}/patient/`);
  console.log(`  Hospital app: http://localhost:${config.port}/hospital/`);
  console.log(`  Claude triage: ${config.anthropicApiKey ? 'ON (' + config.model + ')' : 'OFF (keyword fallback)'}`);
});
