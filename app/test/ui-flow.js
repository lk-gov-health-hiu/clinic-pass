// Browser walk-through of both apps with Playwright (uses your installed Chrome; no browser download).
//   npm install            (installs playwright-core as a dev dependency)
//   node test/ui-flow.js   (server must be running; screenshots go to ../tmp/)
// Uses the simulated login, because the real SLUDI login needs credentials typed by a person.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright-core');
const BASE = process.env.BASE || 'http://localhost:3000';
const OUT = path.join(__dirname, '..', '..', 'tmp');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true });
  const errs = [];
  await fetch(BASE + '/api/reset', { method: 'POST' });

  const pat = await (await browser.newContext({ viewport: { width: 430, height: 900 } })).newPage();
  pat.on('pageerror', (e) => errs.push('patient: ' + e.message));
  await pat.goto(BASE + '/patient/');
  await pat.getByText('Offline fallback').click();
  await pat.locator('#phn').fill('PHN-0001-2345');
  await pat.getByRole('button', { name: 'Continue' }).click();
  await pat.locator('#problem').fill('My vision has been blurry for two weeks and I get morning headaches');
  await pat.getByRole('button', { name: 'Find the right clinic' }).click();
  await pat.locator('.hospital').first().waitFor({ timeout: 60000 });
  await pat.locator('.hospital').first().click();
  await pat.locator('#norm-slots .slot').first().waitFor();
  await pat.locator('#prio-cat').selectOption('pensioner');
  await pat.getByRole('button', { name: 'Verify priority' }).click();
  await pat.locator('#prio-msg .banner.ok').waitFor();
  await pat.screenshot({ path: path.join(OUT, 'ui-1-slots.png'), fullPage: true });
  await pat.locator('#prio-slots .slot').first().click();
  await pat.locator('#tok').waitFor();
  await pat.getByRole('button', { name: 'Book ambulance' }).click();
  await pat.locator('#amb-out .banner').waitFor();
  await pat.getByRole('button', { name: 'Show at registration counter' }).click();

  const hos = await (await browser.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
  hos.on('pageerror', (e) => errs.push('hospital: ' + e.message));
  await hos.goto(BASE + '/hospital/');
  await hos.locator('#hosp').selectOption('h2');
  await hos.getByRole('button', { name: 'Load from patient phone' }).first().click();
  await hos.getByRole('button', { name: /Register and send/ }).click();
  await hos.getByText('Registered. The patient is now in the clinician queue.').waitFor();
  await hos.getByRole('button', { name: 'Clinician', exact: true }).click();
  await hos.locator('#ready .hospital').first().click();
  await hos.locator('#rec table').waitFor();
  await hos.locator('#dx').fill('Test diagnosis');
  await hos.locator('.m-name').first().fill('Test drops');
  await hos.screenshot({ path: path.join(OUT, 'ui-2-clinician.png'), fullPage: true });
  await hos.getByRole('button', { name: /sign and issue/ }).click();
  await hos.locator('#rx-out .banner.ok').waitFor();

  await pat.getByRole('button', { name: 'Check for prescriptions' }).click();
  await pat.locator('#rx-list .vc').waitFor();
  await pat.getByRole('button', { name: 'Show at pharmacy' }).click();
  await hos.getByRole('button', { name: 'Pharmacy', exact: true }).click();
  await hos.getByRole('button', { name: 'Load from patient phone' }).first().click();
  await hos.locator('#p-out .banner.ok').waitFor();
  await hos.screenshot({ path: path.join(OUT, 'ui-3-pharmacy.png'), fullPage: true });

  console.log(errs.length ? 'PAGE ERRORS: ' + errs.join(' | ') : 'UI flow passed, no page errors. Screenshots in tmp/');
  await browser.close();
  await fetch(BASE + '/api/reset', { method: 'POST' });
  process.exit(errs.length ? 1 : 0);
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
