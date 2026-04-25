const { z } = require('zod');

const sessionParams = z.object({ sessionId: z.string().min(1).max(64) });

const userMentionsSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({
    to: z.string().min(1),
    message: z.string().min(1),
    mentions: z.array(z.string().min(1)).min(1)
  })
});

const groupMentionsSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({
    to: z.string().min(1),
    message: z.string().min(1),
    groupMentions: z.array(z.object({
      id: z.string().min(1),
      subject: z.string().min(1)
    })).min(1)
  })
});

module.exports = {
  userMentionsSchema,
  groupMentionsSchema
};
