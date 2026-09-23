'use strict';

const { z } = require('zod');

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(50).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
  sort: z.string().optional(),
}).passthrough();

const sortParamSchema = z.string().regex(/^[a-z_]+:(asc|desc)$/i, 'Sort format must be "field:direction"');

const createReadingSchema = z.object({
  installation_id: z.coerce.number().int().positive('installation_id must be a positive integer'),
  recorded_at: z.string().datetime('recorded_at must be ISO 8601 datetime'),
  power_kw: z.coerce.number().min(0, 'power_kw must be non-negative'),
  energy_kwh: z.coerce.number().min(0, 'energy_kwh must be non-negative'),
  voltage_v: z.coerce.number().positive('voltage_v must be positive'),
}).strict();

const createInstallationSchema = z.object({
  reference: z.string().min(1).max(32, 'reference must be at most 32 characters'),
  meter_id: z.string().min(1).max(32, 'meter_id must be at most 32 characters'),
  inverter_id: z.string().min(1).max(48, 'inverter_id must be at most 48 characters'),
  capacity_kw: z.coerce.number().positive('capacity_kw must be positive'),
  panel_count: z.coerce.number().int().positive('panel_count must be a positive integer'),
  status: z.enum(['active', 'inactive', 'decommissioned']).default('active'),
  commissioned_on: z.string().date('commissioned_on must be YYYY-MM-DD format'),
  address_line: z.string().min(1).max(160, 'address_line must be at most 160 characters'),
  latitude: z.coerce.number().min(-90).max(90, 'latitude must be between -90 and 90'),
  longitude: z.coerce.number().min(-180).max(180, 'longitude must be between -180 and 180'),
  substation_id: z.coerce.number().int().positive('substation_id must be a positive integer'),
}).strict();

const updateInstallationSchema = z.object({
  reference: z.string().min(1).max(32, 'reference must be at most 32 characters').optional(),
  capacity_kw: z.coerce.number().positive('capacity_kw must be positive').optional(),
  panel_count: z.coerce.number().int().positive('panel_count must be a positive integer').optional(),
  status: z.enum(['active', 'inactive', 'decommissioned']).optional(),
  commissioned_on: z.string().date('commissioned_on must be YYYY-MM-DD format').optional(),
  address_line: z.string().min(1).max(160, 'address_line must be at most 160 characters').optional(),
  latitude: z.coerce.number().min(-90).max(90, 'latitude must be between -90 and 90').optional(),
  longitude: z.coerce.number().min(-180).max(180, 'longitude must be between -180 and 180').optional(),
}).strict();

module.exports = {
  paginationSchema,
  sortParamSchema,
  createReadingSchema,
  createInstallationSchema,
  updateInstallationSchema,
};
