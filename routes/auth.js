'use strict';

const express = require('express');
const validate = require('../middleware/validate');
const { loginBody, deviceTokenBody } = require('../utils/schemas');
const authService = require('../services/auth');

const router = express.Router();

router.post('/login', validate(loginBody, 'body'), async (req, res) => {
  const { email, password } = req.validated.body;
  const result = await authService.loginUser(email, password);
  res.status(200).json({ token: result.token, user: result.user });
});

router.post('/device-token', validate(deviceTokenBody, 'body'), async (req, res) => {
  const { meter_id, device_secret } = req.validated.body;
  const result = await authService.loginDevice(meter_id, device_secret);
  res.status(200).json({ token: result.token, installation: result.installation });
});

module.exports = router;
