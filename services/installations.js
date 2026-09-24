'use strict';

const crypto = require('node:crypto');
const { hash } = require('bcrypt');
const ApiError = require('../utils/ApiError');
const { checkIfMatch } = require('../utils/etag');
const { parseSort } = require('../utils/sortParser');
const { parseFilters } = require('../utils/filterParser');
const installationsRepo = require('../repositories/installations');
const gridSubstationsRepo = require('../repositories/gridSubstations');
const readingsRepo = require('../repositories/readings');
const provincesRepo = require('../repositories/provinces');
const districtsRepo = require('../repositories/districts');

const BCRYPT_COST = 12;

const definedOnly = (obj) =>
  obj ? Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) : null;

async function listInstallations(limit, offset, scope, sortParam = null, rawFilters = null) {
  let sort = null;
  let filters = null;
  const filterParams = definedOnly(rawFilters);

  if (sortParam) {
    try {
      sort = parseSort(sortParam, 'installations');
    } catch (err) {
      throw ApiError.badRequest('INVALID_SORT', err.message);
    }
  }

  if (filterParams && Object.keys(filterParams).length > 0) {
    try {
      filters = parseFilters(filterParams, 'installations');
    } catch (err) {
      throw ApiError.badRequest('INVALID_FILTER', err.message);
    }
  }

  const [installations, total] = await Promise.all([
    installationsRepo.findAll(limit, offset, scope, sort, filters),
    installationsRepo.countAll(scope, filters),
  ]);

  return {
    data: installations,
    total,
    limit,
    offset,
    sort: sortParam || undefined,
    filters: filterParams && Object.keys(filterParams).length > 0 ? filterParams : undefined,
  };
}

async function getInstallationById(id, scope) {
  const installation = await installationsRepo.findById(id, scope);

  if (!installation) {
    throw ApiError.notFound('INSTALLATION_NOT_FOUND', `Installation ${id} not found.`);
  }

  return installation;
}

// A unique-key clash is a conflict with existing state, not a malformed request.
function asConflict(err) {
  if (err.code !== 'ER_DUP_ENTRY') {
    return err;
  }
  if (err.message.includes('uq_installations_meter')) {
    return ApiError.conflict('METER_ID_EXISTS', 'An installation with this meter_id already exists.',
      [{ field: 'meter_id', issue: 'already registered' }]);
  }
  if (err.message.includes('uq_installations_reference')) {
    return ApiError.conflict('REFERENCE_EXISTS', 'An installation with this reference already exists.',
      [{ field: 'reference', issue: 'already in use' }]);
  }
  return err;
}

// The device secret is random and returned exactly once. Deriving it from any
// stored field would let anyone who can read that field mint device tokens.
async function createInstallation(data, scope) {
  const substation = await gridSubstationsRepo.findById(data.substation_id, scope);

  if (!substation) {
    throw ApiError.badRequest('SUBSTATION_NOT_FOUND', `Substation ${data.substation_id} not found or outside your jurisdiction.`,
      [{ field: 'substation_id', issue: 'does not exist' }]);
  }

  const deviceSecret = crypto.randomBytes(24).toString('base64url');
  const deviceSecretHash = await hash(deviceSecret, BCRYPT_COST);

  let installationId;
  try {
    installationId = await installationsRepo.create(
      {
        ...data,
        district_id: substation.district_id,
        province_id: substation.province_id,
      },
      deviceSecretHash
    );
  } catch (err) {
    throw asConflict(err);
  }

  return {
    installation: await installationsRepo.findById(installationId, {}),
    device_secret: deviceSecret,
  };
}

// Loads the current representation and applies If-Match to it before any
// write happens, so a stale client gets 412 and the row is left untouched.
async function loadForWrite(id, scope, ifMatch) {
  const current = await installationsRepo.findById(id, scope);

  if (!current) {
    throw ApiError.notFound('INSTALLATION_NOT_FOUND', `Installation ${id} not found.`);
  }

  checkIfMatch(ifMatch, current);
  return current;
}

