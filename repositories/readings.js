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

async function countAll(scope) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `WHERE ${where}` : '';
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) as count FROM readings ${whereClause}`,
    params
  );
  return count;
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

module.exports = {
  findAll,
  countAll,
  findById,
  create,
};
