'use strict';

const ApiError = require('../utils/ApiError');
const districtsRepo = require('../repositories/districts');
const provincesRepo = require('../repositories/provinces');

async function listDistricts(limit, offset) {
  const [districts, total] = await Promise.all([
    districtsRepo.findAll(limit, offset),
    districtsRepo.countAll(),
  ]);

  return {
    data: districts,
    total,
    limit,
    offset,
  };
}

async function getDistrictById(id) {
  const district = await districtsRepo.findById(id);

  if (!district) {
    throw ApiError.notFound('DISTRICT_NOT_FOUND', `District ${id} not found.`);
  }

  // Verify province exists
  await provincesRepo.findById(district.province_id);

  return district;
}

module.exports = {
  listDistricts,
  getDistrictById,
};
