const { z } = require('zod');

const sessionParams = z.object({
  sessionId: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/)
});

const startSessionSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({
    restartIfExists: z.boolean().optional()
  }).default({})
});

const sessionOnlySchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough()
});

module.exports = {
  startSessionSchema,
  sessionOnlySchema
};
