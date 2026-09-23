'use strict';

const ApiError = require('../utils/ApiError');
const { parseSort } = require('../utils/sortParser');
const districtsRepo = require('../repositories/districts');
const provincesRepo = require('../repositories/provinces');

async function listDistricts(limit, offset, scope, sortParam = null) {
  let sort = null;

  if (sortParam) {
    try {
      sort = parseSort(sortParam, 'districts');
    } catch (err) {
      throw ApiError.badRequest('INVALID_SORT', err.message);
    }
  }

  const [districts, total] = await Promise.all([
    districtsRepo.findAll(limit, offset, scope, sort),
    districtsRepo.countAll(scope),
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

module.exports = {
  listDistricts,
  getDistrictById,
};
