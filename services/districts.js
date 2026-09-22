'use strict';

const ApiError = require('../utils/ApiError');
const districtsRepo = require('../repositories/districts');
const provincesRepo = require('../repositories/provinces');

async function listDistricts(limit, offset, scope) {
  const [districts, total] = await Promise.all([
    districtsRepo.findAll(limit, offset, scope),
    districtsRepo.countAll(scope),
  ]);

  return {
    data: districts,
    total,
    limit,
    offset,
  };
}

async function getDistrictById(id, scope) {
  const district = await districtsRepo.findById(id, scope);

  if (!district) {
    throw ApiError.notFound('DISTRICT_NOT_FOUND', `District ${id} not found.`);
  }

  return district;
}

module.exports = {
  listDistricts,
  getDistrictById,
};
