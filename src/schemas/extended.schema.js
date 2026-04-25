const { z } = require('zod');

const sessionParams = z.object({ sessionId: z.string().min(1).max(64) });
const channelParams = sessionParams.extend({ channelId: z.string().min(1) });

const locationSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({
    to: z.string().min(1),
    latitude: z.number(),
    longitude: z.number(),
    description: z.string().optional()
  })
});

const chatParamSchema = z.object({
  params: sessionParams.extend({ chatId: z.string().min(1) }),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough()
});

const muteSchema = z.object({
  params: sessionParams.extend({ chatId: z.string().min(1) }),
  query: z.object({}).passthrough(),
  body: z.object({ until: z.string().datetime().optional() }).default({})
});

const chatListSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough()
});

const chatSearchSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(100).optional().default(25) })
});

const groupParamsSchema = z.object({
  params: sessionParams.extend({ groupId: z.string().min(1) }),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough()
});

const joinGroupSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({ inviteCodeOrUrl: z.string().min(1) })
});

const createGroupSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({
    name: z.string().min(1),
    participants: z.array(z.string().min(1)).min(1)
  })
});

const inviteInfoSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({ inviteCodeOrUrl: z.string().min(1) })
});

const groupPictureSchema = z.object({
  params: sessionParams.extend({ groupId: z.string().min(1) }),
  query: z.object({}).passthrough(),
  body: z.object({
    mimetype: z.string().min(1),
    data: z.string().min(1),
    filename: z.string().optional()
  })
});

const updateGroupInfoSchema = z.object({
  params: sessionParams.extend({ groupId: z.string().min(1) }),
  query: z.object({}).passthrough(),
  body: z.object({ subject: z.string().optional(), description: z.string().optional() })
});

const updateGroupSettingsSchema = z.object({
  params: sessionParams.extend({ groupId: z.string().min(1) }),
  query: z.object({}).passthrough(),
  body: z.object({ messagesAdminsOnly: z.boolean().optional(), infoAdminsOnly: z.boolean().optional() })
});

const participantsSchema = z.object({
  params: sessionParams.extend({ groupId: z.string().min(1) }),
  query: z.object({}).passthrough(),
  body: z.object({ participants: z.array(z.string().min(1)).min(1) })
});

const participantParamSchema = z.object({
  params: sessionParams.extend({ groupId: z.string().min(1), participantId: z.string().min(1) }),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough()
});

const membershipRequestsActionSchema = z.object({
  params: sessionParams.extend({ groupId: z.string().min(1) }),
  query: z.object({}).passthrough(),
  body: z.object({ requesterIds: z.array(z.string().min(1)).optional() }).default({})
});

const mentionEveryoneSchema = z.object({
  params: sessionParams.extend({ groupId: z.string().min(1) }),
  query: z.object({}).passthrough(),
  body: z.object({
    messagePrefix: z.string().optional(),
    messageSuffix: z.string().optional()
  }).default({})
});

const pollSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({
    to: z.string().min(1),
    name: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    allowMultipleAnswers: z.boolean().optional()
  })
});

const votePollSchema = z.object({
  params: sessionParams.extend({ pollMessageId: z.string().min(1) }),
  query: z.object({}).passthrough(),
  body: z.object({ selectedOptions: z.array(z.string().min(1)).min(1) })
});

const channelParamSchema = z.object({
  params: channelParams,
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough()
});

const channelListSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough()
});

const channelSearchSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({ query: z.string().min(1), limit: z.number().int().min(1).max(100).optional().default(25) })
});

const channelMessageSchema = z.object({
  params: channelParams,
  query: z.object({}).passthrough(),
  body: z.object({
    message: z.string().optional(),
    mimetype: z.string().optional(),
    data: z.string().optional(),
    url: z.string().url().optional(),
    filename: z.string().optional(),
    caption: z.string().optional(),
    options: z.record(z.string(), z.any()).optional()
  }).refine((body) => Boolean(body.message || body.data || body.url), {
    message: 'One of message, data, or url is required'
  })
});

const channelFetchMessagesSchema = z.object({
  params: channelParams,
  query: z.object({ limit: z.coerce.number().int().min(1).max(100).optional() }).passthrough(),
  body: z.object({ searchOptions: z.record(z.string(), z.any()).optional() }).default({})
});

const channelInfoSchema = z.object({
  params: channelParams,
  query: z.object({}).passthrough(),
  body: z.object({ subject: z.string().optional(), description: z.string().optional() }).refine((body) => Boolean(body.subject || body.description), {
    message: 'subject or description is required'
  })
});

const channelPictureSchema = z.object({
  params: channelParams,
  query: z.object({}).passthrough(),
  body: z.object({ mimetype: z.string().min(1), data: z.string().min(1), filename: z.string().optional() })
});

const channelReactionSettingSchema = z.object({
  params: channelParams,
  query: z.object({}).passthrough(),
  body: z.object({ reactionCode: z.number().int().min(0).max(2) })
});

const channelUserSchema = z.object({
  params: channelParams.extend({ userId: z.string().min(1) }),
  query: z.object({}).passthrough(),
  body: z.object({ options: z.record(z.string(), z.any()).optional() }).default({})
});

const channelSubscribersSchema = z.object({
  params: channelParams,
  query: z.object({ limit: z.coerce.number().int().min(1).max(1000).optional() }).passthrough(),
  body: z.object({ limit: z.number().int().min(1).max(1000).optional() }).default({})
});

module.exports = {
  locationSchema,
  chatParamSchema,
  muteSchema,
  chatListSchema,
  chatSearchSchema,
  groupParamsSchema,
  joinGroupSchema,
  createGroupSchema,
  inviteInfoSchema,
  groupPictureSchema,
  updateGroupInfoSchema,
  updateGroupSettingsSchema,
  participantsSchema,
  participantParamSchema,
  membershipRequestsActionSchema,
  mentionEveryoneSchema,
  pollSchema,
  votePollSchema,
  channelParamSchema,
  channelListSchema,
  channelSearchSchema,
  channelMessageSchema,
  channelFetchMessagesSchema,
  channelInfoSchema,
  channelPictureSchema,
  channelReactionSettingSchema,
  channelUserSchema,
  channelSubscribersSchema
};
