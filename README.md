# WhatsApp API Interface

REST API dan webhook interface berbasis [`whatsapp-web.js`](https://github.com/wwebjs/whatsapp-web.js). Project ini menyediakan endpoint HTTP untuk mengelola session WhatsApp Web, QR authentication, pengiriman pesan, media, mentions, contacts, chats, groups, polls, dan webhook events.

> Catatan: `whatsapp-web.js` bukan client resmi WhatsApp. Gunakan secara bijak dan hindari automation agresif untuk mengurangi risiko limit atau pemblokiran akun.

## Fitur Utama

- Multi-session WhatsApp client berbasis `sessionId`
- QR authentication menggunakan `LocalAuth`
- Session lifecycle API: start, status, QR, logout, restart, destroy
- Send text message, reply, dan reaction
- Send media dari base64, URL, dan multipart upload
- Download media dari incoming message cache
- User mentions, group mentions, dan mention everyone di grup
- Contact info, profile picture, block/unblock, dan contact card
- Location message
- Chat info, mute, dan unmute
- Group join, invite, info, settings, participants, promote/demote
- Poll create dan vote berbasis runtime cache
- Webhook registration dengan file persistence
- Swagger/OpenAPI documentation
- API key middleware opsional
- Standardized success/error response
- Graceful shutdown untuk WhatsApp client

## Requirements

- Node.js 18 atau lebih baru
- NPM
- Chromium/Chrome dependency yang dibutuhkan Puppeteer
- WhatsApp mobile app untuk scan QR

Untuk server Linux/headless, konfigurasi Puppeteer sudah menggunakan argumen:

```txt
--no-sandbox
--disable-setuid-sandbox
```

Jika butuh dukungan video/GIF tertentu yang membutuhkan AAC/H.264, gunakan Google Chrome dan isi `CHROME_EXECUTABLE_PATH`.

## Instalasi

```bash
npm install
```

## Menjalankan Server

```bash
npm start
```

Default server berjalan di:

```txt
http://localhost:3000
```

## Script Tersedia

```bash
npm start
npm run check
npm test
```

Keterangan:

- `npm start`: menjalankan API server
- `npm run check`: menjalankan syntax check
- `npm test`: menjalankan check yang sama dengan `npm run check`

## Environment Variables

Buat file `.env` jika diperlukan.

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
API_CLIENT_STORE_FILE=data/api-clients.json
API_USAGE_LOG_FILE=data/api-usage.log
WEBHOOK_DELIVERY_LOG_FILE=data/webhook-deliveries.log
AUDIT_LOG_FILE=data/audit.log
```

### Penjelasan Penting

| Variable | Default | Keterangan |
|---|---:|---|
| `PORT` | `3000` | Port HTTP server |
| `API_KEY` | kosong | Legacy API key global. Masih didukung sebagai fallback, tetapi production disarankan memakai generated API client key |
| `ADMIN_API_KEY` | nilai `API_KEY` | Admin key untuk endpoint `/admin/*` seperti generate, rotate, revoke API client |
| `API_KEY_PEPPER` | nilai `API_KEY` atau development pepper | Secret pepper untuk hash API key client di storage |
| `DEFAULT_API_CLIENT_RATE_LIMIT_PER_MINUTE` | `60` | Default rate limit HTTP per generated API client |
| `CORS_ORIGIN` | `*` | Origin yang diizinkan, bisa comma-separated |
| `JSON_BODY_LIMIT` | `10mb` | Limit body JSON |
| `MEDIA_BODY_LIMIT` | `50mb` | Limit media body |
| `WWEBJS_AUTH_PATH` | `.wwebjs_auth` | Lokasi penyimpanan LocalAuth session |
| `PUPPETEER_HEADLESS` | `true` | Mode headless Puppeteer |
| `CHROME_EXECUTABLE_PATH` | kosong | Path Google Chrome opsional |
| `WEBHOOK_TIMEOUT_MS` | `10000` | Timeout webhook delivery |
| `WEBHOOK_RETRY_COUNT` | `3` | Jumlah retry webhook delivery |
| `UPLOAD_DIR` | `uploads` | Folder temporary upload |
| `DATA_DIR` | `data` | Folder data runtime |
| `WEBHOOK_STORE_FILE` | `data/webhooks.json` | File persistence webhook |
| `API_CLIENT_STORE_FILE` | `data/api-clients.json` | File persistence generated API client dan hash API key |
| `API_USAGE_LOG_FILE` | `data/api-usage.log` | File usage log request generated API client |
| `AUDIT_LOG_FILE` | `data/audit.log` | File audit log terstruktur untuk admin route dan protected API route |

## API Key

Ada dua jenis credential:

1. Admin key untuk dashboard/internal frontend:

```txt
x-admin-key: your-admin-secret
```

2. Client API key hasil generate untuk integrasi client eksternal:

```txt
x-api-key: wa_sk_live_cli_xxx_secret
```

`API_KEY` global masih didukung sebagai fallback legacy, tetapi untuk production disarankan menggunakan endpoint generate API client agar setiap client punya permission, allowed session, rate limit, dan audit log sendiri.

Contoh:

```bash
curl http://localhost:3000/sessions \
  -H "x-api-key: wa_sk_live_cli_xxx_secret"
```

### Generate API Client

Endpoint admin untuk frontend/dashboard:

```txt
POST /admin/api-clients
```

Header:

```txt
x-admin-key: your-admin-secret
```

Payload:

```json
{
  "name": "Client Toko A",
  "description": "Integrasi CRM Toko A",
  "allowedSessions": ["sales"],
  "scopes": ["sessions:read", "messages:send", "media:send"],
  "rateLimitPerMinute": 60,
  "expiresAt": "2026-12-31T23:59:59.000Z"
}
```

Response berisi `apiKey` mentah dan hanya ditampilkan sekali. Setelah itu server hanya menyimpan hash di `API_CLIENT_STORE_FILE`.

Endpoint admin lain:

```txt
GET   /admin/api-clients
GET   /admin/api-clients/:clientId
PATCH /admin/api-clients/:clientId
POST  /admin/api-clients/:clientId/revoke
POST  /admin/api-clients/:clientId/keys/rotate
GET   /admin/audit-logs
```

### Admin Audit Logs

Admin dapat membaca audit log terstruktur:

```txt
GET /admin/audit-logs?limit=100&actorId=cli_xxx&sessionId=default&action=messages:send&statusCode=201
```

Audit log disimpan sebagai JSON Lines di `AUDIT_LOG_FILE`. Field sensitif seperti `apiKey`, `secret`, `data`, `base64`, `password`, `token`, dan `keyHash` otomatis direduksi.

## Swagger Documentation

Swagger UI tersedia di:

```txt
http://localhost:3000/api-docs
```

Raw OpenAPI JSON tersedia di:

```txt
http://localhost:3000/api-docs.json
```

Dokumentasi Swagger mencakup endpoint session, messages, media, mentions, contacts, location, chats, groups, polls, webhooks, dan fitur unsupported/deprecated.

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {},
  "meta": {
    "timestamp": "2026-04-25T00:00:00.000Z"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": []
  },
  "meta": {
    "timestamp": "2026-04-25T00:00:00.000Z"
  }
}
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

Scan QR menggunakan aplikasi WhatsApp mobile.

### 4. Cek Status Session

```bash
curl http://localhost:3000/sessions/default/status \
  -H "x-api-key: your-secret-key"
```

Status yang umum:

```txt
initializing
qr
authenticated
ready
auth_failure
disconnected
destroyed
error
```

### 5. Kirim Pesan Teks

```bash
curl -X POST http://localhost:3000/sessions/default/messages/text \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-key" \
  -d '{
    "to": "6281234567890",
    "message": "Halo dari WhatsApp API"
  }'
```

## Endpoint Ringkas

### Health

```txt
GET /health
```

### Sessions

```txt
GET    /sessions
POST   /sessions/restore
POST   /sessions/terminate-all
POST   /sessions/:sessionId/start
GET    /sessions/:sessionId/status
GET    /sessions/:sessionId/health
GET    /sessions/:sessionId/screenshot
GET    /sessions/:sessionId/qr
POST   /sessions/:sessionId/logout
POST   /sessions/:sessionId/restart
POST   /sessions/:sessionId/recover
DELETE /sessions/:sessionId
```

### Messages

```txt
POST   /sessions/:sessionId/messages/text
POST   /sessions/:sessionId/messages/reply
POST   /sessions/:sessionId/messages/react
POST   /sessions/:sessionId/messages/:messageId/forward
PATCH  /sessions/:sessionId/messages/:messageId
DELETE /sessions/:sessionId/messages/:messageId
POST   /sessions/:sessionId/messages/:messageId/star
DELETE /sessions/:sessionId/messages/:messageId/star
GET    /sessions/:sessionId/messages/:messageId/quoted
POST   /sessions/:sessionId/messages/chats/:chatId/messages/fetch
POST   /sessions/:sessionId/messages/chats/:chatId/messages/search
POST   /sessions/:sessionId/messages/chats/:chatId/seen
POST   /sessions/:sessionId/messages/chats/:chatId/mark-unread
POST   /sessions/:sessionId/messages/chats/:chatId/presence/typing
POST   /sessions/:sessionId/messages/chats/:chatId/presence/recording
POST   /sessions/:sessionId/messages/chats/:chatId/presence/clear
POST   /sessions/:sessionId/messages/presence/available
POST   /sessions/:sessionId/messages/presence/unavailable
POST   /sessions/:sessionId/messages/buttons
POST   /sessions/:sessionId/messages/lists
```

`buttons` dan `lists` sengaja mengembalikan response deprecated karena fitur tersebut tidak didukung stabil oleh `whatsapp-web.js`.

### Media

```txt
POST /sessions/:sessionId/media/base64
POST /sessions/:sessionId/media/url
POST /sessions/:sessionId/media/upload
POST /sessions/:sessionId/media/sticker/base64
POST /sessions/:sessionId/media/sticker/url
GET  /sessions/:sessionId/media/:messageId/download
GET  /sessions/:sessionId/media/:messageId/download.bin
```

### Mentions

```txt
POST /sessions/:sessionId/mentions/users
POST /sessions/:sessionId/mentions/groups
```

### Contacts

```txt
GET   /sessions/:sessionId/contacts
POST  /sessions/:sessionId/contacts/card
POST  /sessions/:sessionId/contacts/check-registered
POST  /sessions/:sessionId/contacts/number-id
POST  /sessions/:sessionId/contacts/formatted-number
POST  /sessions/:sessionId/contacts/country-code
PATCH /sessions/:sessionId/contacts/profile/display-name
PATCH /sessions/:sessionId/contacts/profile/status
PUT   /sessions/:sessionId/contacts/profile/picture
DELETE /sessions/:sessionId/contacts/profile/picture
GET   /sessions/:sessionId/contacts/:contactId
GET   /sessions/:sessionId/contacts/:contactId/about
GET   /sessions/:sessionId/contacts/:contactId/common-groups
GET   /sessions/:sessionId/contacts/:contactId/profile-picture
POST  /sessions/:sessionId/contacts/:contactId/block
POST  /sessions/:sessionId/contacts/:contactId/unblock
```

### Location

```txt
POST /sessions/:sessionId/location
```

### Chats

```txt
GET    /sessions/:sessionId/chats
POST   /sessions/:sessionId/chats/search
GET    /sessions/:sessionId/chats/:chatId
POST   /sessions/:sessionId/chats/:chatId/mute
POST   /sessions/:sessionId/chats/:chatId/unmute
POST   /sessions/:sessionId/chats/:chatId/archive
POST   /sessions/:sessionId/chats/:chatId/unarchive
POST   /sessions/:sessionId/chats/:chatId/pin
POST   /sessions/:sessionId/chats/:chatId/unpin
POST   /sessions/:sessionId/chats/:chatId/clear
DELETE /sessions/:sessionId/chats/:chatId
```

### Groups

```txt
POST   /sessions/:sessionId/groups
POST   /sessions/:sessionId/groups/join
POST   /sessions/:sessionId/groups/invite-info
GET    /sessions/:sessionId/groups/:groupId
GET    /sessions/:sessionId/groups/:groupId/invite
DELETE /sessions/:sessionId/groups/:groupId/invite
POST   /sessions/:sessionId/groups/:groupId/leave
PUT    /sessions/:sessionId/groups/:groupId/picture
DELETE /sessions/:sessionId/groups/:groupId/picture
PATCH  /sessions/:sessionId/groups/:groupId/info
PATCH  /sessions/:sessionId/groups/:groupId/settings
POST   /sessions/:sessionId/groups/:groupId/participants
DELETE /sessions/:sessionId/groups/:groupId/participants/:participantId
POST   /sessions/:sessionId/groups/:groupId/participants/:participantId/promote
POST   /sessions/:sessionId/groups/:groupId/participants/:participantId/demote
GET    /sessions/:sessionId/groups/:groupId/membership-requests
POST   /sessions/:sessionId/groups/:groupId/membership-requests/approve
POST   /sessions/:sessionId/groups/:groupId/membership-requests/reject
POST   /sessions/:sessionId/groups/:groupId/mention-everyone
```

### Polls

```txt
POST /sessions/:sessionId/polls
POST /sessions/:sessionId/polls/:pollMessageId/vote
```

### Metrics dan Queue

```txt
GET  /metrics
GET  /sessions/:sessionId/queue
POST /sessions/:sessionId/queue/pause
POST /sessions/:sessionId/queue/resume
```

`/metrics` mengembalikan ringkasan runtime seperti uptime, status session, statistik queue, dan memory process. Endpoint queue dipakai untuk melihat atau mengontrol in-memory send queue per session.

### Webhooks

```txt
GET    /sessions/:sessionId/events

POST   /webhooks
GET    /webhooks
GET    /webhooks/:webhookId
PATCH  /webhooks/:webhookId
DELETE /webhooks/:webhookId
GET    /webhooks/:webhookId/deliveries
POST   /webhooks/deliveries/:deliveryId/retry
```

### Channels

```txt
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
```

Catatan: channel API memakai feature detection. Jika method belum tersedia di runtime `whatsapp-web.js` atau akun tidak punya permission, API mengembalikan `FEATURE_NOT_AVAILABLE`.

### Unsupported

```txt
ALL /sessions/:sessionId/communities/*
```

## Contoh Webhook

### Register Webhook

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

Webhook disimpan di file:

```txt
data/webhooks.json
```

### Event yang Didukung

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

Jika webhook memiliki `secret`, request webhook akan menyertakan header signature.

Webhook juga memiliki delivery log dan retry manual:

```bash
curl http://localhost:3000/webhooks/<webhookId>/deliveries \
  -H "x-api-key: your-secret-key"

curl -X POST http://localhost:3000/webhooks/deliveries/<deliveryId>/retry \
  -H "x-api-key: your-secret-key"
```

Untuk dashboard realtime, frontend dapat memakai Server-Sent Events:

```bash
curl -N http://localhost:3000/sessions/default/events \
  -H "x-api-key: your-secret-key"
```

Scope yang dibutuhkan:

```txt
events:read
webhooks:read
webhooks:create
webhooks:update
webhooks:delete
webhooks:retry
groups:membership:read
groups:membership:update
metrics:read
queue:read
queue:manage
```

## Contoh Send Media URL

```bash
curl -X POST http://localhost:3000/sessions/default/media/url \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-key" \
  -d '{
    "to": "6281234567890",
    "url": "https://example.com/file.pdf",
    "caption": "Dokumen dari API"
  }'
```

## Contoh Mention User

```bash
curl -X POST http://localhost:3000/sessions/default/mentions/users \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-key" \
  -d '{
    "to": "120363000000000000@g.us",
    "message": "Halo @6281234567890",
    "mentions": ["6281234567890"]
  }'
```

## Contoh Mention Everyone

```bash
curl -X POST http://localhost:3000/sessions/default/groups/120363000000000000@g.us/mention-everyone \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-key" \
  -d '{
    "messagePrefix": "Pengumuman:",
    "messageSuffix": "Mohon dibaca."
  }'
```

Gunakan endpoint ini secara hati-hati karena dapat mengirim mention ke seluruh peserta grup.

## ID Format

Format ID WhatsApp yang umum:

| Jenis | Format |
|---|---|
| Personal chat | `6281234567890@c.us` |
| Nomor mentah | `6281234567890` |
| Group chat | `120363xxxxxxxx@g.us` |

API menerima beberapa input nomor mentah dan akan menormalisasi ke format WhatsApp jika diperlukan.

## Data Persistence

### LocalAuth

Session WhatsApp disimpan oleh `LocalAuth` di folder:

```txt
.wwebjs_auth
```

Pastikan folder ini persistent agar tidak perlu scan QR ulang setelah restart.

### Webhooks

Webhook tersimpan di:

```txt
data/webhooks.json
```

## Testing

Jalankan:

```bash
npm test
```

Saat ini test menjalankan syntax check:

```bash
npm run check
```

## Production Notes

Rekomendasi sebelum production:

- Isi `API_KEY`
- Gunakan HTTPS/reverse proxy
- Persist folder `.wwebjs_auth`
- Batasi `CORS_ORIGIN`
- Tambahkan rate limit dan queue untuk pengiriman pesan massal
- Hindari broadcast agresif
- Gunakan database untuk message metadata, API usage log, dan audit log jika diperlukan
- Deploy dengan Docker Compose bisa memakai `Dockerfile`, `docker-compose.yml`, `.dockerignore`, dan `.env.example` yang tersedia di root project
- Pertimbangkan `RemoteAuth` jika filesystem server tidak persistent
- Jalankan dengan process manager seperti PM2, systemd, atau Docker

## Troubleshooting

### QR Tidak Muncul

- Pastikan session sudah distart.
- Cek endpoint `/sessions/:sessionId/status`.
- Jika status `ready`, QR tidak diperlukan lagi.

### Session Tidak Ready

- Pastikan QR sudah discan.
- Cek koneksi internet server.
- Cek log Puppeteer/Chromium.

### Chromium Gagal Start di Linux

- Pastikan dependency OS Chromium/Chrome terinstall.
- Pastikan sandbox args aktif.
- Jika memakai Chrome custom, isi `CHROME_EXECUTABLE_PATH`.

### Webhook Hilang Setelah Restart

- Pastikan `DATA_DIR` bisa ditulis.
- Pastikan `WEBHOOK_STORE_FILE` mengarah ke lokasi persistent.

## License

ISC
