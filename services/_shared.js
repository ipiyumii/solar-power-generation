'use strict';

const ApiError = require('../utils/ApiError');
const { parseSort } = require('../utils/sortParser');
const { parseFilters } = require('../utils/filterParser');

// Returns the row, or throws the entity's own 404. Used for every atomic
// read and every parent check, so an out-of-scope row (which the repository
// returns as null) is indistinguishable from an absent one.
function orNotFound(row, code, message) {
  if (!row) {
    throw ApiError.notFound(code, message);
  }
  return row;
}

// One page of a collection. `entity` names the sort and filter whitelists in
// utils/sortParser.js and utils/filterParser.js. The page and its total use
// the same filters, so total_count always describes the query that was run.
async function listPage(repo, entity, limit, offset, scope, sortParam = null, rawFilters = null) {
  let sort = null;
  let filters = null;
  const filterParams = rawFilters
    ? Object.fromEntries(Object.entries(rawFilters).filter(([, v]) => v !== undefined))
    : {};

  if (sortParam) {
    try {
      sort = parseSort(sortParam, entity);
    } catch (err) {
      throw ApiError.badRequest('INVALID_SORT', err.message);
    }
  }

  if (Object.keys(filterParams).length > 0) {
    try {
      filters = parseFilters(filterParams, entity);
    } catch (err) {
      throw ApiError.badRequest('INVALID_FILTER', err.message);
    }
  }

  const [data, total] = await Promise.all([
    repo.findAll(limit, offset, scope, sort, filters),
    repo.countAll(scope, filters),
  ]);

  return { data, total, limit, offset };
}

module.exports = {
  orNotFound,
  listPage,
};
