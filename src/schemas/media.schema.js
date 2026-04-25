const { z } = require('zod');

const sessionParams = z.object({ sessionId: z.string().min(1).max(64) });

const mediaBase64Schema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({
    to: z.string().min(1),
    mimetype: z.string().min(1),
    data: z.string().min(1),
    filename: z.string().optional(),
    caption: z.string().optional()
  })
});

const mediaUrlSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({
    to: z.string().min(1),
    url: z.string().url(),
    caption: z.string().optional()
  })
});

const stickerBase64Schema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({
    to: z.string().min(1),
    mimetype: z.string().min(1),
    data: z.string().min(1),
    filename: z.string().optional()
  })
});

const stickerUrlSchema = z.object({
  params: sessionParams,
  query: z.object({}).passthrough(),
  body: z.object({
    to: z.string().min(1),
    url: z.string().url()
  })
});

const mediaDownloadSchema = z.object({
  params: sessionParams.extend({ messageId: z.string().min(1) }),
  query: z.object({}).passthrough(),
  body: z.object({}).passthrough()
});

const mediaDownloadBinarySchema = z.object({
  params: sessionParams.extend({ messageId: z.string().min(1) }),
  query: z.object({
    filename: z.string().optional()
  }).passthrough(),
  body: z.object({}).passthrough()
});

module.exports = {
  mediaBase64Schema,
  mediaUrlSchema,
  stickerBase64Schema,
  stickerUrlSchema,
  mediaDownloadSchema,
  mediaDownloadBinarySchema
};
