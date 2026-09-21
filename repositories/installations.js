'use strict';

const { pool } = require('../db/client');

async function findAll(limit, offset) {
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
     ORDER BY installation_id ASC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows;
}

async function countAll() {
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) as count FROM installations`
  );
  return count;
}

async function findById(id) {
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
     WHERE installation_id = ?`,
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
}

async function findByDistrictId(districtId) {
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
     ORDER BY installation_id ASC`,
    [districtId]
  );
  return rows;
}

async function findBySubstationId(substationId) {
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
     ORDER BY installation_id ASC`,
    [substationId]
  );
  return rows;
}

module.exports = {
  findAll,
  countAll,
  findById,
  findByDistrictId,
  findBySubstationId,
};
