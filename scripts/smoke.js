'use strict';

// End-to-end checks against a running API.
//
//   npm run smoke                                                # PUBLIC_BASE_URL + /api/v1
//   SMOKE_BASE_URL=https://<id>.execute-api.us-east-1.amazonaws.com/api/v1 npm run smoke
//
// Optional, off by default:
//   SMOKE_FORGE=1   forged-token checks; signs tokens with the local JWT_SECRET,
//                   so only meaningful against a local server
//   SMOKE_RATE=1    brute-force check; locks this IP out of /auth for 15 minutes
//
// Needs seed-credentials.local.json (written by `npm run seed -- --fresh`) and,
// for cleanup, the admin database credentials in .env. Writes only to a
// throwaway installation it creates and removes; the seed is left untouched.

const fs = require('node:fs');
const path = require('node:path');
const jwt = require('jsonwebtoken');
const { connect } = require('./db-connect');

require('dotenv').config({ quiet: true });

const BASE = (process.env.SMOKE_BASE_URL || `${process.env.PUBLIC_BASE_URL}/api/v1`).replace(/\/+$/, '');
const ORIGIN = new URL(BASE).origin;
const CREDENTIALS_FILE = path.join(__dirname, '..', 'seed-credentials.local.json');
const KANDY = { district_id: 4, substation_id: 4 }; // seed: substation ids equal district ids

let passed = 0;
const failures = [];

function check(label, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(label);
    console.log(`  ✗ ${label}${detail ? `  (${detail})` : ''}`);
  }
}

// A followed pagination link carries PUBLIC_BASE_URL's origin, which locally
// can differ from the server under test; aim it at BASE's origin.
async function call(method, url, { token, body, raw, headers = {} } = {}) {
  const target = url.startsWith('http') ? url.replace(/^https?:\/\/[^/]+/, ORIGIN) : BASE + url;
  const h = { ...headers };
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (raw !== undefined) payload = raw;
  else if (body !== undefined) {
    payload = JSON.stringify(body);
    h['Content-Type'] ??= 'application/json';
  }
  const res = await fetch(target, { method, headers: h, body: payload });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  return { status: res.status, headers: res.headers, json, text };
}

const code = (r) => r.json?.error?.code;
const total = (r) => r.json?.pagination?.total_count;
const offsetOf = (link) => link && Number(new URL(link).searchParams.get('offset'));

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    console.error('seed-credentials.local.json not found. Run: npm run seed -- --fresh');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'));
}

async function login(creds, email) {
  const user = creds.users.find((u) => u.email === email);
  if (!user) throw new Error(`${email} is not in seed-credentials.local.json`);
  const r = await call('POST', '/auth/login', { body: { email, password: user.password } });
  if (r.status !== 200) throw new Error(`login ${email} -> ${r.status} ${code(r) ?? ''}`);
  return r.json.token;
}

async function deviceLogin(meterId, secret) {
  const r = await call('POST', '/auth/device-token', { body: { meter_id: meterId, device_secret: secret } });
  if (r.status !== 200) throw new Error(`device login ${meterId} -> ${r.status} ${code(r) ?? ''}`);
  return r.json.token;
}

async function hierarchy(t) {
  console.log('\nHierarchy and scoped sub-collections');
  let r = await call('GET', '/provinces', { token: t.kandy });
  check('district officer sees exactly their own province', r.status === 200 && total(r) === 1 && r.json.data[0].province_id === 2, `${r.status} total=${total(r)}`);
  r = await call('GET', '/provinces', { token: t.national });
  check('national analyst sees all 9 provinces', total(r) === 9);
  r = await call('GET', '/provinces/2/districts', { token: t.national });
  check('GET /provinces/2/districts -> 3 districts', r.status === 200 && total(r) === 3);
  r = await call('GET', '/provinces/1/districts', { token: t.kandy });
  check('parent outside jurisdiction -> 404', r.status === 404);
  r = await call('GET', `/districts/${KANDY.district_id}/grid-substations`, { token: t.kandy });
  check('GET /districts/{id}/grid-substations', r.status === 200 && total(r) >= 1);
  r = await call('GET', `/grid-substations/${KANDY.substation_id}/installations?limit=5`, { token: t.kandy });
  check('GET /grid-substations/{id}/installations', r.status === 200 && r.json.data.length > 0);
  return r.json.data[0].installation_id;
}

