'use strict';

const { orNotFound, listPage } = require('./_shared');
const { colomboDay } = require('../utils/colomboTime');
const districtsRepo = require('../repositories/districts');
const readingsRepo = require('../repositories/readings');
const gridSubstationsService = require('./gridSubstations');

function listDistricts(limit, offset, scope, sortParam = null, filters = null) {
  return listPage(districtsRepo, 'districts', limit, offset, scope, sortParam, filters);
}

async function getDistrictById(id, scope) {
  return orNotFound(await districtsRepo.findById(id, scope), 'DISTRICT_NOT_FOUND', `District ${id} not found.`);
}

async function listDistrictSubstations(districtId, limit, offset, scope, sortParam = null) {
  await getDistrictById(districtId, scope);
  return gridSubstationsService.listGridSubstations(limit, offset, scope, sortParam, { district_id: districtId });
}

// Devices report every 15 minutes; two missed intervals means the site is no
// longer telling us what it generates "now".
const FRESHNESS_MS = 30 * 60 * 1000;
const round3 = (n) => Number(Number(n).toFixed(3));

// The district's generation as of an instant `at` (default: now):
//  - current power: the sum of each installation's newest reading in the 30
//    minutes up to `at`; an installation with none is stale and adds nothing.
//  - today's energy: for each installation, MAX - MIN of the cumulative
//    counter over the Colombo day containing `at`, up to `at`, then summed.
//    Summing the counter itself would overstate by orders of magnitude.
async function getGenerationSummary(districtId, scope, at = new Date()) {
  const district = await getDistrictById(districtId, scope);

  const day = colomboDay(at);
  const dayEnd = at < day.end ? new Date(at.getTime() + 1) : day.end; // readings at `at` count
  const freshFrom = new Date(at.getTime() - FRESHNESS_MS);

  const [energyRows, latestRows] = await Promise.all([
    readingsRepo.districtEnergyByInstallation(districtId, day.start, dayEnd),
    readingsRepo.districtLatestReadings(districtId, freshFrom, at),
  ]);

  const latestById = new Map(latestRows.map((r) => [r.installation_id, r]));

  const installations = energyRows.map((row) => {
    const latest = latestById.get(row.installation_id);
    return {
      installation_id: row.installation_id,
      reference: row.reference,
      status: row.status,
      capacity_kw: row.capacity_kw,
      current_power_kw: latest ? round3(latest.power_kw) : null,
      last_reading_at: latest ? latest.recorded_at : null,
      energy_today_kwh: row.reading_count > 0 ? round3(row.energy_kwh) : 0,
      readings_today: row.reading_count,
      is_stale: !latest,
    };
  });

  const reporting = installations.filter((i) => !i.is_stale);

  return {
    district: {
      district_id: district.district_id,
      name: district.name,
      province_id: district.province_id,
    },
    as_of: at.toISOString(),
    date: day.date,
    timezone: 'Asia/Colombo',
    summary: {
      current_total_power_kw: round3(reporting.reduce((sum, i) => sum + i.current_power_kw, 0)),
      today_total_energy_kwh: round3(installations.reduce((sum, i) => sum + i.energy_today_kwh, 0)),
      installations_total: installations.length,
      installations_reporting: reporting.length,
      installations_stale: installations.length - reporting.length,
    },
    installations,
  };
}

module.exports = {
  listDistricts,
  getDistrictById,
  listDistrictSubstations,
  getGenerationSummary,
};
