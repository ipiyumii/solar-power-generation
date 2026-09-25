'use strict';

const express = require('express');
const ApiError = require('../utils/ApiError');
const { resourceUrl } = require('../utils/links');
const validate = require('../middleware/validate');
const { withLinks } = require('../utils/pagination');
const requireScope = require('../middleware/requireScope');
const requirePrincipal = require('../middleware/requirePrincipal');
const requireRole = require('../middleware/requireRole');
const rateLimits = require('../middleware/rateLimits');
const methodNotAllowed = require('../middleware/methodNotAllowed');
const {
  idParams,
  readingParams,
  emptyQuery,
  installationsQuery,
  installationReadingsQuery,
  createInstallationBody,
  replaceInstallationBody,
  patchInstallationBody,
  createReadingBody,
} = require('../utils/schemas');
const installationsService = require('../services/installations');
const readingsService = require('../services/readings');

const router = express.Router();

// Principal type first, then scope: a device token fails on type before any
// scope string is looked at, so the write-read split does not depend on
// scopes being assigned correctly.
const canRead = [requirePrincipal('user'), requireScope('installations:read')];
const canReadReadings = [requirePrincipal('user'), requireScope('readings:read')];
const canWrite = [requirePrincipal('user'), requireRole('admin'), requireScope('installations:write')];
const byId = validate(idParams, 'params');
const noQuery = validate(emptyQuery, 'query');

// GET /installations
router.get('/', ...canRead, validate(installationsQuery, 'query'), async (req, res) => {
  const { limit, offset, sort, ...filters } = req.validated.query;
  res.json(withLinks(req, await installationsService.listInstallations(limit, offset, req.scope, sort, filters)));
});

// POST /installations — the device secret is in this response and nowhere else.
router.post('/', ...canWrite, validate(createInstallationBody, 'body'), async (req, res) => {
  const { installation, device_secret } = await installationsService.createInstallation(req.validated.body, req.scope);
  res.status(201)
    .location(resourceUrl(`/installations/${installation.installation_id}`))
    .json({ ...installation, device_secret });
});

router.route('/:id')
  .get(...canRead, byId, noQuery, async (req, res) => {
    res.json(await installationsService.getInstallationById(req.validated.params.id, req.scope));
  })
  .put(...canWrite, byId, validate(replaceInstallationBody, 'body'), async (req, res) => {
    res.json(await installationsService.replaceInstallation(
      req.validated.params.id, req.scope, req.validated.body, req.get('If-Match')
    ));
  })
  .patch(...canWrite, byId, validate(patchInstallationBody, 'body'), async (req, res) => {
    res.json(await installationsService.patchInstallation(
      req.validated.params.id, req.scope, req.validated.body, req.get('If-Match')
    ));
  })
  .delete(...canWrite, byId, async (req, res) => {
    await installationsService.deleteInstallation(req.validated.params.id, req.scope, req.get('If-Match'));
    res.status(204).end();
  })
  .all(methodNotAllowed('GET, HEAD, PUT, PATCH, DELETE'));

// GET /installations/:id/overview — composite
router.get('/:id/overview', ...canRead, byId, noQuery, async (req, res) => {
  res.json(await installationsService.getInstallationOverview(req.validated.params.id, req.scope));
});

// GET /installations/:id/last-known-reading — derived, operational
router.get('/:id/last-known-reading', ...canRead, byId, noQuery, async (req, res) => {
  res.json(await installationsService.getLastKnownReading(req.validated.params.id, req.scope));
});

// /installations/:id/readings — the analytical history, and the device's
// ingestion point.
router.route('/:id/readings')
  .get(...canReadReadings, byId, validate(installationReadingsQuery, 'query'), async (req, res) => {
    const { limit, offset, sort, ...filters } = req.validated.query;
    res.json(withLinks(req, await readingsService.listInstallationReadings(
      req.validated.params.id, limit, offset, req.scope, sort, filters
    )));
  })
  .post(
    rateLimits.ingestion,
    requirePrincipal('device'),
    requireScope('readings:write'),
    byId,
    validate(createReadingBody, 'body'),
    async (req, res) => {
      const installationId = req.validated.params.id;

      // The binding check: a device may write to exactly one installation.
      // 403, not 404 — the device already knows its own site exists.
      if (req.principal.installation_id !== installationId) {
        throw ApiError.forbidden('INSTALLATION_MISMATCH', 'This device may only submit readings for its own installation.');
      }

      const { reading, location } = await readingsService.ingestReading(installationId, req.validated.body);
      res.status(201).location(location).json(reading);
    }
  )
  .all(methodNotAllowed('GET, HEAD, POST'));

// Readings are append-only: the refusal of every mutation is the feature.
router.route('/:id/readings/:reading_id')
  .get(...canReadReadings, validate(readingParams, 'params'), noQuery, async (req, res) => {
    const { id, reading_id } = req.validated.params;
    res.json(await readingsService.getInstallationReading(id, reading_id, req.scope));
  })
  .all(methodNotAllowed('GET, HEAD'));

module.exports = router;