async function readings(t, inst) {
  console.log('\nReadings history: pagination, filtering, sorting');
  let r = await call('GET', `/installations/${inst}/readings?limit=50&sort=recorded_at:asc`, { token: t.kandy });
  const n = total(r);
  const l = r.json.links;
  check('envelope: data, pagination.total_count, links', Array.isArray(r.json.data) && n >= 672 && !!l, `total=${n}`);
  check('first page: prev null, next at offset 50', l.prev === null && offsetOf(l.next) === 50);
  check('links are absolute and keep sort and limit', /^https?:/.test(l.next) && new URL(l.next).searchParams.get('sort') === 'recorded_at:asc');
  const first = r.json.data[0].recorded_at;
  r = await call('GET', l.next, { token: t.kandy });
  check('following next -> offset 50, prev at offset 0', r.json.pagination.offset === 50 && offsetOf(r.json.links.prev) === 0);
  r = await call('GET', l.last, { token: t.kandy });
  check('last page: next null', r.json.links.next === null && r.json.data.length > 0);
  r = await call('GET', `/installations/${inst}/readings?limit=1&sort=recorded_at:desc`, { token: t.kandy });
  check('sort descending: newest first', r.json.data[0].recorded_at > first);

  const end = new Date(Date.parse(first) + 24 * 3600e3).toISOString();
  r = await call('GET', `/installations/${inst}/readings?recorded_at_start=${first}&recorded_at_end=${end}`, { token: t.kandy });
  check('time window: 24 h inclusive = 97 readings', total(r) === 97, `total=${total(r)}`);
  r = await call('GET', `/installations/${inst}/readings?recorded_at_start=2020-01-01T00:00:00Z&recorded_at_end=2020-01-02T00:00:00Z`, { token: t.kandy });
  check('empty window: total 0, next and prev null', total(r) === 0 && r.json.links.next === null && r.json.links.prev === null);

  r = await call('GET', `/readings?installation_id=${inst}&limit=1`, { token: t.national });
  check('/readings total respects the filter', total(r) === n);
  r = await call('GET', `/readings?district_id=${KANDY.district_id}&limit=1`, { token: t.national });
  check('/readings?district_id -> that district only', r.status === 200 && r.json.data[0].district_id === KANDY.district_id);
  r = await call('GET', '/readings?district_id=1&limit=1', { token: t.kandy });
  check('a filter can only narrow jurisdiction, never widen it', r.status === 200 && total(r) === 0);

  const readingId = (await call('GET', `/installations/${inst}/readings?limit=1`, { token: t.kandy })).json.data[0].reading_id;
  r = await call('GET', `/installations/${inst}/readings/${readingId}`, { token: t.kandy });
  check('GET /installations/{id}/readings/{reading_id}', r.status === 200 && r.json.reading_id === readingId);
  r = await call('PUT', `/installations/${inst}/readings/${readingId}`, { token: t.admin, body: {} });
  check('PUT on a reading -> 405 + Allow: GET, HEAD', r.status === 405 && r.headers.get('allow') === 'GET, HEAD');
  r = await call('DELETE', `/installations/${inst}/readings/${readingId}`, { token: t.admin });
  check('DELETE on a reading -> 405', r.status === 405);
  r = await call('POST', '/readings', { token: t.admin, body: {} });
  check('POST /readings (old ingestion URI) -> 405', r.status === 405);
}

async function conditional(t, inst) {
  console.log('\nConditional requests');
  let r = await call('GET', `/installations/${inst}`, { token: t.kandy });
  const etag = r.headers.get('etag');
  const lm = r.headers.get('last-modified');
  check('single resource: ETag, Last-Modified, JSON Content-Type', !!etag && !!lm && r.headers.get('content-type').startsWith('application/json'));
  r = await call('GET', `/installations/${inst}`, { token: t.kandy, headers: { 'If-None-Match': etag } });
  check('If-None-Match -> 304 with an empty body', r.status === 304 && r.text === '');
  r = await call('GET', `/installations/${inst}`, { token: t.kandy, headers: { 'If-Modified-Since': lm } });
  check('If-Modified-Since -> 304', r.status === 304);
  r = await call('GET', '/installations/999999', { token: t.kandy, headers: { 'If-None-Match': '*' } });
  check('If-None-Match: * on a missing resource stays 404', r.status === 404);
  r = await call('GET', `/installations/${inst}/readings?limit=5`, { token: t.kandy });
  const pageTag = r.headers.get('etag');
  check('collection page: ETag and no Last-Modified', !!pageTag && !r.headers.get('last-modified'));
  r = await call('GET', `/installations/${inst}/readings?limit=5`, { token: t.kandy, headers: { 'If-None-Match': pageTag } });
  check('collection page -> 304 on a matching ETag', r.status === 304);
}

