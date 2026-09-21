'use strict';

const { pool } = require('../db/client');

async function findAll(limit, offset) {
  const [rows] = await pool.execute(
    `SELECT
       district_id,
       province_id,
       name,
       code,
       created_at,
       updated_at
     FROM districts
     ORDER BY district_id ASC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows;
}

async function countAll() {
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) as count FROM districts`
  );
  return count;
}

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT
       district_id,
       province_id,
       name,
       code,
       created_at,
       updated_at
     FROM districts
     WHERE district_id = ?`,
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
}

async function findByProvinceId(provinceId) {
  const [rows] = await pool.execute(
    `SELECT
       district_id,
       province_id,
       name,
       code,
       created_at,
       updated_at
     FROM districts
     WHERE province_id = ?
     ORDER BY district_id ASC`,
    [provinceId]
  );
  return rows;
}

module.exports = {
  findAll,
  countAll,
  findById,
  findByProvinceId,
};
