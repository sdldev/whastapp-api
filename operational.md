# Operational Guide - WhatsApp API Interface

Dokumen ini berisi panduan operasional untuk menjalankan, mengamankan, memonitor, dan melakukan troubleshooting WhatsApp API Interface berbasis `whatsapp-web.js`.

## 1. Tujuan Operasional

Tujuan operasional service ini adalah menyediakan API WhatsApp Web yang stabil untuk:

- Mengelola session WhatsApp
- Menampilkan QR login
- Mengirim dan menerima pesan
- Mengirim media dan fitur WhatsApp lain
- Mengirim event ke webhook downstream

Service bersifat stateful karena setiap WhatsApp session menjalankan client berbasis Puppeteer/Chromium.

## 2. Komponen Runtime

Komponen utama:

| Komponen | Fungsi |
|---|---|
| Node.js API server | Menyediakan REST API dan Swagger UI |
| Express routes | Menangani endpoint `/sessions`, `/messages`, `/media`, `/webhooks`, dan lainnya |
| whatsapp-web.js client | Mengontrol WhatsApp Web session |
| Puppeteer/Chromium | Browser automation untuk WhatsApp Web |
| LocalAuth storage | Menyimpan credential session WhatsApp |
| Webhook file store | Menyimpan konfigurasi webhook |
| In-memory message cache | Menyimpan message object untuk reply, reaction, media download, vote poll |
| In-memory send queue | Menjaga delay minimal 5 detik pengiriman pesan per session |

## 3. Requirements Server

Minimum:

- Linux server
- Node.js 18+
- NPM
- RAM cukup untuk Chromium/Puppeteer
- Persistent disk untuk `.wwebjs_auth`
- Outbound internet access ke WhatsApp Web dan webhook target

Untuk production, disarankan:

- Reverse proxy dengan HTTPS
- Process manager seperti PM2, systemd, Docker, atau supervisor lain
- Monitoring process dan disk
- Backup folder auth

## 4. Environment Variables

Contoh `.env` production:

