'use strict';

const ApiError = require('../utils/ApiError');
const { parseSort } = require('../utils/sortParser');
const provincesRepo = require('../repositories/provinces');
const districtsService = require('./districts');

async function listProvinces(limit, offset, scope, sortParam = null) {
  let sort = null;

  if (sortParam) {
    try {
      sort = parseSort(sortParam, 'provinces');
    } catch (err) {
      throw ApiError.badRequest('INVALID_SORT', err.message);
    }
  }

  const [provinces, total] = await Promise.all([
    provincesRepo.findAll(limit, offset, scope, sort),
    provincesRepo.countAll(scope),
  ]);

  return {
    data: provinces,
    total,
    limit,
    offset,
    sort: sortParam || undefined,
  };
}

async function getProvinceById(id, scope) {
  const province = await provincesRepo.findById(id, scope);

  if (!province) {
    throw ApiError.notFound('PROVINCE_NOT_FOUND', `Province ${id} not found.`);
  }

  return province;
}

// A scoped sub-collection under a parent that is absent or out of scope is
// itself not found, rather than an empty 200 that implies the parent exists.
async function listProvinceDistricts(provinceId, limit, offset, scope, sortParam = null) {
  await getProvinceById(provinceId, scope);
  return districtsService.listDistricts(limit, offset, scope, sortParam, { province_id: provinceId });
}

module.exports = {
  listProvinces,
  getProvinceById,
  listProvinceDistricts,
};