async function validation(t) {
  console.log('\nValidation, negotiation and the error contract');
  let r = await call('GET', '/installations?distrct_id=4', { token: t.kandy });
  check('unknown query parameter -> 400 naming it', r.status === 400 && code(r) === 'VALIDATION_FAILED' && r.json.error.details[0]?.field === 'distrct_id');
  r = await call('GET', '/installations?token=abc', { token: t.kandy });
  check('?token= -> 400, never read', r.status === 400);
  r = await call('GET', '/installations?limit=500', { token: t.kandy });
  check('limit above 200 -> 400, not clamped', r.status === 400);
  r = await call('GET', '/installations/abc', { token: t.kandy });
  check('non-integer id -> 400', r.status === 400);
  r = await call('GET', `/readings?sort=${encodeURIComponent('recorded_at; DROP TABLE readings--')}`, { token: t.national });
  check('SQL in the sort parameter -> 400 INVALID_SORT', r.status === 400 && code(r) === 'INVALID_SORT');
  r = await call('GET', '/readings?district_id=4%20OR%201%3D1', { token: t.national });
  check('SQL in a filter -> 400', r.status === 400);
  r = await call('POST', '/auth/login', { raw: '{"email":', headers: { 'Content-Type': 'application/json' } });
  check('malformed JSON -> 400 MALFORMED_JSON with request_id', r.status === 400 && code(r) === 'MALFORMED_JSON' && !!r.json.error.request_id);
  r = await call('POST', '/auth/login', { body: { email: 'not-an-email' } });
  check('invalid login body -> 400 with details', r.status === 400 && r.json.error.details.length > 0);
  r = await call('POST', '/auth/login', { raw: JSON.stringify({ email: 'a@b.lk', password: 'x'.repeat(20000) }), headers: { 'Content-Type': 'application/json' } });
  check('body over 16 KB -> 413 PAYLOAD_TOO_LARGE', r.status === 413 && code(r) === 'PAYLOAD_TOO_LARGE');
  r = await call('GET', '/provinces', { token: t.kandy, headers: { Accept: 'text/xml' } });
  check('Accept: text/xml -> 406', r.status === 406);
  r = await call('POST', '/auth/login', { raw: 'email=x', headers: { 'Content-Type': 'text/plain' } });
  check('non-JSON body -> 415', r.status === 415);
}

