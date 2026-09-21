'use strict';

const { pool } = require('../db/client');

async function findAll(limit, offset) {
  const [rows] = await pool.execute(
    `SELECT
       province_id,
       name,
       code,
       capital,
       created_at,
       updated_at
     FROM provinces
     ORDER BY province_id ASC
     LIMIT ? OFFSET ?`,
    [limit, offset]
  );
  return rows;
}

async function countAll() {
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) as count FROM provinces`
  );
  return count;
}

async function findById(id) {
  const [rows] = await pool.execute(
    `SELECT
       province_id,
       name,
       code,
       capital,
       created_at,
       updated_at
     FROM provinces
     WHERE province_id = ?`,
    [id]
  );
  return rows.length > 0 ? rows[0] : null;
}

module.exports = {
  findAll,
  countAll,
  findById,
};
