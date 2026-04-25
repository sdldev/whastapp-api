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
- Swagger/OpenAPI documentation, aktif default hanya di non-production
- Generated API client dengan scopes, allowed sessions, rate limit, dan audit log
- Outbound URL hardening untuk webhook/media URL
- Bounded send queue, bounded webhook delivery queue, message cache TTL/LRU, dan JSONL log rotation
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
http://localhost:7000
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
PORT=7000
API_KEY=your-legacy-secret-key
ADMIN_API_KEY=your-admin-secret
ALLOW_ANONYMOUS_ACCESS=false
ENABLE_LEGACY_API_KEY=true
ENABLE_API_DOCS=true
EXPOSE_HEALTH_SESSION_IDS=false
API_KEY_PEPPER=your-key-hash-pepper
DEFAULT_API_CLIENT_RATE_LIMIT_PER_MINUTE=60
CORS_ORIGIN=*
JSON_BODY_LIMIT=10mb
MEDIA_BODY_LIMIT=50mb
UPLOAD_MAX_BYTES=52428800
UPLOAD_ALLOWED_MIME_TYPES=image/png,image/jpeg,image/webp,application/pdf
OUTBOUND_URL_ALLOWED_HOSTS=
ALLOW_PRIVATE_OUTBOUND_URLS=false
WWEBJS_AUTH_PATH=.wwebjs_auth
PUPPETEER_HEADLESS=true
CHROME_EXECUTABLE_PATH=
WEBHOOK_TIMEOUT_MS=10000
WEBHOOK_RETRY_COUNT=3
WEBHOOK_DELIVERY_CONCURRENCY=5
WEBHOOK_DELIVERY_MAX_QUEUE=1000
WEBHOOK_MAX_CONSECUTIVE_FAILURES=10
SEND_MESSAGE_DELAY_MS=5000
SEND_QUEUE_MAX_PENDING_PER_SESSION=100
MESSAGE_CACHE_MAX_ENTRIES=1000
MESSAGE_CACHE_TTL_MS=3600000
SESSION_INITIALIZE_TIMEOUT_MS=120000
SESSION_RESTORE_CONCURRENCY=2
JSONL_LOG_MAX_BYTES=10485760
JSONL_LOG_MAX_BACKUP_FILES=5
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
- `ALLOW_ANONYMOUS_ACCESS=false` harus dipertahankan di production; protected route menolak request tanpa `x-api-key`.
- `ENABLE_LEGACY_API_KEY=false` disarankan di production agar legacy `API_KEY` tidak bypass scope/allowed session/rate limit.
- `ENABLE_API_DOCS=false` membuat `/api-docs` dan `/api-docs.json` nonaktif di production secara default.
- `EXPOSE_HEALTH_SESSION_IDS=false` mencegah `/health/ready` mengekspos daftar session ID.
- `ADMIN_API_KEY` digunakan frontend/dashboard untuk generate, rotate, update, dan revoke API client; tidak fallback ke `API_KEY`.
- Generated API key client memakai header `x-api-key`, dibatasi oleh scope, allowed session, dan rate limit per menit.
- `OUTBOUND_URL_ALLOWED_HOSTS` dan `ALLOW_PRIVATE_OUTBOUND_URLS=false` mengontrol hardening SSRF untuk webhook/media URL.
- `UPLOAD_MAX_BYTES` dan `UPLOAD_ALLOWED_MIME_TYPES` membatasi upload multipart.
- `WEBHOOK_DELIVERY_CONCURRENCY`, `WEBHOOK_DELIVERY_MAX_QUEUE`, dan `WEBHOOK_MAX_CONSECUTIVE_FAILURES` membatasi webhook delivery target lambat/down.
- `SEND_QUEUE_MAX_PENDING_PER_SESSION` menolak request dengan `SEND_QUEUE_FULL` saat pending send queue penuh.
- `MESSAGE_CACHE_MAX_ENTRIES` dan `MESSAGE_CACHE_TTL_MS` membatasi runtime message cache.
- `SESSION_INITIALIZE_TIMEOUT_MS` dan `SESSION_RESTORE_CONCURRENCY` mencegah start/restore session menggantung tanpa kontrol.
- `JSONL_LOG_MAX_BYTES` dan `JSONL_LOG_MAX_BACKUP_FILES` mengontrol rotasi audit/usage/webhook delivery log.
- Audit log terstruktur disimpan di `AUDIT_LOG_FILE` dan dapat dibaca oleh admin melalui `GET /admin/audit-logs`.
- `API_KEY` masih bisa dipakai sebagai legacy global key jika diaktifkan, tetapi production disarankan memakai generated API client key.
- Folder `.wwebjs_auth` harus persistent agar tidak perlu scan QR ulang setelah restart.

