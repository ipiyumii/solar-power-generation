'use strict';

const express = require('express');
const ApiError = require('../utils/ApiError');
const { paginationSchema, createInstallationSchema, updateInstallationSchema } = require('../utils/schemas');
const requireScope = require('../middleware/requireScope');
const requirePrincipal = require('../middleware/requirePrincipal');
const installationsService = require('../services/installations');

const router = express.Router();

// Read operations
router.get('/', requireScope('installations:read'), async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    const filters = {
      province_id: query.province_id,
      district_id: query.district_id,
      substation_id: query.substation_id,
      status: query.status,
    };
    const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined));
    const result = await installationsService.listInstallations(query.limit, query.offset, req.scope, query.sort, Object.keys(activeFilters).length > 0 ? activeFilters : null);
    res.json(result);
  } catch (err) {
    if (err.name === 'ZodError') {
      return next(ApiError.badRequest('INVALID_QUERY', 'Invalid query parameters.', err.errors));
    }
    next(err);
  }
});

router.get('/:id/overview', requireScope('installations:read'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return next(ApiError.badRequest('INVALID_ID', 'Installation ID must be an integer.'));
    }
    const overview = await installationsService.getInstallationOverview(id, req.scope);
    res.json(overview);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireScope('installations:read'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return next(ApiError.badRequest('INVALID_ID', 'Installation ID must be an integer.'));
    }
    const installation = await installationsService.getInstallationById(id, req.scope);
    res.json(installation);
  } catch (err) {
    next(err);
  }
});

// Write operations
router.post('/', requirePrincipal('user'), requireScope('installations:write'), async (req, res, next) => {
  try {
    const data = createInstallationSchema.parse(req.body);
    const installation = await installationsService.createInstallation(data, req.scope);
    res.status(201).json(installation);
  } catch (err) {
    if (err.name === 'ZodError') {
      return next(ApiError.badRequest('INVALID_REQUEST', 'Invalid request body.', err.errors));
    }
    next(err);
  }
});

router.put('/:id', requirePrincipal('user'), requireScope('installations:write'), async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return next(ApiError.badRequest('INVALID_ID', 'Installation ID must be an integer.'));
    }
    const data = updateInstallationSchema.parse(req.body);
    const installation = await installationsService.updateInstallation(id, req.scope, data);
    res.json(installation);
  } catch (err) {
    if (err.name === 'ZodError') {
      return next(ApiError.badRequest('INVALID_REQUEST', 'Invalid request body.', err.errors));
    }
    next(err);
  }
});

module.exports = router;