// PUT: the body is the complete mutable state (the schema requires every
// field), so repeating the same PUT leaves the same row — idempotent.
async function replaceInstallation(id, scope, data, ifMatch) {
  await loadForWrite(id, scope, ifMatch);

  try {
    await installationsRepo.update(id, scope, data);
  } catch (err) {
    throw asConflict(err);
  }

  return installationsRepo.findById(id, scope);
}

// PATCH: only the named fields change.
async function patchInstallation(id, scope, data, ifMatch) {
  await loadForWrite(id, scope, ifMatch);

  try {
    await installationsRepo.update(id, scope, data);
  } catch (err) {
    throw asConflict(err);
  }

  return installationsRepo.findById(id, scope);
}

// Readings are append-only history; an installation that has any cannot be
// deleted, because deleting it would mean deleting them. Decommission it
// (PATCH status) instead. A repeated DELETE finds nothing and returns 404,
// leaving the state exactly as the first one did — idempotent in effect.
async function deleteInstallation(id, scope, ifMatch) {
  await loadForWrite(id, scope, ifMatch);

  const readingCount = await readingsRepo.countAll({}, { installation_id: id });
  if (readingCount > 0) {
    throw ApiError.conflict('INSTALLATION_HAS_READINGS',
      `Installation ${id} has ${readingCount} readings, which are append-only history. Set status to "decommissioned" instead.`);
  }

  try {
    await installationsRepo.remove(id, scope);
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      throw ApiError.conflict('INSTALLATION_HAS_READINGS', `Installation ${id} is referenced by readings.`);
    }
    throw err;
  }
}

async function getInstallationOverview(id, scope) {
  const installation = await installationsRepo.findById(id, scope);

  if (!installation) {
    throw ApiError.notFound('INSTALLATION_NOT_FOUND', `Installation ${id} not found.`);
  }

  const [substation, latestReading, readingsStats, province, district] = await Promise.all([
    gridSubstationsRepo.findById(installation.substation_id, scope),
    readingsRepo.findLatestByInstallationId(id, scope),
    readingsRepo.getStatisticsByInstallationId(id, scope),
    provincesRepo.findById(installation.province_id, {}),
    districtsRepo.findById(installation.district_id, {}),
  ]);

  return {
    installation,
    substation,
    province,
    district,
    latest_reading: latestReading,
    readings_stats: {
      total_count: readingsStats.total_count || 0,
      date_range: readingsStats.total_count > 0 ? {
        from: readingsStats.date_from,
        to: readingsStats.date_to,
      } : null,
      power_kw: {
        min: readingsStats.power_min,
        max: readingsStats.power_max,
        avg: readingsStats.power_avg ? parseFloat(readingsStats.power_avg.toFixed(2)) : null,
      },
      energy_kwh: {
        min: readingsStats.energy_min,
        max: readingsStats.energy_max,
        avg: readingsStats.energy_avg ? parseFloat(readingsStats.energy_avg.toFixed(2)) : null,
      },
      voltage_v: {
        min: readingsStats.voltage_min,
        max: readingsStats.voltage_max,
        avg: readingsStats.voltage_avg ? parseFloat(readingsStats.voltage_avg.toFixed(2)) : null,
      },
    },
    capacity_metrics: {
      capacity_kw: installation.capacity_kw,
      panel_count: installation.panel_count,
      average_power_utilization_percent: readingsStats.power_avg && installation.capacity_kw
        ? parseFloat(((readingsStats.power_avg / installation.capacity_kw) * 100).toFixed(2))
        : null,
    },
  };
}

async function getLastKnownReading(id, scope) {
  const installation = await installationsRepo.findById(id, scope);

  if (!installation) {
    throw ApiError.notFound('INSTALLATION_NOT_FOUND', `Installation ${id} not found.`);
  }

  const reading = await readingsRepo.findLatestByInstallationId(id, scope);

  if (!reading) {
    throw ApiError.notFound('READING_NOT_FOUND', 'No readings available for this installation.');
  }

  return reading;
}

module.exports = {
  listInstallations,
  getInstallationById,
  createInstallation,
  replaceInstallation,
  patchInstallation,
  deleteInstallation,
  getInstallationOverview,
  getLastKnownReading,
};
