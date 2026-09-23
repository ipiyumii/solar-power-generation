'use strict';

const bcrypt = require('bcrypt');
const ApiError = require('../utils/ApiError');
const { signUser, signDevice } = require('../utils/jwt');
const usersRepo = require('../repositories/users');
const installationsRepo = require('../repositories/installations');

async function loginUser(email, password) {
  const user = await usersRepo.findByEmailForAuth(email);

  if (!user) {
    throw ApiError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  if (!user.is_active) {
    throw ApiError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatch) {
    throw ApiError.unauthorized('INVALID_CREDENTIALS', 'Invalid email or password.');
  }

  const scopes = Array.isArray(user.scopes) ? user.scopes : JSON.parse(user.scopes || '[]');

  const token = signUser({
    user_id: user.user_id,
    role: user.role,
    jurisdiction_level: user.jurisdiction_level,
    province_id: user.province_id,
    district_id: user.district_id,
    scopes,
  });

  return {
    token,
    user: {
      user_id: user.user_id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
    },
  };
}

async function loginDevice(meterId, deviceSecret) {
  const installation = await installationsRepo.findDeviceSecretByMeterId(meterId);

  if (!installation) {
    throw ApiError.unauthorized('INVALID_CREDENTIALS', 'Invalid meter ID or device secret.');
  }

  if (installation.status !== 'active') {
    throw ApiError.unauthorized('INVALID_CREDENTIALS', 'Invalid meter ID or device secret.');
  }

  const secretMatch = await bcrypt.compare(deviceSecret, installation.device_secret_hash);

  if (!secretMatch) {
    throw ApiError.unauthorized('INVALID_CREDENTIALS', 'Invalid meter ID or device secret.');
  }

  const token = signDevice({
    installation_id: installation.installation_id,
  });

  return {
    token,
    installation: {
      installation_id: installation.installation_id,
      meter_id: installation.meter_id,
    },
  };
}

module.exports = {
  loginUser,
  loginDevice,
};
