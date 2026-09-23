'use strict';

const ApiError = require('../utils/ApiError');
const { parseSort } = require('../utils/sortParser');
const { parseFilters } = require('../utils/filterParser');
const readingsRepo = require('../repositories/readings');

async function listReadings(limit, offset, scope, sortParam = null, filterParams = null) {
  let sort = null;
  let filters = null;

  if (sortParam) {
    try {
      sort = parseSort(sortParam, 'readings');
    } catch (err) {
      throw ApiError.badRequest('INVALID_SORT', err.message);
    }
  }

  if (filterParams) {
    try {
      filters = parseFilters(filterParams, 'readings');
    } catch (err) {
      throw ApiError.badRequest('INVALID_FILTER', err.message);
    }
  }

  const [readings, total] = await Promise.all([
    readingsRepo.findAll(limit, offset, scope, sort, filters),
    readingsRepo.countAll(scope),
  ]);

  return {
    data: readings,
    total,
    limit,
    offset,
    sort: sortParam || undefined,
    filters: filterParams && Object.keys(filterParams).length > 0 ? filterParams : undefined,
  };
}

async function getReadingById(id, scope) {
  const reading = await readingsRepo.findById(id, scope);

  if (!reading) {
    throw ApiError.notFound('READING_NOT_FOUND', `Reading ${id} not found.`);
  }

  return reading;
}

module.exports = {
  listReadings,
  getReadingById,
};
