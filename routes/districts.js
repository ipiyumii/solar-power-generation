'use strict';

const express = require('express');
const validate = require('../middleware/validate');
const { withLinks } = require('../utils/pagination');
const requireScope = require('../middleware/requireScope');
const { idParams, emptyQuery, listQuery, districtsQuery, summaryQuery } = require('../utils/schemas');
const districtsService = require('../services/districts');

const router = express.Router();

router.use(requireScope('installations:read'));

// GET /districts
router.get('/', validate(districtsQuery, 'query'), async (req, res) => {
  const { limit, offset, sort, province_id } = req.validated.query;
  res.json(withLinks(req, await districtsService.listDistricts(limit, offset, req.scope, sort, { province_id })));
});

// GET /districts/:id
router.get('/:id', validate(idParams, 'params'), validate(emptyQuery, 'query'), async (req, res) => {
  res.json(await districtsService.getDistrictById(req.validated.params.id, req.scope));
});

// GET /districts/:id/grid-substations
router.get('/:id/grid-substations', validate(idParams, 'params'), validate(listQuery, 'query'), async (req, res) => {
  const { limit, offset, sort } = req.validated.query;
  res.json(withLinks(req, await districtsService.listDistrictSubstations(req.validated.params.id, limit, offset, req.scope, sort)));
});

// GET /districts/:id/generation-summary[?at=ISO-8601]
router.get(
  '/:id/generation-summary',
  requireScope('summary:read'),
  validate(idParams, 'params'),
  validate(summaryQuery, 'query'),
  async (req, res) => {
    const { at } = req.validated.query;
    res.json(await districtsService.getGenerationSummary(req.validated.params.id, req.scope, at ? new Date(at) : new Date()));
  }
);

module.exports = router;
