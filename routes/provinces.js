'use strict';

const express = require('express');
const validate = require('../middleware/validate');
const requireScope = require('../middleware/requireScope');
const { idParams, emptyQuery, listQuery } = require('../utils/schemas');
const provincesService = require('../services/provinces');

const router = express.Router();

router.use(requireScope('installations:read'));

// GET /provinces
router.get('/', validate(listQuery, 'query'), async (req, res) => {
  const { limit, offset, sort } = req.validated.query;
  res.json(await provincesService.listProvinces(limit, offset, req.scope, sort));
});

// GET /provinces/:id
router.get('/:id', validate(idParams, 'params'), validate(emptyQuery, 'query'), async (req, res) => {
  res.json(await provincesService.getProvinceById(req.validated.params.id, req.scope));
});

// GET /provinces/:id/districts
router.get('/:id/districts', validate(idParams, 'params'), validate(listQuery, 'query'), async (req, res) => {
  const { limit, offset, sort } = req.validated.query;
  res.json(await provincesService.listProvinceDistricts(req.validated.params.id, limit, offset, req.scope, sort));
});

module.exports = router;
