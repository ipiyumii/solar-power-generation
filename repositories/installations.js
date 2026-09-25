'use strict';

const { pool } = require('../db/client');
const { scopePredicate } = require('./_scoped');

function buildFilterClause(filters) {
  if (!filters) return { where: '', params: [] };

  const conditions = [];
  const params = [];

  if (filters.province_id) {
    conditions.push('province_id = ?');
    params.push(filters.province_id);
  }
  if (filters.district_id) {
    conditions.push('district_id = ?');
    params.push(filters.district_id);
  }
  if (filters.substation_id) {
    conditions.push('substation_id = ?');
    params.push(filters.substation_id);
  }
  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }

  return {
    where: conditions.length > 0 ? conditions.join(' AND ') : '',
    params,
  };
}

async function findAll(limit, offset, scope, sort = null, filters = null) {
  const { where: scopeWhere, params: scopeParams } = scopePredicate(scope);
  const { where: filterWhere, params: filterParams } = buildFilterClause(filters);

  const conditions = [];
  if (scopeWhere) conditions.push(scopeWhere);
  if (filterWhere) conditions.push(filterWhere);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  let orderClause = 'ORDER BY installation_id ASC';

  if (sort) {
    orderClause = `ORDER BY ${sort.field} ${sort.direction}, installation_id ASC`;
  }

  const allParams = [...scopeParams, ...filterParams, limit, offset];

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
    allParams
  );
  return rows;
}

// Same WHERE as findAll, so total counts what the filters actually select.
async function countAll(scope, filters = null) {
  const { where: scopeWhere, params: scopeParams } = scopePredicate(scope);
  const { where: filterWhere, params: filterParams } = buildFilterClause(filters);

  const conditions = [];
  if (scopeWhere) conditions.push(scopeWhere);
  if (filterWhere) conditions.push(filterWhere);
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const [[{ count }]] = await pool.execute(
    `SELECT COUNT(*) as count FROM installations ${whereClause}`,
    [...scopeParams, ...filterParams]
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

async function create(data, deviceSecretHash) {
  const [result] = await pool.execute(
    `INSERT INTO installations
       (reference, meter_id, inverter_id, device_secret_hash, capacity_kw, panel_count, status, commissioned_on, address_line, latitude, longitude, substation_id, district_id, province_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.reference,
      data.meter_id,
      data.inverter_id,
      deviceSecretHash,
      data.capacity_kw,
      data.panel_count,
      data.status,
      data.commissioned_on,
      data.address_line,
      data.latitude,
      data.longitude,
      data.substation_id,
      data.district_id,
      data.province_id,
    ]
  );
  return result.insertId;
}

async function update(id, scope, data) {
  const fields = [];
  const params = [];

  if (data.reference !== undefined) {
    fields.push('reference = ?');
    params.push(data.reference);
  }
  if (data.capacity_kw !== undefined) {
    fields.push('capacity_kw = ?');
    params.push(data.capacity_kw);
  }
  if (data.panel_count !== undefined) {
    fields.push('panel_count = ?');
    params.push(data.panel_count);
  }
  if (data.status !== undefined) {
    fields.push('status = ?');
    params.push(data.status);
  }
  if (data.commissioned_on !== undefined) {
    fields.push('commissioned_on = ?');
    params.push(data.commissioned_on);
  }
  if (data.address_line !== undefined) {
    fields.push('address_line = ?');
    params.push(data.address_line);
  }
  if (data.latitude !== undefined) {
    fields.push('latitude = ?');
    params.push(data.latitude);
  }
  if (data.longitude !== undefined) {
    fields.push('longitude = ?');
    params.push(data.longitude);
  }

  if (fields.length === 0) {
    return false;
  }

  const { where, params: scopeParams } = scopePredicate(scope);
  const whereClause = where ? `AND ${where}` : '';

  const [result] = await pool.execute(
    `UPDATE installations
     SET ${fields.join(', ')}
     WHERE installation_id = ?
     ${whereClause}`,
    [...params, id, ...scopeParams]
  );

  return result.affectedRows > 0;
}

async function remove(id, scope) {
  const { where, params } = scopePredicate(scope);
  const whereClause = where ? `AND ${where}` : '';
  const [result] = await pool.execute(
    `DELETE FROM installations
     WHERE installation_id = ?
     ${whereClause}`,
    [id, ...params]
  );
  return result.affectedRows > 0;
}

module.exports = {
  findAll,
  countAll,
  findById,
  findDeviceSecretByMeterId,
  create,
  update,
  remove,
};
