'use strict';

const express = require('express');
const ApiError = require('../utils/ApiError');
const { paginationSchema } = require('../utils/schemas');
const requireScope = require('../middleware/requireScope');
const gridSubstationsService = require('../services/gridSubstations');

const router = express.Router();

router.use(requireScope('installations:read'));

// GET /grid-substations
router.get('/', async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    const result = await gridSubstationsService.listGridSubstations(query.limit, query.offset, req.scope);
    res.json(result);
  } catch (err) {
    if (err.name === 'ZodError') {
      return next(ApiError.badRequest('INVALID_QUERY', 'Invalid query parameters.', err.errors));
    }
    next(err);
  }
});

// GET /grid-substations/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return next(ApiError.badRequest('INVALID_ID', 'Substation ID must be an integer.'));
    }
    const substation = await gridSubstationsService.getGridSubstationById(id, req.scope);
    res.json(substation);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
