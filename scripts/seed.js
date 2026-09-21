'use strict';

require('dotenv').config();
const mysql = require('mysql2/promise');
const crypto = require('node:crypto');

const BATCH_SIZE = 1000;

// Sri Lankan provinces: 9 provinces, 25 districts
const PROVINCES = [
  { id: 1, name: 'Western', code: 'WE', capital: 'Colombo' },
  { id: 2, name: 'Central', code: 'CE', capital: 'Kandy' },
  { id: 3, name: 'Southern', code: 'SO', capital: 'Matara' },
  { id: 4, name: 'Northern', code: 'NO', capital: 'Jaffna' },
  { id: 5, name: 'North Western', code: 'NW', capital: 'Kurunegala' },
  { id: 6, name: 'North Central', code: 'NC', capital: 'Anuradhapura' },
  { id: 7, name: 'Uva', code: 'UV', capital: 'Badulla' },
  { id: 8, name: 'Sabaragamuwa', code: 'SA', capital: 'Ratnapura' },
  { id: 9, name: 'Eastern', code: 'EA', capital: 'Trincomalee' },
];

const DISTRICTS = [
  // Western (3)
  { id: 1, province_id: 1, name: 'Colombo', code: 'CMB' },
  { id: 2, province_id: 1, name: 'Gampaha', code: 'GAM' },
  { id: 3, province_id: 1, name: 'Kalutara', code: 'KAL' },
  // Central (3)
  { id: 4, province_id: 2, name: 'Kandy', code: 'KAN' },
  { id: 5, province_id: 2, name: 'Matara', code: 'MAT' },
  { id: 6, province_id: 2, name: 'Nuwara Eliya', code: 'NUW' },
  // Southern (2)
  { id: 7, province_id: 3, name: 'Galle', code: 'GAL' },
  { id: 8, province_id: 3, name: 'Hambantota', code: 'HAM' },
  // Northern (2)
  { id: 9, province_id: 4, name: 'Jaffna', code: 'JAF' },
  { id: 10, province_id: 4, name: 'Mullaitivu', code: 'MUL' },
  // North Western (2)
  { id: 11, province_id: 5, name: 'Kurunegala', code: 'KUR' },
  { id: 12, province_id: 5, name: 'Puttalam', code: 'PUT' },
  // North Central (2)
  { id: 13, province_id: 6, name: 'Anuradhapura', code: 'ANU' },
  { id: 14, province_id: 6, name: 'Polonnaruwa', code: 'POL' },
  // Uva (2)
  { id: 15, province_id: 7, name: 'Badulla', code: 'BAD' },
  { id: 16, province_id: 7, name: 'Moneragala', code: 'MON' },
  // Sabaragamuwa (2)
  { id: 17, province_id: 8, name: 'Kegalle', code: 'KEG' },
  { id: 18, province_id: 8, name: 'Ratnapura', code: 'RAT' },
  // Eastern (4)
  { id: 19, province_id: 9, name: 'Ampara', code: 'AMP' },
  { id: 20, province_id: 9, name: 'Batticaloa', code: 'BAT' },
  { id: 21, province_id: 9, name: 'Trincomalee', code: 'TRI' },
  { id: 22, province_id: 9, name: 'Mannar', code: 'MAN' },
  // Fill to 25
  { id: 23, province_id: 5, name: 'Chilaw', code: 'CHI' },
  { id: 24, province_id: 6, name: 'Dambulla', code: 'DAM' },
  { id: 25, province_id: 2, name: 'Peradeniya', code: 'PER' },
];

// Helper: hash device secret with bcrypt-like output
function hashSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex').slice(0, 60);
}

// Helper: half-sine power curve (0 at 6am, peak at 12pm, back to 0 at 6:20pm)
function powerAtTime(hour, minute, capacityKw, weatherFactor) {
  const totalMinutes = hour * 60 + minute;
  const startMinutes = 6 * 60; // 06:00
  const endMinutes = 18 * 60 + 20; // 18:20

  if (totalMinutes < startMinutes || totalMinutes > endMinutes) {
    return 0;
  }

  // Half-sine from 0 to 1 over the period
  const progress = (totalMinutes - startMinutes) / (endMinutes - startMinutes);
  const sineValue = Math.sin(progress * Math.PI);

  return capacityKw * sineValue * weatherFactor;
}

