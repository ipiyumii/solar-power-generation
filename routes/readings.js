'use strict';

const express = require('express');
const validate = require('../middleware/validate');
const requireScope = require('../middleware/requireScope');
const methodNotAllowed = require('../middleware/methodNotAllowed');
const { idParams, emptyQuery, readingsQuery } = require('../utils/schemas');
const readingsService = require('../services/readings');

// The estate-wide analytical view. Ingestion lives under the installation
// (POST /installations/:id/readings), so this collection is read-only.
const router = express.Router();

const canRead = requireScope('readings:read');

// GET /readings
router.route('/')
  .get(canRead, validate(readingsQuery, 'query'), async (req, res) => {
    const { limit, offset, sort, ...filters } = req.validated.query;
    res.json(await readingsService.listReadings(limit, offset, req.scope, sort, filters));
  })
  .all(methodNotAllowed('GET, HEAD'));

// GET /readings/:id
router.route('/:id')
  .get(canRead, validate(idParams, 'params'), validate(emptyQuery, 'query'), async (req, res) => {
    res.json(await readingsService.getReadingById(req.validated.params.id, req.scope));
  })
  .all(methodNotAllowed('GET, HEAD'));

module.exports = router;
