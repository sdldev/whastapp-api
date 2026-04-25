const express = require('express');
const multer = require('multer');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const { success } = require('../utils/apiResponse');
const mediaService = require('../services/media.service');
const {
  mediaBase64Schema,
  mediaUrlSchema,
  mediaDownloadSchema,
  mediaDownloadBinarySchema,
  stickerBase64Schema,
  stickerUrlSchema
} = require('../schemas/media.schema');

const router = express.Router({ mergeParams: true });
const upload = multer({ dest: env.uploadDir });

router.post('/base64', validate(mediaBase64Schema), asyncHandler(async (req, res) => {
  return success(res, await mediaService.sendBase64(req.params.sessionId, req.body), 201);
}));

router.post('/url', validate(mediaUrlSchema), asyncHandler(async (req, res) => {
  return success(res, await mediaService.sendUrl(req.params.sessionId, req.body), 201);
}));

router.post('/upload', upload.single('file'), asyncHandler(async (req, res) => {
  return success(res, await mediaService.sendUpload(req.params.sessionId, {
    to: req.body.to,
    caption: req.body.caption,
    file: req.file
  }), 201);
}));

router.post('/sticker/base64', validate(stickerBase64Schema), asyncHandler(async (req, res) => {
  return success(res, await mediaService.sendStickerBase64(req.params.sessionId, req.body), 201);
}));

router.post('/sticker/url', validate(stickerUrlSchema), asyncHandler(async (req, res) => {
  return success(res, await mediaService.sendStickerUrl(req.params.sessionId, req.body), 201);
}));

router.get('/:messageId/download', validate(mediaDownloadSchema), asyncHandler(async (req, res) => {
  return success(res, await mediaService.download(req.params.sessionId, req.params.messageId));
}));

router.get('/:messageId/download.bin', validate(mediaDownloadBinarySchema), asyncHandler(async (req, res) => {
  const media = await mediaService.downloadBinary(req.params.sessionId, req.params.messageId);
  const filename = req.query.filename || media.filename || `${req.params.messageId}`;
  res.set('Content-Type', media.mimetype || 'application/octet-stream');
  res.set('Content-Disposition', `attachment; filename="${String(filename).replace(/"/g, '')}"`);
  return res.send(media.buffer);
}));

module.exports = router;
