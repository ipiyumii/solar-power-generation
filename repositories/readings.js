'use strict';

const { pool } = require('../db/client');
const { scopePredicate } = require('./_scoped');

function buildFilterClause(filters) {
  if (!filters) return { where: '', params: [] };

  const conditions = [];
  const params = [];

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
       AVG(energy_kwh) as energy_avg,
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

async function getEnergyGenerationStats(installationId, date, scope) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `AND ${where}` : '';
  const [[stats]] = await pool.execute(
    `SELECT
       COUNT(*) as reading_count,
       MIN(energy_kwh) as energy_min,
       MAX(energy_kwh) as energy_max,
       MIN(recorded_at) as first_reading_time,
       MAX(recorded_at) as last_reading_time
     FROM readings
     WHERE installation_id = ?
     AND DATE(recorded_at) = ?
     ${whereClause}`,
    [installationId, date, ...params]
  );
  return stats;
}

module.exports = {
  findAll,
  countAll,
  findById,
  findIdByNaturalKey,
  create,
  findLatestByInstallationId,
  getStatisticsByInstallationId,
  getEnergyGenerationStats,
};
