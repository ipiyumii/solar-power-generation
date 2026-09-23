'use strict';

const express = require('express');
const { z } = require('zod');
const ApiError = require('../utils/ApiError');
const authService = require('../services/auth');

const router = express.Router();

const loginUserSchema = z.object({
  email: z.string().email('Invalid email address.'),
  password: z.string().min(1, 'Password is required.'),
}).strict();

const deviceTokenSchema = z.object({
  meter_id: z.string().min(1, 'Meter ID is required.'),
  device_secret: z.string().min(1, 'Device secret is required.'),
}).strict();

router.post('/login', async (req, res, next) => {
  try {
    const body = loginUserSchema.parse(req.body);
    const result = await authService.loginUser(body.email, body.password);

    res.status(200).json({
      token: result.token,
      user: result.user,
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      const details = err.errors.map((e) => ({
        field: e.path.join('.'),
        issue: e.message,
      }));
      return next(ApiError.badRequest('INVALID_REQUEST', 'Invalid request body.', details));
    }
    next(err);
  }
});

router.post('/device-token', async (req, res, next) => {
  try {
    const body = deviceTokenSchema.parse(req.body);
    const result = await authService.loginDevice(body.meter_id, body.device_secret);

    res.status(200).json({
      token: result.token,
      installation: result.installation,
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      const details = err.errors.map((e) => ({
        field: e.path.join('.'),
        issue: e.message,
      }));
      return next(ApiError.badRequest('INVALID_REQUEST', 'Invalid request body.', details));
    }
    next(err);
  }
});

module.exports = router;
