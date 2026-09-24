'use strict';

const ApiError = require('../utils/ApiError');
const { resourceUrl } = require('../utils/links');
const { parseSort } = require('../utils/sortParser');
const { parseFilters } = require('../utils/filterParser');
const readingsRepo = require('../repositories/readings');
const installationsRepo = require('../repositories/installations');

const definedOnly = (obj) =>
  obj ? Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) : null;

const readingPath = (installationId, readingId) => `/installations/${installationId}/readings/${readingId}`;

async function listReadings(limit, offset, scope, sortParam = null, rawFilters = null) {
  let sort = null;
  let filters = null;
  const filterParams = definedOnly(rawFilters);

  if (sortParam) {
    try {
      sort = parseSort(sortParam, 'readings');
    } catch (err) {
      throw ApiError.badRequest('INVALID_SORT', err.message);
    }
  }

  if (filterParams && Object.keys(filterParams).length > 0) {
    try {
      filters = parseFilters(filterParams, 'readings');
    } catch (err) {
      throw ApiError.badRequest('INVALID_FILTER', err.message);
    }
  }

  const [readings, total] = await Promise.all([
    readingsRepo.findAll(limit, offset, scope, sort, filters),
    readingsRepo.countAll(scope, filters),
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

async function requireInstallation(installationId, scope) {
  const installation = await installationsRepo.findById(installationId, scope);
  if (!installation) {
    throw ApiError.notFound('INSTALLATION_NOT_FOUND', `Installation ${installationId} not found.`);
  }
  return installation;
}

// The analytical view: one installation's history, paginated, filtered by
// time window and sorted. An absent or out-of-scope installation is 404.
async function listInstallationReadings(installationId, query, scope) {
  await requireInstallation(installationId, scope);
  return listReadings(query.limit, query.offset, scope, query.sort, {
    installation_id: installationId,
    recorded_at_start: query.recorded_at_start,
    recorded_at_end: query.recorded_at_end,
  });
}

// A reading exists at this URI only under the installation that owns it.
async function getInstallationReading(installationId, readingId, scope) {
  const reading = await readingsRepo.findById(readingId, scope);

  if (!reading || reading.installation_id !== installationId) {
    throw ApiError.notFound('READING_NOT_FOUND', `Reading ${readingId} not found for installation ${installationId}.`);
  }

  return reading;
}

// The caller has already proved the device owns installationId. Jurisdiction
// columns are stamped from the installation row inside the repository.
async function ingestReading(installationId, body) {
  const recordedAt = new Date(body.recorded_at);

  let reading;
  try {
    reading = await readingsRepo.create(
      installationId,
      recordedAt,
      body.power_kw,
      body.energy_kwh,
      body.voltage_v,
      {}
    );
  } catch (err) {
    if (err.code !== 'ER_DUP_ENTRY') {
      throw err;
    }
    // POST is not idempotent, but the resource is protected by its natural
    // key: a replay is refused and pointed at the reading already stored.
    const existingId = await readingsRepo.findIdByNaturalKey(installationId, recordedAt);
    throw ApiError.conflict(
      'DUPLICATE_READING',
      'A reading for this installation at this recorded_at already exists.',
      [{ field: 'recorded_at', issue: 'duplicates an existing reading' }],
      existingId ? { Location: resourceUrl(readingPath(installationId, existingId)) } : undefined
    );
  }

  if (!reading) {
    throw ApiError.notFound('INSTALLATION_NOT_FOUND', `Installation ${installationId} not found.`);
  }

  return { reading, location: resourceUrl(readingPath(installationId, reading.reading_id)) };
}

module.exports = {
  listReadings,
  getReadingById,
  listInstallationReadings,
  getInstallationReading,
  ingestReading,
};
