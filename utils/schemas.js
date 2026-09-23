'use strict';

const { z } = require('zod');

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(50).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
  sort: z.string().optional(),
}).passthrough();

const sortParamSchema = z.string().regex(/^[a-z_]+:(asc|desc)$/i, 'Sort format must be "field:direction"');

module.exports = {
  paginationSchema,
  sortParamSchema,
};
