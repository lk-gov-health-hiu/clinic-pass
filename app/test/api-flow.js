// End-to-end API check of the whole journey against a RUNNING server (npm start in another terminal).
//   node test/api-flow.js            (BASE=http://localhost:3000 by default)
// Uses the simulated login patient, so no browser or SLUDI credentials are needed.
const BASE = process.env.BASE || 'http://localhost:3000';
const post = (u, b) => fetch(BASE + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const get = (u) => fetch(BASE + u).then((r) => r.json());
let failed = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${extra}`); if (!ok) failed++; };

(async () => {
  await post('/api/reset', {});
  const { patient } = await post('/api/sludi/login', { nic: '195212345V' });
  check('PHN accepted (tolerant format)', (await post('/api/phn', { sludiId: patient.sludiId, phn: 'phn 0001 2345' })).ok === true);
  check('wrong PHN rejected', !!(await post('/api/phn', { sludiId: patient.sludiId, phn: 'PHN-9999' })).error);

  const t = await post('/api/triage', { text: 'My vision has been blurry for two weeks', sludiId: patient.sludiId });
  check('triage picks ophthalmology', t.specialty === 'ophthalmology', `(${t.source})`);

  const slots = await get(`/api/slots?hospitalId=h2&specialty=ophthalmology`);
  check('5 priority + 5 normal slots', slots.priority.length === 5 && slots.normal.length === 5);

  const noVerify = await post('/api/appointments', { sludiId: patient.sludiId, hospitalId: 'h2', specialty: 'ophthalmology', consentRecord: true, slot: slots.priority[0] });
  check('priority slot refused before verification', !!noVerify.error);

  const v = await post('/api/priority/verify', { sludiId: patient.sludiId, category: 'pensioner' });
  check('pensioner verified by registry API', v.verified === true, `(${v.method})`);

  const b = await post('/api/appointments', { sludiId: patient.sludiId, hospitalId: 'h2', specialty: 'ophthalmology', consentRecord: true, triage: t.summary, slot: slots.priority[0] });
  const a = b.appointment;
  check('priority appointment booked', !!a && a.priority === true);
  check('same slot cannot be double booked', !!(await post('/api/appointments', { sludiId: patient.sludiId, hospitalId: 'h2', specialty: 'ophthalmology', consentRecord: true, slot: slots.priority[0] })).error);

  check('tampered pass rejected', (await post('/api/verify/appointment', { token: a.credential.slice(0, -3) + 'abc' })).valid === false);
  check('genuine pass verifies', (await post('/api/verify/appointment', { token: a.credential })).valid === true);
  check('record locked before registration', (await fetch(`${BASE}/api/appointments/${a.id}/record`)).status === 403);
  await post(`/api/appointments/${a.id}/register`, {});
  check('record released after registration (consent)', (await fetch(`${BASE}/api/appointments/${a.id}/record`)).status === 200);

  const amb = await post('/api/ambulance', { appointmentId: a.id });
  check('ambulance payment initiated', ['INITIATED', 'PAID'].includes(amb.payment.status), `(${amb.payment.provider})`);

  const visit = await post(`/api/appointments/${a.id}/visit`, { diagnosis: 'Test', notes: '', medicines: [{ name: 'Test drops', dose: 'qid', days: 7 }] });
  const rx = visit.prescription;
  check('prescription issued and signed', !!rx && rx.signature.method.startsWith('Digi-Sign'));
  check('pharmacy verifies prescription', (await post('/api/verify/prescription', { token: rx.credential })).valid === true);
  await post(`/api/prescriptions/${rx.id}/dispense`, {});
  const again = await post('/api/verify/prescription', { token: rx.credential });
  check('dispensed prescription refused', again.valid === false, `(${again.reason})`);

  await post('/api/reset', {});
  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
