# WhatsApp API Interface - Ringkasan Dokumentasi

Dokumen ini adalah ringkasan cepat untuk menjalankan dan menggunakan WhatsApp API Interface berbasis `whatsapp-web.js`.

## Overview

Aplikasi ini menyediakan REST API dan webhook interface untuk mengelola WhatsApp Web melalui `whatsapp-web.js`.

Fitur utama:

- Multi-session WhatsApp client berbasis `sessionId`
- QR authentication dengan `LocalAuth`
- Send text, reply, reaction
- Send media dari base64, URL, dan upload
- Mentions user/group dan mention everyone
- Contact info, profile picture, block/unblock, contact card
- Location, chat info, mute/unmute
- Group management
- Poll create dan vote
- Webhook events dengan persistence file
- Swagger/OpenAPI documentation
- API key protection
- Delay pengiriman minimal 5 detik per session

## Requirements

- Node.js 18+
- NPM
- Chromium/Chrome dependency untuk Puppeteer
- WhatsApp mobile app untuk scan QR

## Instalasi

```bash
npm install
```

## Menjalankan Server

```bash
npm start
```

Default URL:

```txt
http://localhost:3000
```

## Script

```bash
npm start
npm run check
npm test
```

## Environment Variables

Contoh `.env`:

```env
NODE_ENV=development
PORT=3000
API_KEY=your-secret-key
ADMIN_API_KEY=your-admin-secret
API_KEY_PEPPER=your-key-hash-pepper
DEFAULT_API_CLIENT_RATE_LIMIT_PER_MINUTE=60
CORS_ORIGIN=*
JSON_BODY_LIMIT=10mb
MEDIA_BODY_LIMIT=50mb
WWEBJS_AUTH_PATH=.wwebjs_auth
PUPPETEER_HEADLESS=true
CHROME_EXECUTABLE_PATH=
WEBHOOK_TIMEOUT_MS=10000
WEBHOOK_RETRY_COUNT=3
SEND_MESSAGE_DELAY_MS=5000
UPLOAD_DIR=uploads
DATA_DIR=data
WEBHOOK_STORE_FILE=data/webhooks.json
WEBHOOK_DELIVERY_LOG_FILE=data/webhook-deliveries.log
API_CLIENT_STORE_FILE=data/api-clients.json
API_USAGE_LOG_FILE=data/api-usage.log
AUDIT_LOG_FILE=data/audit.log
```

Catatan:

- `SEND_MESSAGE_DELAY_MS` dipaksa minimal `5000`, sehingga pengiriman pesan per session tidak bisa lebih cepat dari 5 detik.
- `ADMIN_API_KEY` digunakan frontend/dashboard untuk generate, rotate, update, dan revoke API client.
- Generated API key client memakai header `x-api-key`, dibatasi oleh scope, allowed session, dan rate limit per menit.
- Audit log terstruktur disimpan di `AUDIT_LOG_FILE` dan dapat dibaca oleh admin melalui `GET /admin/audit-logs`.
- `API_KEY` masih bisa dipakai sebagai legacy global key, tetapi production disarankan memakai generated API client key.
- Folder `.wwebjs_auth` harus persistent agar tidak perlu scan QR ulang setelah restart.

## Endpoint Publik

Endpoint berikut tidak membutuhkan API key:

```txt
GET /health
GET /api-docs
GET /api-docs.json
```

## Swagger

Swagger UI:

```txt
http://localhost:3000/api-docs
```

OpenAPI JSON:

```txt
http://localhost:3000/api-docs.json
```

## API Key

Header:

```txt
x-api-key: your-secret-key
```

Contoh:

```bash
curl http://localhost:3000/sessions \
  -H "x-api-key: your-secret-key"
```

## Basic Flow

### 1. Health Check

```bash
curl http://localhost:3000/health
```

### 2. Start Session

```bash
curl -X POST http://localhost:3000/sessions/default/start \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-key" \
  -d '{}'
```

### 3. Ambil QR

```bash
curl http://localhost:3000/sessions/default/qr \
  -H "x-api-key: your-secret-key"
```

### 4. Cek Status

```bash
curl http://localhost:3000/sessions/default/status \
  -H "x-api-key: your-secret-key"
```

### 5. Kirim Pesan

```bash
curl -X POST http://localhost:3000/sessions/default/messages/text \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-key" \
  -d '{
    "to": "6281234567890",
    "message": "Halo dari WhatsApp API"
  }'
```

## Ringkasan Endpoint

### Sessions

```txt
GET    /sessions
POST   /sessions/:sessionId/start
GET    /sessions/:sessionId/status
GET    /sessions/:sessionId/qr
POST   /sessions/:sessionId/logout
POST   /sessions/:sessionId/restart
DELETE /sessions/:sessionId
```

