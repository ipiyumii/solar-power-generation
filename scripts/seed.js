'use strict';

// Usage:
//   node scripts/seed.js --fresh [--end=2026-10-05T12:00:00Z]   wipe, seed, verify
//   node scripts/seed.js --verify                               verify only
//
// Credentials for the seeded users and devices are written to
// seed-credentials.local.json (git-ignored). Only bcrypt hashes reach the database.

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { connect } = require('./db-connect');

const BCRYPT_COST = 12;
const READINGS_PER_INSTALLATION = 672; // 7 days x 96 fifteen-minute slots
const INTERVAL_MS = 15 * 60 * 1000;
const INSTALLATION_COUNT = 220;
const BATCH_SIZE = 2000;
const COLOMBO_OFFSET_MIN = 330; // Asia/Colombo is UTC+05:30 all year
const CREDENTIALS_FILE = path.join(__dirname, '..', 'seed-credentials.local.json');

// Plausible values, reproducible between runs. Secrets use crypto, never this.
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20260924);
const between = (lo, hi) => lo + rand() * (hi - lo);
const round = (n, dp) => Number(n.toFixed(dp));

const PROVINCES = [
  { id: 1, name: 'Western', code: 'WP', capital: 'Colombo' },
  { id: 2, name: 'Central', code: 'CP', capital: 'Kandy' },
  { id: 3, name: 'Southern', code: 'SP', capital: 'Galle' },
  { id: 4, name: 'Northern', code: 'NP', capital: 'Jaffna' },
  { id: 5, name: 'Eastern', code: 'EP', capital: 'Trincomalee' },
  { id: 6, name: 'North Western', code: 'NW', capital: 'Kurunegala' },
  { id: 7, name: 'North Central', code: 'NC', capital: 'Anuradhapura' },
  { id: 8, name: 'Uva', code: 'UP', capital: 'Badulla' },
  { id: 9, name: 'Sabaragamuwa', code: 'SG', capital: 'Ratnapura' },
];

// The 25 administrative districts of Sri Lanka. weight skews installation
// counts toward the dense western and central urban areas.
const DISTRICTS = [
  { id: 1, province_id: 1, name: 'Colombo', code: 'CMB', lat: 6.927, lng: 79.861, weight: 3.0 },
  { id: 2, province_id: 1, name: 'Gampaha', code: 'GAM', lat: 7.084, lng: 80.010, weight: 2.4 },
  { id: 3, province_id: 1, name: 'Kalutara', code: 'KAL', lat: 6.585, lng: 79.961, weight: 1.5 },
  { id: 4, province_id: 2, name: 'Kandy', code: 'KAN', lat: 7.291, lng: 80.634, weight: 1.8 },
  { id: 5, province_id: 2, name: 'Matale', code: 'MTL', lat: 7.467, lng: 80.623, weight: 0.8 },
  { id: 6, province_id: 2, name: 'Nuwara Eliya', code: 'NUE', lat: 6.970, lng: 80.783, weight: 0.6 },
  { id: 7, province_id: 3, name: 'Galle', code: 'GAL', lat: 6.053, lng: 80.221, weight: 1.4 },
  { id: 8, province_id: 3, name: 'Matara', code: 'MTR', lat: 5.949, lng: 80.535, weight: 1.1 },
  { id: 9, province_id: 3, name: 'Hambantota', code: 'HMB', lat: 6.124, lng: 81.119, weight: 1.0 },
  { id: 10, province_id: 4, name: 'Jaffna', code: 'JAF', lat: 9.661, lng: 80.025, weight: 1.0 },
  { id: 11, province_id: 4, name: 'Kilinochchi', code: 'KIL', lat: 9.380, lng: 80.377, weight: 0.4 },
  { id: 12, province_id: 4, name: 'Mannar', code: 'MAN', lat: 8.977, lng: 79.904, weight: 0.4 },
  { id: 13, province_id: 4, name: 'Vavuniya', code: 'VAV', lat: 8.751, lng: 80.497, weight: 0.5 },
  { id: 14, province_id: 4, name: 'Mullaitivu', code: 'MUL', lat: 9.267, lng: 80.814, weight: 0.3 },
  { id: 15, province_id: 5, name: 'Batticaloa', code: 'BAT', lat: 7.717, lng: 81.700, weight: 0.8 },
  { id: 16, province_id: 5, name: 'Ampara', code: 'AMP', lat: 7.297, lng: 81.682, weight: 0.8 },
  { id: 17, province_id: 5, name: 'Trincomalee', code: 'TRI', lat: 8.587, lng: 81.215, weight: 0.7 },
  { id: 18, province_id: 6, name: 'Kurunegala', code: 'KUR', lat: 7.487, lng: 80.365, weight: 1.4 },
  { id: 19, province_id: 6, name: 'Puttalam', code: 'PUT', lat: 8.036, lng: 79.828, weight: 0.8 },
  { id: 20, province_id: 7, name: 'Anuradhapura', code: 'ANU', lat: 8.312, lng: 80.413, weight: 1.0 },
  { id: 21, province_id: 7, name: 'Polonnaruwa', code: 'POL', lat: 7.940, lng: 81.000, weight: 0.6 },
  { id: 22, province_id: 8, name: 'Badulla', code: 'BAD', lat: 6.989, lng: 81.055, weight: 0.7 },
  { id: 23, province_id: 8, name: 'Monaragala', code: 'MON', lat: 6.873, lng: 81.351, weight: 0.4 },
  { id: 24, province_id: 9, name: 'Ratnapura', code: 'RAT', lat: 6.683, lng: 80.399, weight: 0.8 },
  { id: 25, province_id: 9, name: 'Kegalle', code: 'KEG', lat: 7.251, lng: 80.346, weight: 0.8 },
];

