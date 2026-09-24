'use strict';

const { hash } = require('bcrypt');
const ApiError = require('../utils/ApiError');
const { parseSort } = require('../utils/sortParser');
const { parseFilters } = require('../utils/filterParser');
const installationsRepo = require('../repositories/installations');
const gridSubstationsRepo = require('../repositories/gridSubstations');
const readingsRepo = require('../repositories/readings');
const provincesRepo = require('../repositories/provinces');
const districtsRepo = require('../repositories/districts');

async function listInstallations(limit, offset, scope, sortParam = null, filterParams = null) {
  let sort = null;
  let filters = null;

  if (sortParam) {
    try {
      sort = parseSort(sortParam, 'installations');
    } catch (err) {
      throw ApiError.badRequest('INVALID_SORT', err.message);
    }
  }

  if (filterParams) {
    try {
      filters = parseFilters(filterParams, 'installations');
    } catch (err) {
      throw ApiError.badRequest('INVALID_FILTER', err.message);
    }
  }

  const [installations, total] = await Promise.all([
    installationsRepo.findAll(limit, offset, scope, sort, filters),
    installationsRepo.countAll(scope),
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

async function createInstallation(data, scope) {
  const substation = await gridSubstationsRepo.findById(data.substation_id, scope);

  if (!substation) {
    throw ApiError.badRequest('SUBSTATION_NOT_FOUND', `Substation ${data.substation_id} not found or outside your jurisdiction.`);
  }

  let deviceSecretHash;
  try {
    deviceSecretHash = await hash(data.inverter_id, 12);
  } catch (err) {
    throw ApiError.internal('HASH_ERROR', 'Failed to hash device secret.');
  }

  try {
    const installationId = await installationsRepo.create(
      {
        ...data,
        district_id: substation.district_id,
        province_id: substation.province_id,
      },
      deviceSecretHash
    );

    return await installationsRepo.findById(installationId, {});
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.message.includes('uq_installations_meter')) {
        throw ApiError.badRequest('METER_ID_EXISTS', 'An installation with this meter_id already exists.');
      }
      if (err.message.includes('uq_installations_reference')) {
        throw ApiError.badRequest('REFERENCE_EXISTS', 'An installation with this reference already exists.');
      }
    }
    throw err;
  }
}

async function updateInstallation(id, scope, data) {
  const installation = await installationsRepo.findById(id, scope);

  if (!installation) {
    throw ApiError.notFound('INSTALLATION_NOT_FOUND', `Installation ${id} not found.`);
  }

  const updated = await installationsRepo.update(id, scope, data);

  if (!updated) {
    throw ApiError.badRequest('NO_CHANGES', 'No fields were updated.');
  }

  return await installationsRepo.findById(id, scope);
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
  updateInstallation,
  getInstallationOverview,
  getLastKnownReading,
};