## Endpoint Publik

Endpoint berikut tidak membutuhkan API key:

```txt
GET /health
GET /health/ready
```

`/api-docs` dan `/api-docs.json` hanya aktif bila `ENABLE_API_DOCS=true`. Di production, docs default nonaktif.

## Swagger

Swagger UI tersedia bila `ENABLE_API_DOCS=true`:

```txt
http://localhost:7000/api-docs
```

OpenAPI JSON:

```txt
http://localhost:7000/api-docs.json
```

Di production, `ENABLE_API_DOCS` default `false`.

## API Key

Header:

```txt
x-api-key: your-secret-key
```

Contoh:

```bash
curl http://localhost:7000/sessions \
  -H "x-api-key: your-secret-key"
```

## Basic Flow

### 1. Health Check

```bash
curl http://localhost:7000/health
```

### 2. Start Session

```bash
curl -X POST http://localhost:7000/sessions/default/start \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-key" \
  -d '{}'
```

### 3. Ambil QR

```bash
curl http://localhost:7000/sessions/default/qr \
  -H "x-api-key: your-secret-key"
```

### 4. Cek Status

```bash
curl http://localhost:7000/sessions/default/status \
  -H "x-api-key: your-secret-key"
```

### 5. Kirim Pesan

```bash
curl -X POST http://localhost:7000/sessions/default/messages/text \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-key" \
  -d '{
    "to": "6281234567890",
    "message": "Halo dari WhatsApp API"
  }'
```

### 6. Real Test Pengiriman

Real test live yang berhasil diverifikasi pada 2026-04-25:

```txt
sessionId: realtest-62895624273377
from: 62895624273377@c.us
to: 6285783024799@c.us
status: ready
send response: HTTP 201
message id: true_6285783024799@c.us_3EB016E9DAF796C47C4CE9
```

Contoh request:

```bash
curl -X POST http://localhost:7000/sessions/realtest-62895624273377/messages/text \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-key" \
  -d '{
    "to": "+62 857-8302-4799",
    "message": "Real test WhatsApp API"
  }'
```

Pastikan session sudah `ready` sebelum request kirim pesan dijalankan.

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
curl -X POST http://localhost:7000/webhooks \
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

Log JSONL audit/usage/webhook delivery dirotasi berdasarkan `JSONL_LOG_MAX_BYTES` dan `JSONL_LOG_MAX_BACKUP_FILES`.

## Testing

```bash
npm test
```

## Production Checklist Singkat

- Isi `ADMIN_API_KEY` yang berbeda dari legacy/API client key
- Set `ALLOW_ANONYMOUS_ACCESS=false`
- Set `ENABLE_LEGACY_API_KEY=false` jika sudah memakai generated API client
- Set `ENABLE_API_DOCS=false` atau batasi docs lewat network/admin environment
- Set `EXPOSE_HEALTH_SESSION_IDS=false`
- Batasi `CORS_ORIGIN`
- Konfigurasi `OUTBOUND_URL_ALLOWED_HOSTS` untuk webhook/media target terpercaya bila memungkinkan
- Pastikan `ALLOW_PRIVATE_OUTBOUND_URLS=false`
- Batasi `UPLOAD_MAX_BYTES` dan `UPLOAD_ALLOWED_MIME_TYPES`
- Sesuaikan `WEBHOOK_DELIVERY_CONCURRENCY`, `WEBHOOK_DELIVERY_MAX_QUEUE`, dan `SEND_QUEUE_MAX_PENDING_PER_SESSION`
- Sesuaikan `MESSAGE_CACHE_MAX_ENTRIES`, `MESSAGE_CACHE_TTL_MS`, dan JSONL log rotation
- Gunakan HTTPS/reverse proxy
- Persist `.wwebjs_auth`
- Persist `data/webhooks.json` dan data store runtime
- Monitor session status, queue, webhook delivery, message cache, dan disk log
- Hindari broadcast agresif
- Gunakan queue/persistence eksternal jika multi-instance