const READ_SCOPES = ['installations:read', 'readings:read', 'summary:read'];

const USERS = [
  { email: 'national.analyst@slsea.lk', full_name: 'National Analyst', role: 'national_analyst', level: 'national', province_id: null, district_id: null, scopes: READ_SCOPES },
  { email: 'central.officer@slsea.lk', full_name: 'Central Provincial Officer', role: 'provincial_officer', level: 'provincial', province_id: 2, district_id: null, scopes: READ_SCOPES },
  { email: 'kandy.officer@slsea.lk', full_name: 'Kandy District Officer', role: 'district_officer', level: 'district', province_id: 2, district_id: 4, scopes: READ_SCOPES },
  { email: 'colombo.officer@slsea.lk', full_name: 'Colombo District Officer', role: 'district_officer', level: 'district', province_id: 1, district_id: 1, scopes: READ_SCOPES },
  { email: 'admin@slsea.lk', full_name: 'SLSEA Administrator', role: 'admin', level: 'national', province_id: null, district_id: null, scopes: [...READ_SCOPES, 'installations:write'] },
];

const newSecret = () => crypto.randomBytes(24).toString('base64url');

// Exactly `total` items split by weight, at least one each; the remainder goes
// to the largest fractional parts so the sum is exact rather than rounded.
function apportion(weights, total) {
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => Math.max(1, (w / sum) * total));
  const counts = raw.map(Math.floor);
  let remainder = total - counts.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (let k = 0; remainder > 0; k = (k + 1) % order.length, remainder--) counts[order[k][1]]++;
  return counts;
}

// Half-sine between 06:00 and 18:15 Colombo time, zero overnight.
function clearSkyFraction(localMinute) {
  const sunrise = 6 * 60;
  const sunset = 18 * 60 + 15;
  if (localMinute <= sunrise || localMinute >= sunset) return 0;
  return Math.sin(((localMinute - sunrise) / (sunset - sunrise)) * Math.PI);
}

