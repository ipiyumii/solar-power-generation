'use strict';

const FILTERABLE_FIELDS = {
  installations: {
    province_id: 'integer',
    district_id: 'integer',
    substation_id: 'integer',
    status: 'enum:active,inactive,decommissioned',
  },
  readings: {
    installation_id: 'integer',
    recorded_at_start: 'datetime',
    recorded_at_end: 'datetime',
  },
};

function parseFilters(filterParams, entity) {
  if (!filterParams || Object.keys(filterParams).length === 0) {
    return null;
  }

  const validFields = FILTERABLE_FIELDS[entity];
  if (!validFields) {
    throw new Error(`Unknown entity: ${entity}`);
  }

  const filters = {};

  for (const [key, value] of Object.entries(filterParams)) {
    if (!validFields[key]) {
      throw new Error(`Field "${key}" is not filterable for ${entity}`);
    }

    const fieldType = validFields[key];

    if (fieldType === 'integer') {
      const num = Number.isInteger(+value) ? +value : null;
      if (num === null || num <= 0) {
        throw new Error(`Field "${key}" must be a positive integer`);
      }
      filters[key] = num;
    } else if (fieldType === 'datetime') {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new Error(`Field "${key}" must be a valid ISO 8601 datetime`);
      }
      // A Date, not an ISO string: the driver serialises it in UTC to match
      // the DATETIME columns, where MySQL rejects a trailing "Z".
      filters[key] = date;
    } else if (fieldType.startsWith('enum:')) {
      const validValues = fieldType.split(':')[1].split(',');
      if (!validValues.includes(value)) {
        throw new Error(`Field "${key}" must be one of: ${validValues.join(', ')}`);
      }
      filters[key] = value;
    }
  }

  return Object.keys(filters).length > 0 ? filters : null;
}

module.exports = {
  parseFilters,
  FILTERABLE_FIELDS,
};
