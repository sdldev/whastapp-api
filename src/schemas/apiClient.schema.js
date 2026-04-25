const { z } = require('zod');

const clientIdParams = z.object({ clientId: z.string().min(1).max(64) });
const statusEnum = z.enum(['active', 'inactive', 'revoked']);

const apiClientCreateSchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  body: z.object({
    name: z.string().min(1).max(120),
    description: z.string().max(500).optional(),
    status: statusEnum.optional(),
    allowedSessions: z.array(z.string().min(1).max(64)).min(1).default(['*']),
    scopes: z.array(z.string().min(1).max(120)).min(1).default(['*']),
    rateLimitPerMinute: z.number().int().min(1).max(10000).optional(),
    expiresAt: z.string().datetime().nullable().optional()
  })
});

const apiClientUpdateSchema = z.object({
  params: clientIdParams,
  query: z.object({}).passthrough(),
  body: z.object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(500).optional(),
    status: statusEnum.optional(),
    allowedSessions: z.array(z.string().min(1).max(64)).min(1).optional(),
    scopes: z.array(z.string().min(1).max(120)).min(1).optional(),
    rateLimitPerMinute: z.number().int().min(1).max(10000).optional(),
    expiresAt: z.string().datetime().nullable().optional()
  }).refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided'
  })
});

const apiClientParamSchema = z.object({
  params: clientIdParams,
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough()
});

const auditLogQuerySchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({
    limit: z.coerce.number().int().min(1).max(1000).optional(),
    actorId: z.string().min(1).max(120).optional(),
    sessionId: z.string().min(1).max(64).optional(),
    action: z.string().min(1).max(160).optional(),
    statusCode: z.coerce.number().int().min(100).max(599).optional()
  }),
  body: z.object({}).passthrough()
});

const logQueryFields = {
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  clientId: z.string().min(1).max(120).optional(),
  apiClientId: z.string().min(1).max(120).optional(),
  sessionId: z.string().min(1).max(64).optional(),
  chatId: z.string().min(1).optional(),
  direction: z.enum(['inbound', 'outbound']).optional(),
  status: z.string().min(1).max(40).optional(),
  statusCode: z.coerce.number().int().min(100).max(599).optional(),
  scopeUsed: z.string().min(1).max(160).optional(),
  fromDate: z.string().datetime().optional(),
  toDate: z.string().datetime().optional()
};

const usageLogQuerySchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object(logQueryFields),
  body: z.object({}).passthrough()
});

const messageLogAdminQuerySchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object(logQueryFields),
  body: z.object({}).passthrough()
});

const retentionCleanupSchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  body: z.object({
    apiUsageDays: z.number().int().min(1).max(3650).optional(),
    auditDays: z.number().int().min(1).max(3650).optional(),
    webhookDeliveryDays: z.number().int().min(1).max(3650).optional(),
    messageLogDays: z.number().int().min(1).max(3650).optional()
  }).default({})
});

module.exports = {
  apiClientCreateSchema,
  apiClientUpdateSchema,
  apiClientParamSchema,
  auditLogQuerySchema,
  usageLogQuerySchema,
  messageLogAdminQuerySchema,
  retentionCleanupSchema
};
