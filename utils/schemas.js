'use strict';

const { z } = require('zod');

// Every schema is strict: an unknown key is a 400, never silently dropped,
// so a misspelled filter cannot return unfiltered data.

const STATUS = ['active', 'inactive', 'decommissioned'];

const pathId = z.coerce.number().int().positive();
const queryId = z.coerce.number().int().positive();
const bodyId = z.number().int().positive();
const timestamp = z.iso.datetime({ offset: true });

const page = {
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.string().min(1).optional(),
};

const timeWindow = {
  recorded_at_start: timestamp.optional(),
  recorded_at_end: timestamp.optional(),
};

// Path parameters
const idParams = z.strictObject({ id: pathId });
const readingParams = z.strictObject({ id: pathId, reading_id: pathId });

// Query strings
const emptyQuery = z.strictObject({});
const listQuery = z.strictObject(page);
const districtsQuery = z.strictObject({ ...page, province_id: queryId.optional() });
const substationsQuery = z.strictObject({
  ...page,
  province_id: queryId.optional(),
  district_id: queryId.optional(),
});
const installationsQuery = z.strictObject({
  ...page,
  province_id: queryId.optional(),
  district_id: queryId.optional(),
  substation_id: queryId.optional(),
  status: z.enum(STATUS).optional(),
});
const substationInstallationsQuery = z.strictObject({ ...page, status: z.enum(STATUS).optional() });
const readingsQuery = z.strictObject({
  ...page,
  province_id: queryId.optional(),
  district_id: queryId.optional(),
  substation_id: queryId.optional(),
  installation_id: queryId.optional(),
  ...timeWindow,
});
const installationReadingsQuery = z.strictObject({ ...page, ...timeWindow });

// The instant the summary is computed "as of"; defaults to now. Lets a caller
// ask what the district looked like at midday yesterday, not only right now.
const summaryQuery = z.strictObject({ at: timestamp.optional() });

// Bodies. Numbers must arrive as JSON numbers, not numeric strings.

// The installation id comes from the path, and jurisdiction is stamped from
// the installation record, so neither may appear in the body.
const createReadingBody = z.strictObject({
  recorded_at: timestamp,
  power_kw: z.number().min(0).max(1000),
  energy_kwh: z.number().min(0),
  voltage_v: z.number().min(0).max(500),
});

// The fields a client may set after creation. meter_id, inverter_id and
// substation_id are the installation's identity and placement, fixed at
// registration.
const mutableInstallation = {
  reference: z.string().min(1).max(32),
  capacity_kw: z.number().positive().max(999999.99),
  panel_count: z.number().int().positive().max(65535),
  status: z.enum(STATUS),
  commissioned_on: z.iso.date(),
  address_line: z.string().min(1).max(160),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
};

const createInstallationBody = z.strictObject({
  ...mutableInstallation,
  status: z.enum(STATUS).default('active'),
  meter_id: z.string().min(1).max(32),
  inverter_id: z.string().min(1).max(48),
  substation_id: bodyId,
});

// PUT replaces the whole mutable state, so every field is required.
const replaceInstallationBody = z.strictObject(mutableInstallation);

// PATCH changes only what it names.
const patchInstallationBody = z
  .strictObject(mutableInstallation)
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'At least one field is required.');

const loginBody = z.strictObject({
  email: z.email(),
  password: z.string().min(1),
});

const deviceTokenBody = z.strictObject({
  meter_id: z.string().min(1),
  device_secret: z.string().min(1),
});

module.exports = {
  idParams,
  readingParams,
  emptyQuery,
  listQuery,
  districtsQuery,
  substationsQuery,
  installationsQuery,
  substationInstallationsQuery,
  readingsQuery,
  installationReadingsQuery,
  summaryQuery,
  createReadingBody,
  createInstallationBody,
  replaceInstallationBody,
  patchInstallationBody,
  loginBody,
  deviceTokenBody,
};
