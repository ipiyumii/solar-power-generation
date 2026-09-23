'use strict';

const express = require('express');
const ApiError = require('../utils/ApiError');
const { paginationSchema } = require('../utils/schemas');
const installationsService = require('../services/installations');

const router = express.Router();

// GET /installations
router.get('/', async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    const result = await installationsService.listInstallations(query.limit, query.offset, req.scope);
    res.json(result);
  } catch (err) {
    if (err.name === 'ZodError') {
      return next(ApiError.badRequest('INVALID_QUERY', 'Invalid query parameters.', err.errors));
    }
    next(err);
  }
});

// GET /installations/:id
router.get('/:id', async (req, res, next) => {
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

module.exports = router;
