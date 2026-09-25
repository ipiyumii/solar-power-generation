'use strict';

const ApiError = require('../utils/ApiError');
const { resourceUrl } = require('../utils/links');
const { orNotFound, listPage } = require('./_shared');
const readingsRepo = require('../repositories/readings');
const installationsService = require('./installations');

const readingPath = (installationId, readingId) => `/installations/${installationId}/readings/${readingId}`;

function listReadings(limit, offset, scope, sortParam = null, filters = null) {
  return listPage(readingsRepo, 'readings', limit, offset, scope, sortParam, filters);
}

async function getReadingById(id, scope) {
  return orNotFound(await readingsRepo.findById(id, scope), 'READING_NOT_FOUND', `Reading ${id} not found.`);
}

// The analytical view: one installation's history, paginated, filtered by
// time window and sorted. An absent or out-of-scope installation is 404.
async function listInstallationReadings(installationId, limit, offset, scope, sortParam = null, filters = null) {
  await installationsService.getInstallationById(installationId, scope);
  return listReadings(limit, offset, scope, sortParam, { ...filters, installation_id: installationId });
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
