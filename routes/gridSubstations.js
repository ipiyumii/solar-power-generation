'use strict';

const express = require('express');
const validate = require('../middleware/validate');
const requireScope = require('../middleware/requireScope');
const { idParams, emptyQuery, substationsQuery, substationInstallationsQuery } = require('../utils/schemas');
const gridSubstationsService = require('../services/gridSubstations');

const router = express.Router();

router.use(requireScope('installations:read'));

// GET /grid-substations
router.get('/', validate(substationsQuery, 'query'), async (req, res) => {
  const { limit, offset, sort, province_id, district_id } = req.validated.query;
  res.json(await gridSubstationsService.listGridSubstations(limit, offset, req.scope, sort, { province_id, district_id }));
});

// GET /grid-substations/:id
router.get('/:id', validate(idParams, 'params'), validate(emptyQuery, 'query'), async (req, res) => {
  res.json(await gridSubstationsService.getGridSubstationById(req.validated.params.id, req.scope));
});

// GET /grid-substations/:id/installations
router.get('/:id/installations', validate(idParams, 'params'), validate(substationInstallationsQuery, 'query'), async (req, res) => {
  const { limit, offset, sort, status } = req.validated.query;
  res.json(await gridSubstationsService.listSubstationInstallations(
    req.validated.params.id, limit, offset, req.scope, sort, status
  ));
});

module.exports = router;
