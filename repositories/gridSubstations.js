'use strict';

const { pool } = require('../db/client');
const { scopePredicate } = require('./_scoped');

async function findAll(limit, offset, scope, sort = null) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `WHERE ${where}` : '';
  let orderClause = 'ORDER BY substation_id ASC';

  if (sort) {
    orderClause = `ORDER BY ${sort.field} ${sort.direction}, substation_id ASC`;
  }

  const [rows] = await pool.execute(
    `SELECT
       substation_id,
       district_id,
       province_id,
       name,
       code,
       capacity_mva,
       voltage_level_kv,
       latitude,
       longitude,
       created_at,
       updated_at
     FROM grid_substations
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
    `SELECT COUNT(*) as count FROM grid_substations ${whereClause}`,
    params
  );
  return count;
}

async function findById(id, scope) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `AND ${where}` : '';
  const [rows] = await pool.execute(
    `SELECT
       substation_id,
       district_id,
       province_id,
       name,
       code,
       capacity_mva,
       voltage_level_kv,
       latitude,
       longitude,
       created_at,
       updated_at
     FROM grid_substations
     WHERE substation_id = ?
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
       substation_id,
       district_id,
       province_id,
       name,
       code,
       capacity_mva,
       voltage_level_kv,
       latitude,
       longitude,
       created_at,
       updated_at
     FROM grid_substations
     WHERE district_id = ?
     ${whereClause}
     ORDER BY substation_id ASC`,
    [districtId, ...params]
  );
  return rows;
}

module.exports = {
  findAll,
  countAll,
  findById,
  findByDistrictId,
};
