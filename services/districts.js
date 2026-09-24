'use strict';

const ApiError = require('../utils/ApiError');
const { parseSort } = require('../utils/sortParser');
const districtsRepo = require('../repositories/districts');
const provincesRepo = require('../repositories/provinces');
const installationsRepo = require('../repositories/installations');
const readingsRepo = require('../repositories/readings');
const gridSubstationsService = require('./gridSubstations');

async function listDistricts(limit, offset, scope, sortParam = null, filters = null) {
  let sort = null;

  if (sortParam) {
    try {
      sort = parseSort(sortParam, 'districts');
    } catch (err) {
      throw ApiError.badRequest('INVALID_SORT', err.message);
    }
  }

  const [districts, total] = await Promise.all([
    districtsRepo.findAll(limit, offset, scope, sort, filters),
    districtsRepo.countAll(scope, filters),
  ]);

  return {
    data: districts,
    total,
    limit,
    offset,
    sort: sortParam || undefined,
  };
}

async function getDistrictById(id, scope) {
  const district = await districtsRepo.findById(id, scope);

  if (!district) {
    throw ApiError.notFound('DISTRICT_NOT_FOUND', `District ${id} not found.`);
  }

  return district;
}

async function listDistrictSubstations(districtId, limit, offset, scope, sortParam = null) {
  await getDistrictById(districtId, scope);
  return gridSubstationsService.listGridSubstations(limit, offset, scope, sortParam, { district_id: districtId });
}

async function getGenerationSummary(districtId, scope) {
  const district = await districtsRepo.findById(districtId, scope);

  if (!district) {
    throw ApiError.notFound('DISTRICT_NOT_FOUND', `District ${districtId} not found.`);
  }

  const today = new Date().toISOString().split('T')[0];
  const installations = await installationsRepo.findByDistrictId(districtId, scope);

  const results = await Promise.all(
    installations.map(async (installation) => {
      const stats = await readingsRepo.getEnergyGenerationStats(
        installation.installation_id,
        today,
        scope
      );

      const energyGenerated = stats.reading_count > 0
        ? parseFloat((stats.energy_max - stats.energy_min).toFixed(2))
        : null;

      return {
        installation_id: installation.installation_id,
        reference: installation.reference,
        status: installation.status,
        capacity_kw: installation.capacity_kw,
        energy_generated_kwh: energyGenerated,
        reading_count: stats.reading_count,
        first_reading_time: stats.first_reading_time,
        last_reading_time: stats.last_reading_time,
        is_stale: stats.reading_count === 0,
      };
    })
  );

  const activeInstallations = results.filter(r => !r.is_stale);
  const staleInstallations = results.filter(r => r.is_stale);

  const totalEnergyGenerated = activeInstallations.reduce(
    (sum, inst) => sum + (inst.energy_generated_kwh || 0),
    0
  );

  return {
    district: {
      id: district.district_id,
      name: district.name,
      province_id: district.province_id,
    },
    date: today,
    summary: {
      total_energy_generated_kwh: parseFloat(totalEnergyGenerated.toFixed(2)),
      active_installations_count: activeInstallations.length,
      stale_installations_count: staleInstallations.length,
      total_installations_count: results.length,
    },
    installations: {
      active: activeInstallations,
      stale: staleInstallations,
    },
  };
}

module.exports = {
  listDistricts,
  getDistrictById,
  listDistrictSubstations,
  getGenerationSummary,
};
