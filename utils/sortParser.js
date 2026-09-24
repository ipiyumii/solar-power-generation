'use strict';

const SORTABLE_FIELDS = {
  gridSubstations: ['substation_id', 'district_id', 'province_id', 'name', 'code', 'capacity_mva', 'voltage_level_kv', 'created_at', 'updated_at'],
  districts: ['district_id', 'province_id', 'name', 'code', 'created_at', 'updated_at'],
  provinces: ['province_id', 'name', 'code', 'capital', 'created_at', 'updated_at'],
  installations: ['installation_id', 'reference', 'meter_id', 'capacity_kw', 'status', 'commissioned_on', 'district_id', 'province_id', 'created_at', 'updated_at'],
  readings: ['reading_id', 'installation_id', 'recorded_at', 'power_kw', 'energy_kwh', 'voltage_v', 'district_id', 'province_id', 'ingested_at'],
};

function parseSort(sortParam, entity) {
  if (!sortParam) {
    return null;
  }

  const [field, direction] = sortParam.toLowerCase().split(':');

  if (!field || !direction) {
    throw new Error('Sort format must be "field:direction"');
  }

  if (direction !== 'asc' && direction !== 'desc') {
    throw new Error('Direction must be "asc" or "desc"');
  }

  const validFields = SORTABLE_FIELDS[entity];
  if (!validFields) {
    throw new Error(`Unknown entity: ${entity}`);
  }

  if (!validFields.includes(field)) {
    throw new Error(`Field "${field}" is not sortable for ${entity}`);
  }

  return { field, direction: direction.toUpperCase() };
}

module.exports = {
  parseSort,
  SORTABLE_FIELDS,
};