function buildHierarchy() {
  const substations = DISTRICTS.map((d) => ({
    substation_id: d.id,
    district_id: d.id,
    province_id: d.province_id,
    name: `${d.name} Grid Substation`,
    code: `GSS-${d.code}`,
    capacity_mva: round(31.5 * Math.ceil(between(1, 4)), 2),
    voltage_level_kv: d.weight >= 1.4 ? 220 : 132,
    latitude: round(d.lat + between(-0.03, 0.03), 6),
    longitude: round(d.lng + between(-0.03, 0.03), 6),
  }));

  const perSubstation = apportion(DISTRICTS.map((d) => d.weight), INSTALLATION_COUNT);
  const installations = [];
  substations.forEach((s, i) => {
    for (let k = 0; k < perSubstation[i]; k++) {
      const id = installations.length + 1;
      const tag = String(id).padStart(6, '0');
      const commissioned = new Date(Date.UTC(2021, 0, 1) + rand() * (Date.UTC(2026, 3, 1) - Date.UTC(2021, 0, 1)));
      installations.push({
        installation_id: id,
        reference: `SLSEA-INST-${tag}`,
        meter_id: `MTR-${tag}`,
        inverter_id: `INV-${DISTRICTS[i].code}-${tag}`,
        capacity_kw: round(between(3, 40), 2),
        panel_count: 0,
        status: 'active',
        commissioned_on: commissioned.toISOString().slice(0, 10),
        address_line: `${10 + Math.floor(rand() * 300)} ${['Temple', 'Lake', 'Station', 'Hospital', 'School'][Math.floor(rand() * 5)]} Road, ${DISTRICTS[i].name}`,
        latitude: round(s.latitude + between(-0.08, 0.08), 6),
        longitude: round(s.longitude + between(-0.08, 0.08), 6),
        substation_id: s.substation_id,
        district_id: s.district_id,
        province_id: s.province_id,
      });
    }
  });
  // ~400 W panels
  for (const inst of installations) inst.panel_count = Math.max(1, Math.round((inst.capacity_kw * 1000) / 400));

  return { substations, installations };
}

// The window ends at the last 15-minute boundary before `end`, so the newest
// reading is "now" when seeded and last-known-reading is genuinely recent.
function* readingsFor(inst, end) {
  const last = Math.floor(end.getTime() / INTERVAL_MS) * INTERVAL_MS;
  const first = last - (READINGS_PER_INSTALLATION - 1) * INTERVAL_MS;

  const daysInService = Math.max(0, (first - Date.parse(inst.commissioned_on)) / 86400000);
  let energy = inst.capacity_kw * 4.1 * daysInService * between(0.75, 0.95);

  const weatherByDay = new Map();
  for (let t = first; t <= last; t += INTERVAL_MS) {
    const localMs = t + COLOMBO_OFFSET_MIN * 60000;
    const localDay = Math.floor(localMs / 86400000);
    const localMinute = Math.floor((localMs % 86400000) / 60000);
    if (!weatherByDay.has(localDay)) weatherByDay.set(localDay, between(0.55, 1.0));

    const power = inst.capacity_kw * clearSkyFraction(localMinute) * weatherByDay.get(localDay) * between(0.88, 1.0);
    energy += power * 0.25;

    yield [
      inst.installation_id,
      new Date(t),
      round(power, 3),
      round(energy, 3), // rounding the running total keeps it non-decreasing
      round(between(226, 238), 2),
      inst.substation_id,
      inst.district_id,
      inst.province_id,
    ];
  }
}

async function wipe(conn) {
  // Children first; RESTRICT foreign keys refuse any other order.
  for (const table of ['readings', 'users', 'installations', 'grid_substations', 'districts', 'provinces']) {
    const [res] = await conn.query(`DELETE FROM ${table}`);
    console.log(`  cleared ${table} (${res.affectedRows})`);
  }
}

