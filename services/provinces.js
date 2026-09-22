'use strict';

const ApiError = require('../utils/ApiError');
const provincesRepo = require('../repositories/provinces');

async function listProvinces(limit, offset, scope) {
  const [provinces, total] = await Promise.all([
    provincesRepo.findAll(limit, offset, scope),
    provincesRepo.countAll(scope),
  ]);

  return {
    data: provinces,
    total,
    limit,
    offset,
  };
}

async function getProvinceById(id, scope) {
  const province = await provincesRepo.findById(id, scope);

  if (!province) {
    throw ApiError.notFound('PROVINCE_NOT_FOUND', `Province ${id} not found.`);
  }

  return province;
}

module.exports = {
  listProvinces,
  getProvinceById,
};
