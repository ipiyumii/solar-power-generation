'use strict';

const { orNotFound, listPage } = require('./_shared');
const gridSubstationsRepo = require('../repositories/gridSubstations');
const installationsService = require('./installations');

function listGridSubstations(limit, offset, scope, sortParam = null, filters = null) {
  return listPage(gridSubstationsRepo, 'gridSubstations', limit, offset, scope, sortParam, filters);
}

async function getGridSubstationById(id, scope) {
  return orNotFound(await gridSubstationsRepo.findById(id, scope), 'SUBSTATION_NOT_FOUND', `Grid substation ${id} not found.`);
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
