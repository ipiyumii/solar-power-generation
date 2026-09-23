'use strict';

const { pool } = require('../db/client');
const { scopePredicate } = require('./_scoped');

async function findAll(limit, offset, scope) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `WHERE ${where}` : '';
  const [rows] = await pool.execute(
    `SELECT
       district_id,
       province_id,
       name,
       code,
       created_at,
       updated_at
     FROM districts
     ${whereClause}
     ORDER BY district_id ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

async function countAll(scope) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `WHERE ${where}` : '';
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) as count FROM districts ${whereClause}`,
    params
  );
  return count;
}

async function findById(id, scope) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `AND ${where}` : '';
  const [rows] = await pool.execute(
    `SELECT
       district_id,
       province_id,
       name,
       code,
       created_at,
       updated_at
     FROM districts
     WHERE district_id = ?
     ${whereClause}`,
    [id, ...params]
  );
  return rows.length > 0 ? rows[0] : null;
}

async function findByProvinceId(provinceId, scope) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `AND ${where}` : '';
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
     ${whereClause}
     ORDER BY district_id ASC`,
    [provinceId, ...params]
  );
  return rows;
}

module.exports = {
  findAll,
  countAll,
  findById,
  findByProvinceId,
};