async function writePath(t, creds) {
  console.log('\nWrite path (throwaway installation)');
  const stamp = Date.now();
  const body = {
    reference: `SMOKE-${stamp}`, meter_id: `SMOKE-${stamp}`, inverter_id: 'SMOKE-INV',
    capacity_kw: 5, panel_count: 12, commissioned_on: '2026-01-15',
    address_line: '1 Smoke Test Road, Kandy', latitude: 7.29, longitude: 80.63,
    substation_id: KANDY.substation_id,
  };
  let r = await call('POST', '/installations', { token: t.admin, body });
  check('POST /installations -> 201 + Location + one-time device_secret',
    r.status === 201 && r.headers.get('location')?.endsWith(`/installations/${r.json?.installation_id}`) && !!r.json?.device_secret,
    `${r.status} ${code(r) ?? ''}`);
  if (r.status !== 201) return;
  const id = r.json.installation_id;
  const secret = r.json.device_secret;

  try {
    r = await call('POST', '/installations', { token: t.admin, body });
    check('duplicate meter_id -> 409 METER_ID_EXISTS', r.status === 409 && code(r) === 'METER_ID_EXISTS');
    r = await call('GET', `/installations/${id}`, { token: t.national });
    check('no secret or hash in a read', r.status === 200 && !/secret|hash/i.test(Object.keys(r.json).join(',')));

    const full = { reference: body.reference, capacity_kw: 6, panel_count: 15, status: 'active',
      commissioned_on: body.commissioned_on, address_line: body.address_line, latitude: 7.29, longitude: 80.63 };
    r = await call('PUT', `/installations/${id}`, { token: t.admin, body: { capacity_kw: 7 } });
    check('PUT with a partial body -> 400', r.status === 400);
    r = await call('PUT', `/installations/${id}`, { token: t.admin, body: full });
    check('PUT full replacement -> 200', r.status === 200 && r.json.capacity_kw === 6);
    r = await call('PUT', `/installations/${id}`, { token: t.admin, body: full });
    check('repeated PUT -> same state (idempotent)', r.status === 200 && r.json.capacity_kw === 6);
    r = await call('PATCH', `/installations/${id}`, { token: t.admin, body: { capacity_kw: 8 } });
    check('PATCH changes only the named field', r.status === 200 && r.json.capacity_kw === 8 && r.json.panel_count === 15);
    r = await call('PATCH', `/installations/${id}`, { token: t.admin, body: {} });
    check('PATCH with no fields -> 400', r.status === 400);

    const fresh = await call('GET', `/installations/${id}`, { token: t.admin });
    r = await call('PATCH', `/installations/${id}`, { token: t.admin, body: { capacity_kw: 99 }, headers: { 'If-Match': '"stale"' } });
    const after = await call('GET', `/installations/${id}`, { token: t.admin });
    check('stale If-Match -> 412 and the row unchanged', r.status === 412 && after.json.capacity_kw === 8);
    r = await call('PATCH', `/installations/${id}`, { token: t.admin, body: { capacity_kw: 9 }, headers: { 'If-Match': fresh.headers.get('etag') } });
    check('current If-Match -> 200', r.status === 200 && r.json.capacity_kw === 9);

    const device = await deviceLogin(body.meter_id, secret);
    check('the one-time device secret works', !!device);
    const reading = { recorded_at: '2026-09-24T06:00:00+05:30', power_kw: 1.25, energy_kwh: 10.5, voltage_v: 231.4 };
    r = await call('POST', `/installations/${id}/readings`, { token: device, body: reading });
    const location = r.headers.get('location');
    check('device posts its own reading -> 201 + Location', r.status === 201 && location?.includes(`/installations/${id}/readings/${r.json?.reading_id}`));
    check('recorded_at with +05:30 stored as UTC', r.json?.recorded_at === '2026-09-24T00:30:00.000Z');
    r = await call('POST', `/installations/${id}/readings`, { token: device, body: reading });
    check('replay -> 409 + Location of the stored reading', r.status === 409 && r.headers.get('location') === location);
    const other = creds.devices.find((d) => d.installation_id !== id).installation_id;
    r = await call('POST', `/installations/${other}/readings`, { token: device, body: { ...reading, recorded_at: '2026-09-24T06:15:00+05:30' } });
    check('device posts to another installation -> 403 INSTALLATION_MISMATCH', r.status === 403 && code(r) === 'INSTALLATION_MISMATCH');
    r = await call('POST', `/installations/${id}/readings`, { token: device, body: { ...reading, district_id: 1 } });
    check('jurisdiction field in the body -> 400', r.status === 400);
    r = await call('DELETE', `/installations/${id}`, { token: t.admin });
    check('DELETE an installation with readings -> 409', r.status === 409 && code(r) === 'INSTALLATION_HAS_READINGS');
  } finally {
    // Readings are append-only to the API user, so cleanup goes through an
    // admin database connection; then the installation is deleted via the API.
    const conn = await connect({ admin: true });
    try {
      await conn.execute('DELETE FROM readings WHERE installation_id = ?', [id]);
    } finally {
      await conn.end();
    }
    r = await call('DELETE', `/installations/${id}`, { token: t.admin });
    check('DELETE an installation without readings -> 204', r.status === 204 && r.text === '');
    r = await call('DELETE', `/installations/${id}`, { token: t.admin });
    check('repeated DELETE -> 404', r.status === 404);
  }
}

