'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');

const COMMON = {
  issuer: 'slsea-api',
  audience: 'slsea-api/v1',
  algorithm: 'HS256',
};

function signUser(user) {
  return jwt.sign(
    {
      typ: 'user',
      role: user.role,
      jurisdiction: {
        level: user.jurisdiction_level,
        province_id: user.province_id ?? null,
        district_id: user.district_id ?? null,
      },
      scope: user.scopes.join(' '),
    },
    env.JWT_SECRET,
    {
      ...COMMON,
      subject: `user:${user.user_id}`,
      expiresIn: env.JWT_USER_TTL,
    }
  );
}

function signDevice(installation) {
  return jwt.sign(
    {
      typ: 'device',
      installation_id: installation.installation_id,
      scope: 'readings:write',
    },
    env.JWT_SECRET,
    {
      ...COMMON,
      subject: `installation:${installation.installation_id}`,
      expiresIn: env.JWT_DEVICE_TTL,
    }
  );
}

function verify(token) {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: 'slsea-api',
    audience: 'slsea-api/v1',
  });
}

module.exports = {
  signUser,
  signDevice,
  verify,
};
