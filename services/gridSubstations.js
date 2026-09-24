'use strict';

const ApiError = require('../utils/ApiError');
const { parseSort } = require('../utils/sortParser');
const gridSubstationsRepo = require('../repositories/gridSubstations');
const installationsService = require('./installations');

async function listGridSubstations(limit, offset, scope, sortParam = null, filters = null) {
  let sort = null;

  if (sortParam) {
    try {
      sort = parseSort(sortParam, 'gridSubstations');
    } catch (err) {
      throw ApiError.badRequest('INVALID_SORT', err.message);
    }
  }

  const [substations, total] = await Promise.all([
    gridSubstationsRepo.findAll(limit, offset, scope, sort, filters),
    gridSubstationsRepo.countAll(scope, filters),
  ]);

  return {
    data: substations,
    total,
    limit,
    offset,
    sort: sortParam || undefined,
  };
}

async function getGridSubstationById(id, scope) {
  const substation = await gridSubstationsRepo.findById(id, scope);

  if (!substation) {
    throw ApiError.notFound('SUBSTATION_NOT_FOUND', `Grid substation ${id} not found.`);
  }

  return substation;
}

async function listSubstationInstallations(substationId, limit, offset, scope, sortParam = null, status = undefined) {
  await getGridSubstationById(substationId, scope);
  return installationsService.listInstallations(limit, offset, scope, sortParam, { substation_id: substationId, status });
}

module.exports = {
  listGridSubstations,
  getGridSubstationById,
  listSubstationInstallations,
};