async function seed() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: +process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: process.env.NODE_ENV === 'production' ? 'Amazon RDS' : undefined,
  });

  try {
    console.log('Starting seed...');

    // 1. Insert provinces
    console.log('Inserting 9 provinces...');
    for (const p of PROVINCES) {
      await conn.execute(
        'INSERT IGNORE INTO provinces (province_id, name, code, capital) VALUES (?, ?, ?, ?)',
        [p.id, p.name, p.code, p.capital]
      );
    }

    // 2. Insert districts
    console.log('Inserting 25 districts...');
    for (const d of DISTRICTS) {
      await conn.execute(
        'INSERT IGNORE INTO districts (district_id, province_id, name, code) VALUES (?, ?, ?, ?)',
        [d.id, d.province_id, d.name, d.code]
      );
    }

    // 3. Create 25 substations (roughly 1-3 per district, uneven distribution)
    console.log('Inserting 25 substations...');
    const substations = [];
    let substationId = 1;
    const substationCountByDistrict = {
      1: 3, 2: 2, 3: 1, 4: 2, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1,
      11: 2, 12: 1, 13: 2, 14: 1, 15: 1, 16: 1, 17: 1, 18: 1, 19: 1, 20: 1,
      21: 1, 22: 1, 23: 1, 24: 1, 25: 1,
    };

    for (const district of DISTRICTS) {
      const count = substationCountByDistrict[district.id] || 1;
      for (let i = 0; i < count; i++) {
        const substation = {
          substation_id: substationId++,
          district_id: district.id,
          province_id: district.province_id,
          name: `${district.name} Substation ${i + 1}`,
          code: `SS-${String(substationId).padStart(3, '0')}`,
          capacity_mva: 50 + Math.random() * 150,
          voltage_level_kv: 33 + Math.random() * 133,
          latitude: 6.5 + Math.random() * 3.5,
          longitude: 80.5 + Math.random() * 2.5,
        };

        await conn.execute(
          `INSERT INTO grid_substations
           (substation_id, district_id, province_id, name, code, capacity_mva, voltage_level_kv, latitude, longitude)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            substation.substation_id,
            substation.district_id,
            substation.province_id,
            substation.name,
            substation.code,
            substation.capacity_mva,
            substation.voltage_level_kv,
            substation.latitude,
            substation.longitude,
          ]
        );

        substations.push(substation);
      }
    }

    // 4. Create 220 installations unevenly distributed
    console.log('Inserting 220 installations...');
    const installations = [];
    let installationId = 1;
    const installationCountBySubstation = {};

    // Uneven distribution: some substations get more
    for (const s of substations) {
      installationCountBySubstation[s.substation_id] = Math.floor(220 / substations.length) + Math.random() * 2;
    }

    // Normalize to exactly 220
    const counts = Object.values(installationCountBySubstation);
    const sum = counts.reduce((a, b) => a + b, 0);
    const scale = 220 / sum;
    for (const key in installationCountBySubstation) {
      installationCountBySubstation[key] = Math.round(installationCountBySubstation[key] * scale);
    }

    for (const substation of substations) {
      const count = installationCountBySubstation[substation.substation_id] || 1;
      for (let i = 0; i < count; i++) {
        const installation = {
          installation_id: installationId++,
          reference: `INST-${String(installationId).padStart(6, '0')}`,
          meter_id: `MTR-${String(installationId).padStart(6, '0')}`,
          inverter_id: `INV-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
          device_secret_hash: hashSecret(`secret-${installationId}`),
          capacity_kw: 5 + Math.random() * 50,
          panel_count: 10 + Math.floor(Math.random() * 100),
          status: 'active',
          commissioned_on: new Date(2024, Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28)),
          address_line: `Installation ${installationId}, ${substation.name}`,
          latitude: substation.latitude + (Math.random() - 0.5) * 0.1,
          longitude: substation.longitude + (Math.random() - 0.5) * 0.1,
          substation_id: substation.substation_id,
          district_id: substation.district_id,
          province_id: substation.province_id,
        };

        await conn.execute(
          `INSERT INTO installations
           (reference, meter_id, inverter_id, device_secret_hash, capacity_kw, panel_count,
            status, commissioned_on, address_line, latitude, longitude,
            substation_id, district_id, province_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            installation.reference,
            installation.meter_id,
            installation.inverter_id,
            installation.device_secret_hash,
            installation.capacity_kw,
            installation.panel_count,
            installation.status,
            installation.commissioned_on,
            installation.address_line,
            installation.latitude,
            installation.longitude,
            installation.substation_id,
            installation.district_id,
            installation.province_id,
          ]
        );

        installations.push(installation);
      }
    }

    // 5. Generate readings: 672 per installation over 7 days, 15-min intervals
    console.log(`Inserting readings for ${installations.length} installations (672 each = ${installations.length * 672} total)...`);
    const baseDate = new Date('2026-09-13T00:00:00Z');
    let readingsBatch = [];

    for (const installation of installations) {
      const weatherFactors = {};
      // Generate a weather factor (0.7 to 1.0) for each day
      for (let day = 0; day < 7; day++) {
        weatherFactors[day] = 0.7 + Math.random() * 0.3;
      }

      let cumulativeEnergy = 0;

      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          for (let quarter = 0; quarter < 4; quarter++) {
            const minute = quarter * 15;
            const timestamp = new Date(baseDate);
            timestamp.setDate(timestamp.getDate() + day);
            timestamp.setHours(hour, minute, 0, 0);

            const power = powerAtTime(hour, minute, installation.capacity_kw, weatherFactors[day]);
            // Energy increment: power in kW × 15 minutes / 60 minutes
            const energyIncrement = (power * 15) / 60;
            cumulativeEnergy += energyIncrement;

            const voltage = 220 + Math.random() * 20; // ±10V around 230V nominal

            readingsBatch.push([
              installation.installation_id,
              timestamp.toISOString().slice(0, 23),
              power,
              cumulativeEnergy,
              voltage,
              installation.substation_id,
              installation.district_id,
              installation.province_id,
            ]);

            if (readingsBatch.length >= BATCH_SIZE) {
              await insertReadingsBatch(conn, readingsBatch);
              readingsBatch = [];
            }
          }
        }
      }
    }

    // Insert remaining batch
    if (readingsBatch.length > 0) {
      await insertReadingsBatch(conn, readingsBatch);
    }

    console.log('✓ Seed complete');
    console.log(`  - 9 provinces`);
    console.log(`  - 25 districts`);
    console.log(`  - 25 substations`);
    console.log(`  - ${installations.length} installations`);
    console.log(`  - ${installations.length * 672} readings`);
  } finally {
    await conn.end();
  }
}

async function insertReadingsBatch(conn, batch) {
  if (batch.length === 0) return;

  const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(',');
  const values = batch.flat();

  await conn.execute(
    `INSERT INTO readings
     (installation_id, recorded_at, power_kw, energy_kwh, voltage_v, substation_id, district_id, province_id)
     VALUES ${placeholders}`,
    values
  );

  console.log(`  inserted ${batch.length} readings`);
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
