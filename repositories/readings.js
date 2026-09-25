'use strict';

const { pool } = require('../db/client');
const { scopePredicate } = require('./_scoped');

function buildFilterClause(filters) {
  if (!filters) return { where: '', params: [] };

  const conditions = [];
  const params = [];

  // The as-recorded jurisdiction columns on the reading itself, each backed by
  // a (column, recorded_at) index. The caller's scope is still ANDed on, so
  // these can only narrow.
  for (const column of ['province_id', 'district_id', 'substation_id']) {
    if (filters[column]) {
      conditions.push(`${column} = ?`);
      params.push(filters[column]);
    }
  }
  if (filters.installation_id) {
    conditions.push('installation_id = ?');
    params.push(filters.installation_id);
  }
  if (filters.recorded_at_start) {
    conditions.push('recorded_at >= ?');
    params.push(filters.recorded_at_start);
  }
  if (filters.recorded_at_end) {
    conditions.push('recorded_at <= ?');
    params.push(filters.recorded_at_end);
  }

  return {
    where: conditions.length > 0 ? conditions.join(' AND ') : '',
    params,
  };
}

async function findAll(limit, offset, scope, sort = null, filters = null) {
  const { where: scopeWhere, params: scopeParams } = scopePredicate(scope);
  const { where: filterWhere, params: filterParams } = buildFilterClause(filters);

  const conditions = [];
  if (scopeWhere) conditions.push(scopeWhere);
  if (filterWhere) conditions.push(filterWhere);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  let orderClause = 'ORDER BY recorded_at DESC, reading_id DESC';

  if (sort) {
    orderClause = `ORDER BY ${sort.field} ${sort.direction}, reading_id DESC`;
  }

  const allParams = [...scopeParams, ...filterParams, limit, offset];

  const [rows] = await pool.execute(
    `SELECT
       reading_id,
       installation_id,
       recorded_at,
       ingested_at,
       power_kw,
       energy_kwh,
       voltage_v,
       substation_id,
       district_id,
       province_id
     FROM readings
     ${whereClause}
     ${orderClause}
     LIMIT ? OFFSET ?`,
    allParams
  );
  return rows;
}

