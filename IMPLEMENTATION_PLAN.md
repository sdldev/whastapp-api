# WhatsApp API Interface Implementation Plan

## Phase 1 — Project Foundation

1. Add HTTP server dependencies and runtime scripts.
2. Create the API entrypoint and Express application bootstrap.
3. Add centralized configuration, logging, response helpers, validation, and error middleware.
4. Add `GET /health` for server monitoring.

## Phase 2 — WhatsApp Session Lifecycle

1. Build a session registry for multiple WhatsApp clients keyed by `sessionId`.
2. Use `LocalAuth` as the default authentication strategy.
3. Store session state, QR payload, account information, timestamps, and last error.
4. Add lifecycle handling for `qr`, `authenticated`, `ready`, `auth_failure`, and `disconnected` events.
5. Add safe guards so WhatsApp operations require a ready session.

## Phase 3 — Session API

1. `POST /sessions/:sessionId/start` starts or reuses a WhatsApp session.
2. `GET /sessions` lists runtime sessions.
3. `GET /sessions/:sessionId/status` returns session state.
4. `GET /sessions/:sessionId/qr` returns the latest QR string and data URL.
5. `POST /sessions/:sessionId/logout` logs out a session.
6. `POST /sessions/:sessionId/restart` restarts a session.
7. `DELETE /sessions/:sessionId` destroys a session.

## Phase 4 — Messaging and Webhooks

1. Add text message sending with chat/contact normalization.
2. Add reply support for messages available in runtime cache.
3. Cache incoming/outgoing message metadata.
4. Add webhook registration, listing, deletion, and dispatch.
5. Dispatch session and message lifecycle events to registered webhook targets.

## Phase 5 — Media API

1. Send media from base64 using `MessageMedia`.
2. Send media from URL using `MessageMedia.fromUrl`.
3. Send media from multipart upload.
4. Download media from cached incoming messages.
5. Emit media webhook events for messages that contain attachments.

## Phase 6 — Mentions, Contacts, Location, Chats, Groups, Reactions, Polls

1. Send user mentions.
2. Send group mentions.
3. Mention all group members.
4. Read contact information and profile pictures.
5. Block and unblock contacts.
6. Send locations and emit incoming location events.
7. Mute and unmute chats.
8. Join groups, retrieve invites, update group info/settings, and manage participants.
9. React to cached messages.
10. Create polls and vote in cached poll messages where supported.

## Phase 7 — Safety and Production Hardening

1. Protect API routes with `x-api-key` when `API_KEY` is configured.
2. Validate request payloads with schemas.
3. Use standardized success and error responses.
4. Add structured logging.
5. Add graceful shutdown for all WhatsApp clients.
6. Keep deprecated features explicit: buttons, lists, and communities return clear unsupported responses.

## Verification

1. Run dependency installation successfully.
2. Run syntax validation for all JavaScript files.
3. Start the API server and confirm `GET /health` returns success.
4. Start a WhatsApp session and confirm QR/status endpoints respond.
5. Scan QR and confirm session becomes `ready`.
6. Send text/media and verify webhook delivery when configured.

## Real Test Result — 2026-04-25

A live WhatsApp text-message integration test was executed successfully with the existing session lifecycle and messaging endpoints.

Test data:

```txt
sessionId: realtest-62895624273377
sender: 62895624273377@c.us
target input: +62 857-8302-4799
normalized target: 6285783024799@c.us
session status: ready
send endpoint: POST /sessions/:sessionId/messages/text
send response: HTTP 201
message id: true_6285783024799@c.us_3EB016E9DAF796C47C4CE9
```

Verified behavior:

1. API server health endpoint returned success.
2. Session start returned a QR login state.
3. QR scan authenticated the sender account.
4. Session status transitioned to `ready`.
5. The text-message endpoint sent a message to the normalized target chat ID.
6. Response confirmed `fromMe=true`, `hasMedia=false`, and sender/target chat IDs matched the expected values.

Notes:

- This test requires live WhatsApp connectivity and a user-scanned QR code; it is intentionally not part of automated `npm test`.
- Automated tests should continue to avoid QR scan and live WhatsApp dependencies unless explicitly requested.
- Future frontend real-test flows should display `qrDataUrl`, poll status until `ready`, and only enable sending after readiness is confirmed.
