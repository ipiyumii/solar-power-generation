'use strict';

const ApiError = require('../utils/ApiError');
const gridSubstationsRepo = require('../repositories/gridSubstations');

async function listGridSubstations(limit, offset, scope) {
  const [substations, total] = await Promise.all([
    gridSubstationsRepo.findAll(limit, offset, scope),
    gridSubstationsRepo.countAll(scope),
  ]);

  return {
    data: substations,
    total,
    limit,
    offset,
  };
}

async function getGridSubstationById(id, scope) {
  const substation = await gridSubstationsRepo.findById(id, scope);

  if (!substation) {
    throw ApiError.notFound('SUBSTATION_NOT_FOUND', `Grid substation ${id} not found.`);
  }

  return substation;
}

module.exports = {
  listGridSubstations,
  getGridSubstationById,
};
