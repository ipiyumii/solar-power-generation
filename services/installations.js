'use strict';

const ApiError = require('../utils/ApiError');
const installationsRepo = require('../repositories/installations');

async function listInstallations(limit, offset, scope) {
  const [installations, total] = await Promise.all([
    installationsRepo.findAll(limit, offset, scope),
    installationsRepo.countAll(scope),
  ]);

  return {
    data: installations,
    total,
    limit,
    offset,
  };
}

async function getInstallationById(id, scope) {
  const installation = await installationsRepo.findById(id, scope);

  if (!installation) {
    throw ApiError.notFound('INSTALLATION_NOT_FOUND', `Installation ${id} not found.`);
  }

  return installation;
}

module.exports = {
  listInstallations,
  getInstallationById,
};
