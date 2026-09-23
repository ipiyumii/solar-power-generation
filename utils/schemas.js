'use strict';

const { z } = require('zod');

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(50).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
  sort: z.string().optional(),
}).passthrough();

const sortParamSchema = z.string().regex(/^[a-z_]+:(asc|desc)$/i, 'Sort format must be "field:direction"');

const installationFiltersSchema = z.object({
  province_id: z.coerce.number().int().positive().optional(),
  district_id: z.coerce.number().int().positive().optional(),
  substation_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['active', 'inactive', 'decommissioned']).optional(),
}).passthrough();

const readingFiltersSchema = z.object({
  installation_id: z.coerce.number().int().positive().optional(),
  recorded_at_start: z.string().datetime().optional(),
  recorded_at_end: z.string().datetime().optional(),
}).passthrough();

module.exports = {
  paginationSchema,
  sortParamSchema,
  installationFiltersSchema,
  readingFiltersSchema,
};
