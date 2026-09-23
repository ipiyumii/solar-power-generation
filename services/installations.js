'use strict';

const ApiError = require('../utils/ApiError');
const { parseSort } = require('../utils/sortParser');
const { parseFilters } = require('../utils/filterParser');
const installationsRepo = require('../repositories/installations');

async function listInstallations(limit, offset, scope, sortParam = null, filterParams = null) {
  let sort = null;
  let filters = null;

  if (sortParam) {
    try {
      sort = parseSort(sortParam, 'installations');
    } catch (err) {
      throw ApiError.badRequest('INVALID_SORT', err.message);
    }
  }

  if (filterParams) {
    try {
      filters = parseFilters(filterParams, 'installations');
    } catch (err) {
      throw ApiError.badRequest('INVALID_FILTER', err.message);
    }
  }

  const [installations, total] = await Promise.all([
    installationsRepo.findAll(limit, offset, scope, sort, filters),
    installationsRepo.countAll(scope),
  ]);

  return {
    data: installations,
    total,
    limit,
    offset,
    sort: sortParam || undefined,
    filters: filterParams && Object.keys(filterParams).length > 0 ? filterParams : undefined,
  };
}

async function getInstallationById(id, scope) {
  const installation = await installationsRepo.findById(id, scope);

  if (!installation) {
    throw ApiError.notFound('INSTALLATION_NOT_FOUND', `Installation ${id} not found.`);
  }

  return installation;
}

module.exports = {
  listInstallations,
  getInstallationById,
};
