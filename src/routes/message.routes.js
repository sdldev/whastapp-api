const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../middlewares/validate.middleware');
const { success, fail } = require('../utils/apiResponse');
const messageService = require('../services/message.service');
const {
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
} = require('../schemas/message.schema');

const router = express.Router({ mergeParams: true });

router.post('/text', validate(sendTextSchema), asyncHandler(async (req, res) => {
  return success(res, await messageService.sendText(req.params.sessionId, req.body), 201);
}));

router.post('/reply', validate(replySchema), asyncHandler(async (req, res) => {
  return success(res, await messageService.reply(req.params.sessionId, req.body), 201);
}));

router.post('/react', validate(reactSchema), asyncHandler(async (req, res) => {
  return success(res, await messageService.react(req.params.sessionId, req.body));
}));

router.post('/:messageId/forward', validate(forwardSchema), asyncHandler(async (req, res) => {
  return success(res, await messageService.forward(req.params.sessionId, req.params.messageId, req.body), 201);
}));

router.post('/presence/available', validate(sessionPresenceSchema), asyncHandler(async (req, res) => {
  return success(res, await messageService.sendPresenceAvailable(req.params.sessionId));
}));

router.post('/presence/unavailable', validate(sessionPresenceSchema), asyncHandler(async (req, res) => {
  return success(res, await messageService.sendPresenceUnavailable(req.params.sessionId));
}));

router.post('/chats/:chatId/messages/fetch', validate(fetchMessagesSchema), asyncHandler(async (req, res) => {
  return success(res, await messageService.fetchMessages(req.params.sessionId, req.params.chatId, req.body));
}));

router.post('/chats/:chatId/messages/search', validate(searchMessagesSchema), asyncHandler(async (req, res) => {
  return success(res, await messageService.searchMessages(req.params.sessionId, req.params.chatId, req.body));
}));

router.post('/chats/:chatId/seen', validate(chatActionSchema), asyncHandler(async (req, res) => {
  return success(res, await messageService.sendSeen(req.params.sessionId, req.params.chatId));
}));

router.post('/chats/:chatId/mark-unread', validate(chatActionSchema), asyncHandler(async (req, res) => {
  return success(res, await messageService.markUnread(req.params.sessionId, req.params.chatId));
}));

router.post('/chats/:chatId/presence/typing', validate(presenceSchema), asyncHandler(async (req, res) => {
  return success(res, await messageService.sendTyping(req.params.sessionId, req.params.chatId, req.body));
}));

router.post('/chats/:chatId/presence/recording', validate(presenceSchema), asyncHandler(async (req, res) => {
  return success(res, await messageService.sendRecording(req.params.sessionId, req.params.chatId, req.body));
}));

router.post('/chats/:chatId/presence/clear', validate(chatActionSchema), asyncHandler(async (req, res) => {
  return success(res, await messageService.clearPresence(req.params.sessionId, req.params.chatId));
}));

router.patch('/:messageId', validate(editSchema), asyncHandler(async (req, res) => {
  return success(res, await messageService.edit(req.params.sessionId, req.params.messageId, req.body));
}));

router.delete('/:messageId', validate(messageIdOnlySchema), asyncHandler(async (req, res) => {
  return success(res, await messageService.deleteMessage(req.params.sessionId, req.params.messageId, req.body));
}));

router.post('/:messageId/star', validate(messageIdOnlySchema), asyncHandler(async (req, res) => {
  return success(res, await messageService.star(req.params.sessionId, req.params.messageId));
}));

router.delete('/:messageId/star', validate(messageIdOnlySchema), asyncHandler(async (req, res) => {
  return success(res, await messageService.unstar(req.params.sessionId, req.params.messageId));
}));

router.get('/:messageId/quoted', validate(messageIdOnlySchema), asyncHandler(async (req, res) => {
  return success(res, await messageService.getQuoted(req.params.sessionId, req.params.messageId));
}));

router.post('/buttons', (req, res) => fail(res, {
  code: 'FEATURE_DEPRECATED',
  message: 'Buttons are deprecated and not supported by whatsapp-web.js',
  details: null
}, 410));

router.post('/lists', (req, res) => fail(res, {
  code: 'FEATURE_DEPRECATED',
  message: 'Lists are deprecated and not supported by whatsapp-web.js',
  details: null
}, 410));

module.exports = router;
