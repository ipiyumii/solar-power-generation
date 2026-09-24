'use strict';

const { pool } = require('../db/client');
const { scopePredicate, equalityFilters, whereClause } = require('./_scoped');

const COLUMNS = `district_id, province_id, name, code, created_at, updated_at`;
const FILTERABLE = ['province_id'];

async function findAll(limit, offset, scope, sort = null, filters = null) {
  const where = whereClause(equalityFilters(filters, FILTERABLE), scopePredicate(scope));
  const orderClause = sort
    ? `ORDER BY ${sort.field} ${sort.direction}, district_id ASC`
    : 'ORDER BY district_id ASC';

  const [rows] = await pool.execute(
    `SELECT ${COLUMNS}
     FROM districts
     ${where.sql}
     ${orderClause}
     LIMIT ? OFFSET ?`,
    [...where.params, limit, offset]
  );
  return rows;
}

async function countAll(scope, filters = null) {
  const where = whereClause(equalityFilters(filters, FILTERABLE), scopePredicate(scope));
  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) AS count FROM districts ${where.sql}`,
    where.params
  );
  return count;
}

async function findById(id, scope) {
  const where = whereClause({ where: 'district_id = ?', params: [id] }, scopePredicate(scope));
  const [rows] = await pool.execute(
    `SELECT ${COLUMNS}
     FROM districts
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