// Same WHERE as findAll, so total counts what the filters actually select.
async function countAll(scope, filters = null) {
  const { where: scopeWhere, params: scopeParams } = scopePredicate(scope);
  const { where: filterWhere, params: filterParams } = buildFilterClause(filters);

  const conditions = [];
  if (scopeWhere) conditions.push(scopeWhere);
  if (filterWhere) conditions.push(filterWhere);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) as count FROM readings ${whereClause}`,
    [...scopeParams, ...filterParams]
  );
  return count;
}

// Unscoped: used only after a device's insert collided on the natural key,
// to point the 409 at the reading that already holds that slot.
async function findIdByNaturalKey(installationId, recordedAt) {
  const [rows] = await pool.execute(
    `SELECT reading_id
     FROM readings
     WHERE installation_id = ? AND recorded_at = ?`,
    [installationId, recordedAt]
  );
  return rows.length > 0 ? rows[0].reading_id : null;
}

async function findById(id, scope) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `AND ${where}` : '';
  const [rows] = await pool.execute(
    `SELECT
       reading_id,
       installation_id,
       recorded_at,
       ingested_at,
       power_kw,
       energy_kwh,
       voltage_v,
       substation_id,
       district_id,
       province_id
     FROM readings
     WHERE reading_id = ?
     ${whereClause}`,
    [id, ...params]
  );
  return rows.length > 0 ? rows[0] : null;
}

async function create(installationId, recordedAt, powerKw, energyKwh, voltageV, scope) {
  const { where: scopeWhere, params: scopeParams } = scopePredicate(scope);
  const scopeCheck = scopeWhere ? `AND ${scopeWhere}` : '';

  const [installation] = await pool.execute(
    `SELECT substation_id, district_id, province_id
     FROM installations
     WHERE installation_id = ?
     ${scopeCheck}`,
    [installationId, ...scopeParams]
  );

  if (installation.length === 0) {
    return null;
  }

  const inst = installation[0];
  const [result] = await pool.execute(
    `INSERT INTO readings (
      installation_id,
      recorded_at,
      ingested_at,
      power_kw,
      energy_kwh,
      voltage_v,
      substation_id,
      district_id,
      province_id
    ) VALUES (?, ?, NOW(), ?, ?, ?, ?, ?, ?)`,
    [
      installationId,
      recordedAt,
      powerKw,
      energyKwh,
      voltageV,
      inst.substation_id,
      inst.district_id,
      inst.province_id,
    ]
  );

  const [rows] = await pool.execute(
    `SELECT
       reading_id,
       installation_id,
       recorded_at,
       ingested_at,
       power_kw,
       energy_kwh,
       voltage_v,
       substation_id,
       district_id,
       province_id
     FROM readings
     WHERE reading_id = ?`,
    [result.insertId]
  );

  return rows.length > 0 ? rows[0] : null;
}

async function findLatestByInstallationId(installationId, scope) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `AND ${where}` : '';
  const [rows] = await pool.execute(
    `SELECT
       reading_id,
       installation_id,
       recorded_at,
       ingested_at,
       power_kw,
       energy_kwh,
       voltage_v,
       substation_id,
       district_id,
       province_id
     FROM readings
     WHERE installation_id = ?
     ${whereClause}
     ORDER BY recorded_at DESC
     LIMIT 1`,
    [installationId, ...params]
  );
  return rows.length > 0 ? rows[0] : null;
}

async function getStatisticsByInstallationId(installationId, scope) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `AND ${where}` : '';
  const [[stats]] = await pool.execute(
    `SELECT
       COUNT(*) as total_count,
       MIN(recorded_at) as date_from,
       MAX(recorded_at) as date_to,
       MIN(power_kw) as power_min,
       MAX(power_kw) as power_max,
       AVG(power_kw) as power_avg,
       MIN(energy_kwh) as energy_min,
       MAX(energy_kwh) as energy_max,
       MIN(voltage_v) as voltage_min,
       MAX(voltage_v) as voltage_max,
       AVG(voltage_v) as voltage_avg
     FROM readings
     WHERE installation_id = ?
     ${whereClause}`,
    [installationId, ...params]
  );
  return stats;
}

// Energy generated by one installation in [from, to): energy_kwh is a
// cumulative counter, so the energy is the last value minus the first, never
// a sum of the counter.
async function energyBetween(installationId, from, to, scope) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `AND ${where}` : '';
  const [[row]] = await pool.execute(
    `SELECT
       COUNT(*) AS reading_count,
       MAX(energy_kwh) - MIN(energy_kwh) AS energy_kwh
     FROM readings
     WHERE installation_id = ?
       AND recorded_at >= ? AND recorded_at < ?
       ${whereClause}`,
    [installationId, from, to, ...params]
  );
  return row;
}

// One row per installation in the district, including those with no
// readings in the window (LEFT JOIN), with the day's energy as MAX - MIN of
// the counter. One query for the whole district, not one per installation.
async function districtEnergyByInstallation(districtId, from, to) {
  const [rows] = await pool.execute(
    `SELECT
       i.installation_id,
       i.reference,
       i.status,
       i.capacity_kw,
       COUNT(r.reading_id) AS reading_count,
       MAX(r.energy_kwh) - MIN(r.energy_kwh) AS energy_kwh
     FROM installations i
     LEFT JOIN readings r
       ON r.installation_id = i.installation_id
      AND r.recorded_at >= ? AND r.recorded_at < ?
     WHERE i.district_id = ?
     GROUP BY i.installation_id, i.reference, i.status, i.capacity_kw
     ORDER BY i.installation_id`,
    [from, to, districtId]
  );
  return rows;
}

// Each installation's newest reading in (from, to]. An installation with none
// in that window is not reporting, and contributes no "current" power.
async function districtLatestReadings(districtId, from, to) {
  const [rows] = await pool.execute(
    `SELECT r.installation_id, r.power_kw, r.recorded_at
     FROM readings r
     JOIN (
       SELECT installation_id, MAX(recorded_at) AS latest
       FROM readings
       WHERE district_id = ? AND recorded_at > ? AND recorded_at <= ?
       GROUP BY installation_id
     ) newest
       ON newest.installation_id = r.installation_id
      AND newest.latest = r.recorded_at`,
    [districtId, from, to]
  );
  return rows;
}

module.exports = {
  findAll,
  countAll,
  findById,
  findIdByNaturalKey,
  create,
  findLatestByInstallationId,
  getStatisticsByInstallationId,
  energyBetween,
  districtEnergyByInstallation,
  districtLatestReadings,
};
