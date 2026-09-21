'use strict';

const { pool } = require('../db/client');

async function findAll(limit, offset) {
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
     ORDER BY substation_id ASC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows;
}

async function countAll() {
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) as count FROM grid_substations`
  );
  return count;
}

async function findById(id) {
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
     WHERE substation_id = ?`,
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
}

async function findByDistrictId(districtId) {
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
     ORDER BY substation_id ASC`,
    [districtId]
  );
  return rows;
}

module.exports = {
  findAll,
  countAll,
  findById,
  findByDistrictId,
};
