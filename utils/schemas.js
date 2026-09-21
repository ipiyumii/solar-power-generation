'use strict';

const { z } = require('zod');

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(50).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
}).strict(); // Reject unknown parameters

module.exports = {
  paginationSchema,
};