```env
NODE_ENV=production
PORT=3000
API_KEY=replace-with-legacy-fallback-secret
ADMIN_API_KEY=replace-with-admin-dashboard-secret
API_KEY_PEPPER=replace-with-api-key-hash-pepper
DEFAULT_API_CLIENT_RATE_LIMIT_PER_MINUTE=60
CORS_ORIGIN=https://dashboard.example.com
JSON_BODY_LIMIT=10mb
MEDIA_BODY_LIMIT=50mb
WWEBJS_AUTH_PATH=.wwebjs_auth
PUPPETEER_HEADLESS=true
CHROME_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
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

- `SEND_MESSAGE_DELAY_MS` selalu minimal 5000ms.
- `ADMIN_API_KEY` wajib diisi untuk dashboard/admin endpoint `/admin/*`.
- `API_KEY_PEPPER` wajib stabil dan rahasia karena dipakai untuk hash generated API key.
- `API_KEY` hanya fallback legacy; gunakan generated API client key untuk integrasi client.
- `CORS_ORIGIN` sebaiknya tidak memakai `*` di production.
- `WWEBJS_AUTH_PATH` harus berada pada disk persistent.

## 5. Startup Procedure

### 5.1 Install Dependency

```bash
npm install
```

### 5.2 Validasi Syntax

```bash
npm run check
```

### 5.3 Jalankan Server

```bash
npm start
```

### 5.4 Verifikasi Health

```bash
curl http://localhost:3000/health
```

### 5.5 Verifikasi Swagger

```txt
http://localhost:3000/api-docs
```

## 6. Session Operation

### 6.1 Start Session

```bash
curl -X POST http://localhost:3000/sessions/default/start \
  -H "Content-Type: application/json" \
  -H "x-api-key: replace-with-long-random-secret" \
  -d '{}'
```

### 6.2 Ambil QR

```bash
curl http://localhost:3000/sessions/default/qr \
  -H "x-api-key: replace-with-long-random-secret"
```

Scan QR dari WhatsApp mobile.

### 6.3 Cek Status

```bash
curl http://localhost:3000/sessions/default/status \
  -H "x-api-key: replace-with-long-random-secret"
```

Status yang diharapkan setelah login:

```txt
ready
```

Status lain yang mungkin muncul:

```txt
initializing
qr
authenticated
auth_failure
disconnected
destroyed
error
```

## 7. Shutdown Procedure

Aplikasi memiliki graceful shutdown untuk menutup client WhatsApp ketika menerima signal:

```txt
SIGINT
SIGTERM
```

Jika menggunakan process manager, pastikan process diberi waktu cukup untuk shutdown.

Urutan shutdown yang diharapkan:

1. Stop menerima request baru.
2. Destroy semua WhatsApp client.
3. Tutup browser/Puppeteer.
4. Process exit.

## 8. Security Operation

### 8.1 API Key

Production wajib mengisi:

```env
API_KEY=replace-with-long-random-secret
```

Semua endpoint protected wajib memakai:

```txt
x-api-key: replace-with-long-random-secret
```

Endpoint tanpa API key:

```txt
GET /health
GET /api-docs
GET /api-docs.json
```

### 8.2 CORS

Production sebaiknya membatasi origin:

```env
CORS_ORIGIN=https://dashboard.example.com
```

Jika lebih dari satu:

```env
CORS_ORIGIN=https://dashboard.example.com,https://admin.example.com
```

### 8.3 Reverse Proxy dan HTTPS

Gunakan Nginx, Caddy, Traefik, atau load balancer untuk TLS.

Contoh mapping:

```txt
https://whatsapp-api.example.com -> http://127.0.0.1:3000
```

### 8.4 Payload Limit

Gunakan limit body:

```env
JSON_BODY_LIMIT=10mb
MEDIA_BODY_LIMIT=50mb
```

Hindari menaikkan limit terlalu besar tanpa monitoring memory.

## 9. Send Rate Control

Service menerapkan delay minimal 5 detik per session untuk operasi pengiriman pesan.

Operasi yang terkena delay:

- Send text
- Reply
- Send media base64
- Send media URL
- Send media upload
- Mention users
- Mention groups
- Send contact card
- Send location
- Mention everyone
- Create poll

Contoh perilaku untuk session `default`:

```txt
T+0s   pesan 1 dikirim
T+5s   pesan 2 dikirim
T+10s  pesan 3 dikirim
```

Session berbeda berjalan independen:

```txt
default  -> delay sendiri
sales    -> delay sendiri
support  -> delay sendiri
```

Catatan:

- Queue saat ini in-memory.
- Jika process restart, queue hilang.
- Jika multi-instance, gunakan Redis/BullMQ agar delay konsisten lintas instance.

## 10. Webhook Operation

### 10.1 Register Webhook

```bash
curl -X POST http://localhost:3000/webhooks \
  -H "Content-Type: application/json" \
  -H "x-api-key: replace-with-long-random-secret" \
  -d '{
    "url": "https://example.com/whatsapp/webhook",
    "events": ["message.received", "session.ready"],
    "secret": "webhook-secret"
  }'
```

### 10.2 Webhook Store

Webhook disimpan di:

```txt
data/webhooks.json
```

Pastikan folder `data` bisa ditulis dan persistent.

### 10.3 Event yang Didukung

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

### 10.4 Webhook Retry

Konfigurasi:

```env
WEBHOOK_TIMEOUT_MS=10000
WEBHOOK_RETRY_COUNT=3
```

Jika target webhook gagal, service akan retry sesuai konfigurasi dan menulis delivery log.

Delivery log dapat dicek dan diretry manual:

```bash
curl http://localhost:3000/webhooks/<webhookId>/deliveries \
  -H "x-api-key: replace-with-client-api-key"

curl -X POST http://localhost:3000/webhooks/deliveries/<deliveryId>/retry \
  -H "x-api-key: replace-with-client-api-key"
```

Webhook yang dibuat oleh generated API client memiliki `ownerClientId`, sehingga client lain tidak dapat membaca/mengubah webhook tersebut.

### 10.5 Realtime SSE untuk Dashboard

Endpoint:

```txt
GET /sessions/:sessionId/events
```

Kegunaan:

- QR/status session realtime.
- Incoming message realtime.
- Media/location/reaction event realtime.

Syarat:

- Header `x-api-key` valid.
- Scope `events:read`.
- `sessionId` termasuk `allowedSessions` client.

## 11. Data Persistence dan Backup

### 11.1 Folder Penting

| Path | Fungsi | Harus Persistent |
|---|---|---|
| `.wwebjs_auth` | Session LocalAuth WhatsApp | Ya |
| `data/webhooks.json` | Webhook registration | Ya |
| `data/webhook-deliveries.log` | Webhook delivery log/retry payload | Ya |
| `data/api-clients.json` | Generated API clients dan hashed keys | Ya |
| `data/api-usage.log` | API usage log per generated API client | Ya |
| `data/audit.log` | Audit log terstruktur untuk admin/protected API | Ya |
| `uploads` | Temporary upload | Tidak wajib, tetapi harus writable |

### 11.2 Backup

Backup berkala:

```txt
.wwebjs_auth
data/webhooks.json
```

Jika `.wwebjs_auth` hilang, user harus scan QR ulang.

## 12. Monitoring Checklist

Monitor:

- Process Node.js hidup atau tidak
- Memory usage
- CPU usage
- Disk usage folder `.wwebjs_auth`
- Jumlah Chromium process
- Status session WhatsApp
- Webhook delivery failure
- Error log Puppeteer
- Latency endpoint send message

Endpoint dasar:

```txt
GET /health
GET /sessions/:sessionId/status
```

## 13. Common Operational Tasks

### 13.1 Restart Session

```bash
curl -X POST http://localhost:3000/sessions/default/restart \
  -H "x-api-key: replace-with-long-random-secret"
```

### 13.2 Logout Session

```bash
curl -X POST http://localhost:3000/sessions/default/logout \
  -H "x-api-key: replace-with-long-random-secret"
```

### 13.3 Destroy Session Runtime

```bash
curl -X DELETE http://localhost:3000/sessions/default \
  -H "x-api-key: replace-with-long-random-secret"
```

### 13.4 List Sessions

```bash
curl http://localhost:3000/sessions \
  -H "x-api-key: replace-with-long-random-secret"
```

## 14. Troubleshooting

### 14.1 QR Tidak Tersedia

Kemungkinan:

- Session belum distart.
- Client masih initializing.
- Session sudah ready sehingga QR tidak diperlukan.

Langkah:

```bash
curl http://localhost:3000/sessions/default/status \
  -H "x-api-key: replace-with-long-random-secret"
```

### 14.2 Session Sering Logout

Kemungkinan:

- Folder `.wwebjs_auth` tidak persistent.
- WhatsApp mendeteksi login abnormal.
- Session dipakai di environment berbeda.
- Browser crash.

Mitigasi:

- Persist `.wwebjs_auth`.
- Hindari restart terlalu sering.
- Hindari traffic pengiriman agresif.
- Pantau log `auth_failure` dan `disconnected`.

### 14.3 Chromium Gagal Start

Kemungkinan:

- Dependency OS belum lengkap.
- Chrome executable path salah.
- Permission sandbox bermasalah.

Mitigasi:

- Install dependency Chromium/Chrome.
- Set `CHROME_EXECUTABLE_PATH` jika memakai Google Chrome.
- Pastikan args no-sandbox aktif.

### 14.4 Send Message Lambat

Ini bisa normal karena ada delay minimal 5 detik per session.

Jika banyak request masuk untuk session yang sama, request akan menunggu queue.

Mitigasi:

- Gunakan beberapa session untuk beban berbeda.
- Jangan menurunkan `SEND_MESSAGE_DELAY_MS` di bawah 5000 karena aplikasi memaksa minimum 5 detik.
- Untuk production besar, gunakan async job queue.

### 14.5 Queue Status dan Metrics

Endpoint operasional yang tersedia:

```txt
GET  /metrics
GET  /sessions/:sessionId/queue
POST /sessions/:sessionId/queue/pause
POST /sessions/:sessionId/queue/resume
```

Gunakan `/metrics` untuk melihat ringkasan session, queue, dan memory process. Gunakan endpoint queue untuk pause/resume pengiriman WhatsApp per session ketika ada incident atau maintenance.

Scope generated API client yang dibutuhkan:

```txt
metrics:read
queue:read
queue:manage
```

Catatan: queue saat ini masih in-memory. Jika process restart, status pause dan chain queue hilang. Untuk multi-instance, gunakan Redis/BullMQ.

### 14.6 Reply atau Download Media Gagal

Reply, reaction, download media, dan vote poll bergantung pada message object yang masih ada di runtime cache.

Jika server restart, runtime cache hilang.

Mitigasi production:

- Simpan message metadata ke database.
- Implementasi fetch chat history jika diperlukan.

### 14.7 Webhook Tidak Terkirim

Periksa:

- URL webhook bisa diakses dari server.
- Target menerima POST JSON.
- Timeout cukup.
- Log error webhook.
- `data/webhooks.json` berisi webhook aktif.

## 15. Deployment Notes

### 15.1 Single Instance

Mode yang direkomendasikan saat ini:

```txt
1 API server process
1 persistent disk
multiple WhatsApp sessions
```

### 15.2 Docker Compose

Project menyediakan file deployment dasar:

```txt
Dockerfile
docker-compose.yml
.dockerignore
.env.example
```

Langkah umum:

```bash
cp .env.example .env
docker compose up --build -d
```

Pastikan volume untuk `.wwebjs_auth`, `data`, `uploads`, dan logs tetap persistent agar session, generated API client, webhook, dan delivery log tidak hilang saat container restart.

### 15.3 Channel Operations

Channel API tersedia untuk list/search/read/send/admin operation. Semua endpoint channel memakai feature detection. Jika method tidak tersedia di versi `whatsapp-web.js` atau akun tidak punya permission, API akan mengembalikan `FEATURE_NOT_AVAILABLE`.

Scope penting:

```txt
channels:read
channels:send
channels:update
channels:admin
channels:delete
```

### 15.4 Multi-instance

Belum disarankan tanpa perubahan tambahan.

Risiko multi-instance:

- Session yang sama bisa dijalankan di lebih dari satu process.
- Queue 5 detik hanya in-memory per process.
- Runtime message cache tidak shared.
- Webhook store file bisa conflict.

Jika butuh multi-instance, tambahkan:

- Distributed lock per session
- Redis/BullMQ untuk queue
- Database untuk webhook dan message metadata
- RemoteAuth untuk session persistence cloud

## 16. Incident Response

### 16.1 API Down

Langkah:

1. Cek process manager.
2. Cek log aplikasi.
3. Jalankan `npm run check` jika ada perubahan kode.
4. Restart process.
5. Verifikasi `/health`.

### 16.2 WhatsApp Session Down

Langkah:

1. Cek `/sessions/:sessionId/status`.
2. Jika `disconnected`, coba restart session.
3. Jika butuh QR, scan ulang.
4. Periksa apakah `.wwebjs_auth` masih ada.

### 16.3 Webhook Failure Massal

Langkah:

1. Cek target webhook downstream.
2. Cek network/DNS/TLS.
3. Naikkan timeout sementara jika perlu.
4. Periksa retry count.
5. Pertimbangkan dead-letter queue untuk production.

## 17. Production Improvement Roadmap

Prioritas lanjutan:

1. `express-rate-limit` untuk HTTP request limiting.
2. Redis/BullMQ untuk durable send queue.
3. Database untuk webhook config dan message metadata.
4. Audit log untuk operasi sensitif.
5. Metrics endpoint untuk Prometheus.
6. RemoteAuth jika deployment di cloud/container ephemeral.
7. Dead-letter storage untuk webhook gagal.
8. Dashboard realtime via WebSocket/SSE.