### Messages

```txt
POST /sessions/:sessionId/messages/text
POST /sessions/:sessionId/messages/reply
POST /sessions/:sessionId/messages/react
POST /sessions/:sessionId/messages/buttons
POST /sessions/:sessionId/messages/lists
```

### Media

```txt
POST /sessions/:sessionId/media/base64
POST /sessions/:sessionId/media/url
POST /sessions/:sessionId/media/upload
GET  /sessions/:sessionId/media/:messageId/download
```

### Mentions

```txt
POST /sessions/:sessionId/mentions/users
POST /sessions/:sessionId/mentions/groups
POST /sessions/:sessionId/groups/:groupId/mention-everyone
```

### Contacts

```txt
POST /sessions/:sessionId/contacts/card
GET  /sessions/:sessionId/contacts/:contactId
GET  /sessions/:sessionId/contacts/:contactId/profile-picture
POST /sessions/:sessionId/contacts/:contactId/block
POST /sessions/:sessionId/contacts/:contactId/unblock
```

### Chats, Groups, Channels, Polls, Webhooks

```txt
POST /sessions/:sessionId/location
GET  /sessions/:sessionId/chats/:chatId
POST /sessions/:sessionId/chats/:chatId/mute
POST /sessions/:sessionId/chats/:chatId/unmute

POST   /sessions/:sessionId/groups/join
GET    /sessions/:sessionId/groups/:groupId
GET    /sessions/:sessionId/groups/:groupId/invite
PATCH  /sessions/:sessionId/groups/:groupId/info
PATCH  /sessions/:sessionId/groups/:groupId/settings
POST   /sessions/:sessionId/groups/:groupId/participants
DELETE /sessions/:sessionId/groups/:groupId/participants/:participantId
POST   /sessions/:sessionId/groups/:groupId/participants/:participantId/promote
POST   /sessions/:sessionId/groups/:groupId/participants/:participantId/demote

GET    /sessions/:sessionId/channels
POST   /sessions/:sessionId/channels/search
GET    /sessions/:sessionId/channels/:channelId
POST   /sessions/:sessionId/channels/:channelId/messages
GET    /sessions/:sessionId/channels/:channelId/messages
POST   /sessions/:sessionId/channels/:channelId/seen
POST   /sessions/:sessionId/channels/:channelId/mute
POST   /sessions/:sessionId/channels/:channelId/unmute
PATCH  /sessions/:sessionId/channels/:channelId/info
PUT    /sessions/:sessionId/channels/:channelId/picture
PATCH  /sessions/:sessionId/channels/:channelId/reaction-setting
POST   /sessions/:sessionId/channels/:channelId/admin-invites/accept
POST   /sessions/:sessionId/channels/:channelId/admin-invites/:userId
DELETE /sessions/:sessionId/channels/:channelId/admin-invites/:userId
POST   /sessions/:sessionId/channels/:channelId/ownership/transfer/:userId
POST   /sessions/:sessionId/channels/:channelId/admins/:userId/demote
GET    /sessions/:sessionId/channels/:channelId/subscribers
DELETE /sessions/:sessionId/channels/:channelId

POST /sessions/:sessionId/polls
POST /sessions/:sessionId/polls/:pollMessageId/vote

GET    /sessions/:sessionId/events

POST   /webhooks
GET    /webhooks
GET    /webhooks/:webhookId
PATCH  /webhooks/:webhookId
DELETE /webhooks/:webhookId
GET    /webhooks/:webhookId/deliveries
POST   /webhooks/deliveries/:deliveryId/retry
```

## Webhook Events

Event yang didukung:

```txt
session.qr
session.authenticated
session.ready
session.auth_failure
session.disconnected
message.received
message.created
message.media
message.location
message.reaction
```

Register webhook:

```bash
curl -X POST http://localhost:3000/webhooks \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-key" \
  -d '{
    "url": "https://example.com/whatsapp/webhook",
    "events": ["message.received", "session.ready"],
    "secret": "webhook-secret"
  }'
```

## Data Persistence

- WhatsApp LocalAuth: `.wwebjs_auth`
- Webhook store: `data/webhooks.json`
- Webhook delivery log: `data/webhook-deliveries.log`
- Generated API clients: `data/api-clients.json`
- API usage log: `data/api-usage.log`
- Audit log terstruktur: `data/audit.log`
- Upload temporary: `uploads`

## Testing

```bash
npm test
```

## Production Checklist Singkat

- Isi `API_KEY`
- Batasi `CORS_ORIGIN`
- Gunakan HTTPS/reverse proxy
- Persist `.wwebjs_auth`
- Persist `data/webhooks.json`
- Monitor session status
- Hindari broadcast agresif
- Gunakan queue/persistence eksternal jika multi-instance
