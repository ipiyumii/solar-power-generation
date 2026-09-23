'use strict';

const { pool } = require('../db/client');
const { scopePredicate } = require('./_scoped');

async function findAll(limit, offset, scope) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `WHERE ${where}` : '';
  const [rows] = await pool.execute(
    `SELECT
       province_id,
       name,
       code,
       capital,
       created_at,
       updated_at
     FROM provinces
     ${whereClause}
     ORDER BY province_id ASC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  return rows;
}

async function countAll(scope) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `WHERE ${where}` : '';
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) as count FROM provinces ${whereClause}`,
    params
  );
  return count;
}

async function findById(id, scope) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `AND ${where}` : '';
  const [rows] = await pool.execute(
    `SELECT
       province_id,
       name,
       code,
       capital,
       created_at,
       updated_at
     FROM provinces
     WHERE province_id = ?
     ${whereClause}`,
    [id, ...params]
  );
  return rows.length > 0 ? rows[0] : null;
}

module.exports = {
  findAll,
  countAll,
  findById,
};