async function seed(conn, end) {
  const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM provinces');
  if (n > 0) {
    console.error('Database already holds data. Re-run with --fresh to replace it.');
    process.exit(1);
  }

  const { substations, installations } = buildHierarchy();

  console.log(`Hashing ${installations.length + USERS.length} credentials at bcrypt cost ${BCRYPT_COST}...`);
  const devices = await Promise.all(installations.map(async (inst) => {
    const secret = newSecret();
    return { inst, secret, hash: await bcrypt.hash(secret, BCRYPT_COST) };
  }));
  const users = await Promise.all(USERS.map(async (u) => {
    const password = newSecret();
    return { u, password, hash: await bcrypt.hash(password, BCRYPT_COST) };
  }));

  await conn.query('INSERT INTO provinces (province_id, name, code, capital) VALUES ?',
    [PROVINCES.map((p) => [p.id, p.name, p.code, p.capital])]);
  await conn.query('INSERT INTO districts (district_id, province_id, name, code) VALUES ?',
    [DISTRICTS.map((d) => [d.id, d.province_id, d.name, d.code])]);
  await conn.query(
    `INSERT INTO grid_substations
       (substation_id, district_id, province_id, name, code, capacity_mva, voltage_level_kv, latitude, longitude)
     VALUES ?`,
    [substations.map((s) => [s.substation_id, s.district_id, s.province_id, s.name, s.code,
      s.capacity_mva, s.voltage_level_kv, s.latitude, s.longitude])]
  );
  await conn.query(
    `INSERT INTO installations
       (installation_id, reference, meter_id, inverter_id, device_secret_hash, capacity_kw, panel_count,
        status, commissioned_on, address_line, latitude, longitude, substation_id, district_id, province_id)
     VALUES ?`,
    [devices.map(({ inst: i, hash }) => [i.installation_id, i.reference, i.meter_id, i.inverter_id, hash,
      i.capacity_kw, i.panel_count, i.status, i.commissioned_on, i.address_line, i.latitude, i.longitude,
      i.substation_id, i.district_id, i.province_id])]
  );
  await conn.query(
    `INSERT INTO users
       (email, password_hash, full_name, role, jurisdiction_level, province_id, district_id, scopes)
     VALUES ?`,
    [users.map(({ u, hash }) => [u.email, hash, u.full_name, u.role, u.level, u.province_id, u.district_id,
      JSON.stringify(u.scopes)])]
  );
  console.log(`  ${PROVINCES.length} provinces, ${DISTRICTS.length} districts, ${substations.length} substations, ${installations.length} installations, ${users.length} users`);

  console.log(`Inserting ${installations.length * READINGS_PER_INSTALLATION} readings ending ${end.toISOString()}...`);
  let batch = [];
  let inserted = 0;
  const flush = async () => {
    await conn.query(
      `INSERT INTO readings
         (installation_id, recorded_at, power_kw, energy_kwh, voltage_v, substation_id, district_id, province_id)
       VALUES ?`,
      [batch]
    );
    inserted += batch.length;
    batch = [];
    process.stdout.write(`\r  ${inserted}`);
  };
  for (const inst of installations) {
    for (const row of readingsFor(inst, end)) {
      batch.push(row);
      if (batch.length >= BATCH_SIZE) await flush();
    }
  }
  if (batch.length) await flush();
  process.stdout.write('\n');

  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify({
    generated_at: new Date().toISOString(),
    database: process.env.DB_HOST,
    users: users.map(({ u, password }) => ({ email: u.email, password, role: u.role, jurisdiction: u.level })),
    devices: devices.map(({ inst, secret }) => ({ installation_id: inst.installation_id, meter_id: inst.meter_id, device_secret: secret })),
  }, null, 2));
  console.log(`Credentials written to ${path.basename(CREDENTIALS_FILE)} (git-ignored).`);
}