async function operational(t, inst) {
  console.log('\nOperational reads');
  const last = await call('GET', `/installations/${inst}/last-known-reading`, { token: t.kandy });
  check('last-known-reading -> 200', last.status === 200 && !!last.json.recorded_at);
  const r = await call('GET', `/installations/${inst}/overview`, { token: t.kandy });
  const e = r.json?.readings_stats?.energy_kwh;
  check('overview: lifetime energy = latest counter, no average of it', r.status === 200 && e.lifetime === last.json.energy_kwh && !('avg' in e));

  // Midday (Colombo) on the last seeded day, so the check holds after any re-seed.
  const day = new Date(Date.parse(last.json.recorded_at) + 330 * 60000).toISOString().slice(0, 10);
  const at = `${day}T12:00:00+05:30`;
  const s = await call('GET', `/districts/${KANDY.district_id}/generation-summary?at=${encodeURIComponent(at)}`, { token: t.kandy });
  const sum = s.json?.summary;
  check('summary at seeded midday: current power and energy > 0', s.status === 200 && sum.current_total_power_kw > 0 && sum.today_total_energy_kwh > 0,
    sum ? `${sum.current_total_power_kw} kW, ${sum.today_total_energy_kwh} kWh` : `${s.status}`);
  const bySum = s.json.installations.reduce((a, i) => a + i.energy_today_kwh, 0);
  check('summary total = sum of its installations', Math.abs(bySum - sum.today_total_energy_kwh) < 0.01);
  const one = s.json.installations.find((i) => i.installation_id === inst);
  const start = new Date(Date.parse(`${day}T00:00:00+05:30`)).toISOString();
  const raw = (await call('GET', `/installations/${inst}/readings?limit=200&sort=recorded_at:asc&recorded_at_start=${start}&recorded_at_end=${encodeURIComponent(at)}`, { token: t.kandy })).json.data;
  const expected = raw[raw.length - 1].energy_kwh - raw[0].energy_kwh;
  check('one installation: energy today = last − first of its raw readings', Math.abs(expected - one.energy_today_kwh) < 0.001);
  check('summary ?at=invalid -> 400', (await call('GET', `/districts/${KANDY.district_id}/generation-summary?at=yesterday`, { token: t.kandy })).status === 400);
  check('summary outside jurisdiction -> 404', (await call('GET', '/districts/1/generation-summary', { token: t.kandy })).status === 404);
}

