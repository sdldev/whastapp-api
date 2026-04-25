const { z } = require('zod');

const sessionParams = z.object({ sessionId: z.string().min(1).max(64) });

const webhookCreateSchema = z.object({
  params: z.object({}).passthrough(),
  query: z.object({}).passthrough(),
  body: z.object({
    url: z.string().url(),
    events: z.array(z.string().min(1)).min(1),
    secret: z.string().optional(),
    active: z.boolean().optional()
  })
});

const webhookUpdateSchema = z.object({
  params: z.object({ webhookId: z.string().min(1) }).passthrough(),
  query: z.object({}).passthrough(),
  body: z.object({
    url: z.string().url().optional(),
    events: z.array(z.string().min(1)).min(1).optional(),
    secret: z.string().optional(),
    active: z.boolean().optional()
  }).refine((value) => Object.keys(value).length > 0, 'At least one field must be provided')
});

const webhookParamSchema = z.object({
  params: z.object({ webhookId: z.string().min(1) }).passthrough(),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough()
});

const webhookDeliveryParamSchema = z.object({
  params: z.object({ deliveryId: z.string().min(1) }).passthrough(),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough()
});

const contactListSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough()
});

const contactParamSchema = z.object({
  params: sessionParams.extend({ contactId: z.string().min(1) }),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough()
});

const contactCardSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({
    to: z.string().min(1),
    contactId: z.string().min(1)
  })
});

const numberLookupSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({ number: z.string().min(1) })
});

const profileTextSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({ value: z.string().min(1).max(139) })
});

const profilePictureSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({
    mimetype: z.string().min(1),
    data: z.string().min(1),
    filename: z.string().optional()
  })
});

const chatParamSchema = z.object({
  params: sessionParams.extend({ chatId: z.string().min(1) }),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough()
});

module.exports = {
  webhookCreateSchema,
  webhookUpdateSchema,
  webhookParamSchema,
  webhookDeliveryParamSchema,
  contactListSchema,
  contactParamSchema,
  contactCardSchema,
  numberLookupSchema,
  profileTextSchema,
  profilePictureSchema,
  chatParamSchema
};