const CHECKS = [
  ['provinces', 'SELECT COUNT(*) FROM provinces', (v) => v === 9],
  ['districts', 'SELECT COUNT(*) FROM districts', (v) => v === 25],
  ['grid substations', 'SELECT COUNT(*) FROM grid_substations', (v) => v >= 20],
  ['installations', 'SELECT COUNT(*) FROM installations', (v) => v >= 200],
  ['users', 'SELECT COUNT(*) FROM users', (v) => v >= 1],
  ['readings', 'SELECT COUNT(*) FROM readings', (v) => v > 0],
  ['min readings per installation (>= 1 week)',
    'SELECT COALESCE(MIN(c), 0) FROM (SELECT COUNT(*) c FROM installations i LEFT JOIN readings r USING (installation_id) GROUP BY i.installation_id) x',
    (v) => v >= READINGS_PER_INSTALLATION],
  ['substations whose province is not their district\'s',
    'SELECT COUNT(*) FROM grid_substations s JOIN districts d USING (district_id) WHERE s.province_id <> d.province_id', (v) => v === 0],
  ['installations whose district/province is not their substation\'s',
    'SELECT COUNT(*) FROM installations i JOIN grid_substations s USING (substation_id) WHERE i.district_id <> s.district_id OR i.province_id <> s.province_id', (v) => v === 0],
  ['readings whose jurisdiction is not their installation\'s',
    'SELECT COUNT(*) FROM readings r JOIN installations i USING (installation_id) WHERE r.substation_id <> i.substation_id OR r.district_id <> i.district_id OR r.province_id <> i.province_id', (v) => v === 0],
  ['duplicate (installation_id, recorded_at)',
    'SELECT COUNT(*) FROM (SELECT 1 FROM readings GROUP BY installation_id, recorded_at HAVING COUNT(*) > 1) x', (v) => v === 0],
  ['non-monotonic energy_kwh steps',
    'SELECT COUNT(*) FROM (SELECT energy_kwh < LAG(energy_kwh) OVER (PARTITION BY installation_id ORDER BY recorded_at) AS back FROM readings) x WHERE back = 1', (v) => v === 0],
  ['non-zero power between 19:00 and 05:00 Colombo',
    "SELECT COUNT(*) FROM readings WHERE power_kw > 0 AND (HOUR(CONVERT_TZ(recorded_at, '+00:00', '+05:30')) >= 19 OR HOUR(CONVERT_TZ(recorded_at, '+00:00', '+05:30')) < 5)", (v) => v === 0],
  ['device secrets not stored as bcrypt',
    "SELECT COUNT(*) FROM installations WHERE device_secret_hash NOT LIKE '$2_$%'", (v) => v === 0],
  ['passwords not stored as bcrypt',
    "SELECT COUNT(*) FROM users WHERE password_hash NOT LIKE '$2_$%'", (v) => v === 0],
  ['users whose jurisdiction ids do not match their level',
    `SELECT COUNT(*) FROM users u LEFT JOIN districts d ON d.district_id = u.district_id WHERE
       (u.jurisdiction_level = 'national'   AND (u.province_id IS NOT NULL OR u.district_id IS NOT NULL)) OR
       (u.jurisdiction_level = 'provincial' AND (u.province_id IS NULL OR u.district_id IS NOT NULL)) OR
       (u.jurisdiction_level = 'district'   AND (d.district_id IS NULL OR d.province_id <> u.province_id))`, (v) => v === 0],
];

async function verify(conn) {
  console.log('\nVerification');
  let failed = 0;
  for (const [label, sql, ok] of CHECKS) {
    const [[row]] = await conn.query({ sql, rowsAsArray: true });
    const value = Number(row[0]);
    const pass = ok(value);
    if (!pass) failed++;
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label.padEnd(66)} ${value}`);
  }
  const [[range]] = await conn.query('SELECT MIN(recorded_at) AS first, MAX(recorded_at) AS last FROM readings');
  console.log(`  readings span ${range.first?.toISOString()} .. ${range.last?.toISOString()}`);
  console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
  return failed === 0;
}

async function main() {
  const args = process.argv.slice(2);
  const endArg = args.find((a) => a.startsWith('--end='));
  const end = endArg ? new Date(endArg.slice(6)) : new Date();
  if (Number.isNaN(end.getTime())) throw new Error('--end must be an ISO 8601 timestamp');

  const conn = await connect();
  try {
    if (!args.includes('--verify')) {
      if (args.includes('--fresh')) {
        console.log(`Clearing ${process.env.DB_HOST}/${process.env.DB_NAME}`);
        await wipe(conn);
      }
      await seed(conn, end);
    }
    if (!(await verify(conn))) process.exitCode = 1;
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(`Seed failed: ${err.message}`);
  process.exit(1);
});
