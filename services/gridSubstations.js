'use strict';

const ApiError = require('../utils/ApiError');
const gridSubstationsRepo = require('../repositories/gridSubstations');

async function listGridSubstations(limit, offset) {
  const [substations, total] = await Promise.all([
    gridSubstationsRepo.findAll(limit, offset),
    gridSubstationsRepo.countAll(),
  ]);

  return {
    data: substations,
    total,
    limit,
    offset,
  };
}

async function getGridSubstationById(id) {
  const substation = await gridSubstationsRepo.findById(id);

  if (!substation) {
    throw ApiError.notFound('SUBSTATION_NOT_FOUND', `Grid substation ${id} not found.`);
  }

  return substation;
}

module.exports = {
  listGridSubstations,
  getGridSubstationById,
};