async function security(t, inst) {
  console.log('\nSecurity');
  for (const url of ['/provinces', '/installations', `/installations/${inst}/readings`, '/readings']) {
    const r = await call('GET', url, { token: t.device });
    check(`device token on GET ${url} -> 403 WRONG_PRINCIPAL_TYPE`, r.status === 403 && code(r) === 'WRONG_PRINCIPAL_TYPE', `${r.status} ${code(r)}`);
  }
  let r = await call('POST', `/installations/${inst}/readings`, { token: t.kandy, body: { recorded_at: '2026-09-24T06:00:00+05:30', power_kw: 1, energy_kwh: 1, voltage_v: 230 } });
  check('user token on ingestion -> 403 WRONG_PRINCIPAL_TYPE', r.status === 403 && code(r) === 'WRONG_PRINCIPAL_TYPE');
  r = await call('POST', '/installations', { token: t.kandy, body: {} });
  check('district officer write -> 403 INSUFFICIENT_ROLE', r.status === 403 && code(r) === 'INSUFFICIENT_ROLE');

  r = await call('GET', '/provinces');
  check('no token -> 401 AUTHENTICATION_REQUIRED', r.status === 401 && code(r) === 'AUTHENTICATION_REQUIRED');
  const [h, p, s] = t.kandy.split('.');
  const widened = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url')), jurisdiction: { level: 'national' } })).toString('base64url');
  check('tampered payload (district -> national) -> 401', (await call('GET', '/provinces', { token: `${h}.${widened}.${s}` })).status === 401);
  const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${p}.`;
  check('alg:none token -> 401', (await call('GET', '/provinces', { token: none })).status === 401);

  const unknown = await call('POST', '/auth/login', { body: { email: 'nobody@slsea.lk', password: 'x' } });
  const wrong = await call('POST', '/auth/login', { body: { email: 'kandy.officer@slsea.lk', password: 'wrong' } });
  check('unknown email and wrong password -> identical 401',
    unknown.status === 401 && wrong.status === 401 && code(unknown) === code(wrong) && unknown.json.error.message === wrong.json.error.message);

  // Installation 1 is in Colombo (the seed assigns installations district by district).
  const a = await call('GET', '/installations/1', { token: t.kandy });
  const b = await call('GET', '/installations/999999', { token: t.kandy });
  check('another district and a missing id -> the same 404 code', a.status === 404 && b.status === 404 && code(a) === code(b));

  r = await call('GET', '/provinces', { token: t.kandy });
  const hdr = (n) => r.headers.get(n);
  check('HSTS', /max-age=\d+/.test(hdr('strict-transport-security') || ''));
  check('X-Content-Type-Options: nosniff', hdr('x-content-type-options') === 'nosniff');
  check('X-Frame-Options: DENY', hdr('x-frame-options') === 'DENY');
  check('Content-Security-Policy', !!hdr('content-security-policy'));
  check('no X-Powered-By, no CORS header', !hdr('x-powered-by') && !hdr('access-control-allow-origin'));
  check('RateLimit headers', !!hdr('ratelimit-policy'));

  if (process.env.SMOKE_FORGE === '1') {
    const forge = (payload, opts = {}) => jwt.sign(payload, process.env.JWT_SECRET,
      { issuer: 'slsea-api', audience: 'slsea-api/v1', algorithm: 'HS256', expiresIn: '5m', subject: 'user:999', ...opts });
    const base = { typ: 'user', role: 'district_officer', scope: 'installations:read readings:read summary:read' };
    for (const [label, payload] of [
      ['no jurisdiction claim', base],
      ['unknown jurisdiction level', { ...base, jurisdiction: { level: 'planet', province_id: 2, district_id: 4 } }],
      ['district level without district_id', { ...base, jurisdiction: { level: 'district', province_id: 2 } }],
      ['provincial level without province_id', { ...base, jurisdiction: { level: 'provincial' } }],
    ]) {
      r = await call('GET', '/installations?limit=1', { token: forge(payload) });
      check(`forged token, ${label} -> 401, never national`, r.status === 401 && code(r) === 'INVALID_TOKEN', `${r.status}`);
    }
    const good = { ...base, jurisdiction: { level: 'district', province_id: 2, district_id: 4 } };
    check('wrong audience -> 401', (await call('GET', '/provinces', { token: forge(good, { audience: 'other-api' }) })).status === 401);
    check('expired token -> 401', (await call('GET', '/provinces', { token: forge(good, { expiresIn: -10 }) })).status === 401);
    r = await call('POST', '/installations', { token: forge({ ...base, jurisdiction: { level: 'national' }, scope: 'installations:write' }), body: {} });
    check('non-admin holding installations:write -> 403 INSUFFICIENT_ROLE', r.status === 403 && code(r) === 'INSUFFICIENT_ROLE');
  }

  if (process.env.SMOKE_RATE === '1') {
    let last;
    for (let i = 0; i < 12; i++) {
      last = await call('POST', '/auth/login', { body: { email: 'kandy.officer@slsea.lk', password: `wrong-${i}` } });
    }
    check('repeated failed logins -> 429 RATE_LIMITED + Retry-After',
      last.status === 429 && code(last) === 'RATE_LIMITED' && Number(last.headers.get('retry-after')) > 0, `${last.status}`);
  }
}

async function main() {
  console.log(`SLSEA API smoke checks against ${BASE}`);
  const creds = loadCredentials();

  const health = await fetch(`${ORIGIN}/health`).then((r) => r.json()).catch(() => null);
  console.log(`/health: ${health ? `${health.status}, database ${health.database}, commit ${health.commit}` : 'unreachable'}`);
  if (!health) process.exit(1);

  const device = creds.devices[0];
  const t = {
    national: await login(creds, 'national.analyst@slsea.lk'),
    kandy: await login(creds, 'kandy.officer@slsea.lk'),
    admin: await login(creds, 'admin@slsea.lk'),
    device: await deviceLogin(device.meter_id, device.device_secret),
  };

  const inst = await hierarchy(t);
  await readings(t, inst);
  await conditional(t, inst);
  await validation(t);
  await operational(t, inst);
  await writePath(t, creds);
  await security(t, inst);

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    failures.forEach((f) => console.log(`  ✗ ${f}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`\nSmoke run aborted: ${err.message}`);
  process.exit(1);
});
