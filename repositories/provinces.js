'use strict';

const { pool } = require('../db/client');
const { scopePredicate, whereClause } = require('./_scoped');

const COLUMNS = `province_id, name, code, capital, created_at, updated_at`;

// provinces has no district_id column.
const scoped = (scope) => scopePredicate(scope, { hasDistrictColumn: false });

async function findAll(limit, offset, scope, sort = null) {
  const where = whereClause(scoped(scope));
  const orderClause = sort
    ? `ORDER BY ${sort.field} ${sort.direction}, province_id ASC`
    : 'ORDER BY province_id ASC';

  const [rows] = await pool.execute(
    `SELECT ${COLUMNS}
     FROM provinces
     ${where.sql}
     ${orderClause}
     LIMIT ? OFFSET ?`,
    [...where.params, limit, offset]
  );
  return rows;
}

async function countAll(scope) {
  const where = whereClause(scoped(scope));
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) AS count FROM provinces ${where.sql}`,
    where.params
  );
  return count;
}

async function findById(id, scope) {
  const where = whereClause({ where: 'province_id = ?', params: [id] }, scoped(scope));
  const [rows] = await pool.execute(
    `SELECT ${COLUMNS}
     FROM provinces
     ${where.sql}`,
    where.params
  );
  return rows.length > 0 ? rows[0] : null;
}

module.exports = {
  findAll,
  countAll,
  findById,
};
