'use strict';

const express = require('express');
const ApiError = require('../utils/ApiError');
const { paginationSchema } = require('../utils/schemas');
const requireScope = require('../middleware/requireScope');
const provincesService = require('../services/provinces');

const router = express.Router();

router.use(requireScope('installations:read'));

// GET /provinces
router.get('/', async (req, res, next) => {
  try {
    const query = paginationSchema.parse(req.query);
    const result = await provincesService.listProvinces(query.limit, query.offset, req.scope, query.sort);
    res.json(result);
  } catch (err) {
    if (err.name === 'ZodError') {
      return next(ApiError.badRequest('INVALID_QUERY', 'Invalid query parameters.', err.errors));
    }
    next(err);
  }
});

// GET /provinces/:id
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return next(ApiError.badRequest('INVALID_ID', 'Province ID must be an integer.'));
    }
    const province = await provincesService.getProvinceById(id, req.scope);
    res.json(province);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
