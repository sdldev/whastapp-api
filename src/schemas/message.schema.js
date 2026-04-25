const { z } = require('zod');

const sessionParams = z.object({ sessionId: z.string().min(1).max(64) });
const chatParams = sessionParams.extend({ chatId: z.string().min(1) });

const sendTextSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({
    to: z.string().min(1),
    message: z.string().min(1),
    options: z.record(z.string(), z.any()).optional().default({})
  })
});

const replySchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({
    messageId: z.string().min(1),
    message: z.string().min(1)
  })
});

const reactSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({
    messageId: z.string().min(1),
    reaction: z.string()
  })
});

const messageIdParams = sessionParams.extend({ messageId: z.string().min(1) });

const messageIdOnlySchema = z.object({
  params: messageIdParams,
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough()
});

const forwardSchema = z.object({
  params: messageIdParams,
  query: z.object({}).passthrough(),
  body: z.object({
    to: z.string().min(1)
  })
});

const editSchema = z.object({
  params: messageIdParams,
  query: z.object({}).passthrough(),
  body: z.object({
    message: z.string().min(1)
  })
});

const fetchMessagesSchema = z.object({
  params: chatParams,
  query: z.object({}).passthrough(),
  body: z.object({
    limit: z.number().int().min(1).max(100).optional().default(25),
    fromMe: z.boolean().optional()
  }).default({})
});

const searchMessagesSchema = z.object({
  params: chatParams,
  query: z.object({}).passthrough(),
  body: z.object({
    query: z.string().min(1),
    limit: z.number().int().min(1).max(100).optional().default(25),
    page: z.number().int().min(0).optional().default(0)
  })
});

const chatActionSchema = z.object({
  params: chatParams,
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough()
});

const presenceSchema = z.object({
  params: chatParams,
  query: z.object({}).passthrough(),
  body: z.object({ durationMs: z.number().int().min(1000).max(60000).optional() }).default({})
});

const sessionPresenceSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough()
});

module.exports = {
  sendTextSchema,
  replySchema,
  reactSchema,
  messageIdOnlySchema,
  forwardSchema,
  editSchema,
  fetchMessagesSchema,
  searchMessagesSchema,
  chatActionSchema,
  presenceSchema,
  sessionPresenceSchema
};
