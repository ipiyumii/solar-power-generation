'use strict';

const { pool } = require('../db/client');
const { scopePredicate } = require('./_scoped');

async function findAll(limit, offset, scope, sort = null) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `WHERE ${where}` : '';
  let orderClause = 'ORDER BY installation_id ASC';

  if (sort) {
    orderClause = `ORDER BY ${sort.field} ${sort.direction}, installation_id ASC`;
  }

  const [rows] = await pool.execute(
    `SELECT
       installation_id,
       reference,
       meter_id,
       inverter_id,
       capacity_kw,
       panel_count,
       status,
       commissioned_on,
       address_line,
       latitude,
       longitude,
       substation_id,
       district_id,
       province_id,
       created_at,
       updated_at
     FROM installations
     ${whereClause}
     ${orderClause}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

async function countAll(scope) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `WHERE ${where}` : '';
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) as count FROM installations ${whereClause}`,
    params
  );
  return count;
}

async function findById(id, scope) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `AND ${where}` : '';
  const [rows] = await pool.execute(
    `SELECT
       installation_id,
       reference,
       meter_id,
       inverter_id,
       capacity_kw,
       panel_count,
       status,
       commissioned_on,
       address_line,
       latitude,
       longitude,
       substation_id,
       district_id,
       province_id,
       created_at,
       updated_at
     FROM installations
     WHERE installation_id = ?
     ${whereClause}`,
    [id, ...params]
  );
  return rows.length > 0 ? rows[0] : null;
}

async function findByDistrictId(districtId, scope) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `AND ${where}` : '';
  const [rows] = await pool.execute(
    `SELECT
       installation_id,
       reference,
       meter_id,
       inverter_id,
       capacity_kw,
       panel_count,
       status,
       commissioned_on,
       address_line,
       latitude,
       longitude,
       substation_id,
       district_id,
       province_id,
       created_at,
       updated_at
     FROM installations
     WHERE district_id = ?
     ${whereClause}
     ORDER BY installation_id ASC`,
    [districtId, ...params]
  );
  return rows;
}

async function findBySubstationId(substationId, scope) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `AND ${where}` : '';
  const [rows] = await pool.execute(
    `SELECT
       installation_id,
       reference,
       meter_id,
       inverter_id,
       capacity_kw,
       panel_count,
       status,
       commissioned_on,
       address_line,
       latitude,
       longitude,
       substation_id,
       district_id,
       province_id,
       created_at,
       updated_at
     FROM installations
     WHERE substation_id = ?
     ${whereClause}
     ORDER BY installation_id ASC`,
    [substationId, ...params]
  );
  return rows;
}

// Internal lookup for device authentication: includes device_secret_hash for verification.
// Never expose this method's result through an API response.
async function findDeviceSecretByMeterId(meterId) {
  const [rows] = await pool.execute(
    `SELECT
       installation_id,
       meter_id,
       device_secret_hash,
       status
     FROM installations
     WHERE meter_id = ?
     LIMIT 1`,
    [meterId]
  );
  return rows.length > 0 ? rows[0] : null;
}

module.exports = {
  findAll,
  countAll,
  findById,
  findByDistrictId,
  findBySubstationId,
  findDeviceSecretByMeterId,
};
