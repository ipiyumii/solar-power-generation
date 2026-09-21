'use strict';

const express = require('express');
const ApiError = require('../utils/ApiError');
const { paginationSchema } = require('../utils/schemas');
const districtsService = require('../services/districts');

const router = express.Router();

// GET /districts
router.get('/', async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    const result = await districtsService.listDistricts(query.limit, query.offset);
    res.json(result);
  } catch (err) {
    if (err.name === 'ZodError') {
      return next(ApiError.badRequest('INVALID_QUERY', 'Invalid query parameters.', err.errors));
    }
    next(err);
  }
});

// GET /districts/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return next(ApiError.badRequest('INVALID_ID', 'District ID must be an integer.'));
    }
    const district = await districtsService.getDistrictById(id);
    res.json(district);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
