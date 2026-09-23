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

module.exports = {
  paginationSchema,
  sortParamSchema,
  createReadingSchema,
};
