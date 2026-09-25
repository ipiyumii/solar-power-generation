'use strict';

const { orNotFound, listPage } = require('./_shared');
const provincesRepo = require('../repositories/provinces');
const districtsService = require('./districts');

function listProvinces(limit, offset, scope, sortParam = null) {
  return listPage(provincesRepo, 'provinces', limit, offset, scope, sortParam);
}

async function getProvinceById(id, scope) {
  return orNotFound(await provincesRepo.findById(id, scope), 'PROVINCE_NOT_FOUND', `Province ${id} not found.`);
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
