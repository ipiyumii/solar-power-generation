'use strict';

const ApiError = require('../utils/ApiError');
const installationsRepo = require('../repositories/installations');

async function listInstallations(limit, offset) {
  const [installations, total] = await Promise.all([
    installationsRepo.findAll(limit, offset),
    installationsRepo.countAll(),
  ]);

  return {
    data: installations,
    total,
    limit,
    offset,
  };
}

async function getInstallationById(id) {
  const installation = await installationsRepo.findById(id);

  if (!installation) {
    throw ApiError.notFound('INSTALLATION_NOT_FOUND', `Installation ${id} not found.`);
  }

  return installation;
}

module.exports = {
  listInstallations,
  getInstallationById,
};
