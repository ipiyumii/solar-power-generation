'use strict';

const express = require('express');
const ApiError = require('../utils/ApiError');
const { paginationSchema } = require('../utils/schemas');
const requireScope = require('../middleware/requireScope');
const readingsService = require('../services/readings');

const router = express.Router();

router.use(requireScope('readings:read'));

// GET /readings
router.get('/', async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    const filters = {
      installation_id: query.installation_id,
      recorded_at_start: query.recorded_at_start,
      recorded_at_end: query.recorded_at_end,
    };
    const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined));
    const result = await readingsService.listReadings(query.limit, query.offset, req.scope, query.sort, Object.keys(activeFilters).length > 0 ? activeFilters : null);
    res.json(result);
  } catch (err) {
    if (err.name === 'ZodError') {
      return next(ApiError.badRequest('INVALID_QUERY', 'Invalid query parameters.', err.errors));
    }
    next(err);
  }
});

// GET /readings/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return next(ApiError.badRequest('INVALID_ID', 'Reading ID must be an integer.'));
    }
    const reading = await readingsService.getReadingById(id, req.scope);
    res.json(reading);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
