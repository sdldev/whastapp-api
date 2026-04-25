# WhatsApp API Production Readiness Plan

Tanggal: 2026-04-25
Status: Draft eksekusi bertahap
Target: membuat environment dan implementasi semakin mendekati production nyata.

## Cara Memakai File Ini

File ini adalah living plan. Setiap perubahan kode yang berkaitan dengan production readiness harus memperbarui bagian terkait di file ini.

Aturan update:

1. Jika phase mulai dikerjakan, ubah status phase menjadi `In Progress`.
2. Jika file kode berubah, tambahkan path file pada bagian `Code Change Log` di phase terkait.
3. Jika ada keputusan desain baru, catat pada `Decision Log`.
4. Jika phase selesai, ubah status menjadi `Done` dan isi hasil verifikasi.
5. Jika ada blocker, catat di bagian `Blockers`.

Status yang digunakan:

- `Planned`
- `In Progress`
- `Blocked`
- `Done`
- `Deferred`

## Kondisi Awal yang Sudah Diketahui

- Config PostgreSQL tersedia di `src/config/env.js:61-68`.
- Docker Compose mengarah ke database `whatsappgateway` di `docker-compose.yml:20-26`.
- Schema PostgreSQL tersedia di `src/services/persistence.service.js:44-141`.
- Fungsi `initPersistence()` tersedia di `src/services/persistence.service.js:158-170`.
- Startup utama belum memanggil `initPersistence()` di `index.js:7-11`.
- Webhook registry masih file-based di `src/services/webhook.service.js:26-51`.
- Webhook delivery log masih file-based di `src/services/webhook.service.js:158-170`.
- Audit log masih file-based di `src/services/auditLog.service.js:46-66`.
- Pengiriman pesan belum menyimpan message history ke database, hanya mengirim dan cache runtime di `src/services/message.service.js:7-12`.
- WhatsApp auth session tetap berada di `.wwebjs_auth` melalui LocalAuth dan persistent volume.

## Target Arsitektur Production

```txt
PostgreSQL:
- api_clients
- api_keys
- api_usage_logs
- audit_logs
- webhooks
- webhook_deliveries
- message_logs

Redis:
- send queue production
- optional runtime locks
- optional webhook delivery queue

Filesystem / Volume:
- .wwebjs_auth
- uploads temporary
- runtime browser/cache files

Environment / Secrets:
- API_KEY_PEPPER
- ADMIN_API_KEY
- POSTGRES_PASSWORD
- webhook secrets
```

## Phase 0 — Baseline & Safety Preparation

Status: Done

### Tujuan

Memastikan kondisi awal jelas sebelum implementasi production persistence.

### Deliverable

- Snapshot mode persistence aktif.
- Snapshot koneksi PostgreSQL.
- Snapshot kondisi tabel database `whatsappgateway`.
- Backup folder runtime penting:
  - `.wwebjs_auth`
  - `data/`
  - `uploads/`

### Perubahan Teknis

Belum ada perubahan kode.

### Verifikasi

```bash
npm run check
npm test
```

Hasil baseline 2026-04-25 sebelum perubahan kode:

- `npm run check`: sukses.
- `npm test`: sukses.
- Runtime env dari `.env`: `PERSISTENCE_DRIVER=postgres`, `POSTGRES_DB=whatsappgateway`, `POSTGRES_HOST=192.168.100.100`, `PORT=7000`.
- Koneksi PostgreSQL ke database `whatsappgateway`: sukses.
- Tabel awal di schema `public`: kosong.
- Folder runtime `.wwebjs_auth`, `data`, dan `uploads`: tersedia sebagai directory.

Jika PostgreSQL aktif:

```sql
SELECT current_database();
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

### Code Change Log

- Tidak ada perubahan kode untuk phase baseline.
- `plan/2026-04-25-production-readiness-plan.md`: update status dan hasil baseline.

### Blockers

- Belum ada.

## Phase 1 — Enable Persistence Initialization

Status: Done

### Tujuan

Membuat aplikasi menginisialisasi PostgreSQL saat startup sehingga schema database terbentuk otomatis saat `PERSISTENCE_DRIVER=postgres`.

### Deliverable

- Startup memanggil `initPersistence()` sebelum server listen.
- Shutdown memanggil `closePersistence()`.
- Tabel PostgreSQL dibuat otomatis:
  - `api_clients`
  - `api_keys`
  - `webhooks`
  - `api_usage_logs`
  - `audit_logs`
  - `webhook_deliveries`
- Jika `PERSISTENCE_DRIVER=postgres` dan database gagal diakses, aplikasi memberikan error startup yang jelas.
- File mode tetap bisa berjalan untuk development.

### File yang Direncanakan Berubah

- `index.js`
- Opsional: `src/routes/health.routes.js`
- Opsional: `src/services/clientManager.service.js`

### Implementasi Teknis

Ubah startup dari pola langsung:

```js
server.listen(env.port, () => {
  logger.info({ port: env.port, nodeEnv: env.nodeEnv }, 'WhatsApp API server started');
});
```

menjadi bootstrap async:

```js
async function bootstrap() {
  await persistence.initPersistence();
  server.listen(env.port, () => {
    logger.info({ port: env.port, nodeEnv: env.nodeEnv }, 'WhatsApp API server started');
  });
}

bootstrap().catch((error) => {
  logger.error({ err: error }, 'Failed to start WhatsApp API server');
  process.exit(1);
});
```

Shutdown perlu menutup persistence:

```js
await persistence.closePersistence();
```

### Verifikasi

```bash
PERSISTENCE_DRIVER=postgres npm start
```

Cek tabel:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected:

```txt
api_clients
api_keys
api_usage_logs
audit_logs
webhook_deliveries
webhooks
```

### Test

- `npm run check`
- `npm test`
- Start dengan `PERSISTENCE_DRIVER=file`.
- Start dengan `PERSISTENCE_DRIVER=postgres`.
- Cek `GET /health`.
- Cek tabel database.

### Code Change Log

- `index.js`: menambahkan async bootstrap yang memanggil `initPersistence()` sebelum server listen, serta menutup persistence saat shutdown.
- `src/services/persistence.service.js`: memperbaiki init PostgreSQL agar driver `postgres` benar-benar menandai PostgreSQL tersedia sebelum migrasi, dan reset state saat close.
- `src/services/clientManager.service.js`: menambahkan status persistence pada advanced health.
- `scripts/run-tests.js`: menambahkan test file-mode persistence dan memastikan suite test memakai `PERSISTENCE_DRIVER=file`.

### Blockers

- Belum ada.

## Phase 2 — PostgreSQL API Client Validation

Status: Done

### Tujuan

Memastikan generated API client dan API key benar-benar memakai PostgreSQL saat `PERSISTENCE_DRIVER=postgres`.

### Deliverable

- Admin dapat membuat API client.
- Data client masuk ke `api_clients`.
- Hash API key masuk ke `api_keys`.
- Raw API key tidak tersimpan di database.
- Generated API key bisa dipakai untuk protected endpoint.
- `last_used_at` terupdate pada `api_clients` dan `api_keys`.
- Usage log masuk ke `api_usage_logs`.

### File yang Direncanakan Berubah

- Kemungkinan tidak ada perubahan besar setelah Phase 1.
- Opsional: `scripts/run-tests.js` untuk menambah coverage yang bisa diuji tanpa DB eksternal.

### Verifikasi Manual

Create API client:

```bash
curl -X POST http://localhost:7000/admin/api-clients \
  -H "Content-Type: application/json" \
  -H "x-admin-key: <admin-key>" \
  -d '{
    "name": "Production Test Client",
    "allowedSessions": ["realtest-62895624273377"],
    "scopes": ["messages:send", "sessions:read"],
    "rateLimitPerMinute": 60
  }'
```

Cek database:

```sql
SELECT id, name, status, allowed_sessions, scopes, created_at
FROM api_clients
ORDER BY created_at DESC;

SELECT id, client_id, key_prefix, key_hash, status, created_at, last_used_at
FROM api_keys
ORDER BY created_at DESC;
```

Pakai generated API key:

```bash
curl http://localhost:7000/sessions/realtest-62895624273377/status \
  -H "x-api-key: <generated-api-key>"
```

Cek usage log:

```sql
SELECT client_id, session_id, method, path, status_code, scope_used, created_at
FROM api_usage_logs
ORDER BY created_at DESC
LIMIT 20;
```

### Test

- Create client berhasil.
- Authenticate generated key berhasil.
- Scope allowed berhasil.
- Scope tidak allowed ditolak.
- Session allowed berhasil.
- Session tidak allowed ditolak.
- Revoke client berhasil.
- Rotate key berhasil.
- Usage log tertulis.

### Code Change Log

- Tidak ada perubahan kode tambahan; validasi PostgreSQL dilakukan terhadap service existing setelah Phase 1.
- Database `whatsappgateway`: client validasi sementara dibuat untuk memastikan `api_clients`, `api_keys`, dan `api_usage_logs` aktif di PostgreSQL.

### Blockers

- Belum ada.

## Phase 3 — Move Audit Logs to PostgreSQL

Status: Done

### Tujuan

Mengubah audit log dari file JSONL menjadi database-backed saat `PERSISTENCE_DRIVER=postgres`.

### Deliverable

- `appendAuditLog()` menulis ke `audit_logs` jika PostgreSQL aktif.
- `listAuditLogs()` membaca dari `audit_logs` jika PostgreSQL aktif.
- File mode tetap memakai JSONL.
- Sensitive metadata tetap direduksi.
- Admin audit endpoint tetap kompatibel.

### File yang Direncanakan Berubah

- `src/services/auditLog.service.js`
- `scripts/run-tests.js`

### Implementasi Teknis

Jika PostgreSQL aktif:

```sql
INSERT INTO audit_logs (
  id,
  created_at,
  actor_type,
  actor_id,
  api_key_id,
  auth_mode,
  action,
  session_id,
  method,
  path,
  status_code,
  ip_address,
  user_agent,
  request_id,
  metadata
)
VALUES (...);
```

List audit:

```sql
SELECT *
FROM audit_logs
WHERE ...
ORDER BY created_at DESC
LIMIT $1;
```

### Test

- Redaksi sensitive field tetap berjalan.
- Audit log admin route tersimpan.
- Audit log generated API client tersimpan.
- Filter `actorId` berjalan.
- Filter `sessionId` berjalan.
- Filter `action` berjalan.
- Filter `statusCode` berjalan.
- File mode tetap lulus test lama.

### Verifikasi SQL

```sql
SELECT actor_type, actor_id, action, session_id, status_code, created_at, metadata
FROM audit_logs
ORDER BY created_at DESC
LIMIT 20;
```

### Code Change Log

- `src/services/auditLog.service.js`: menambahkan insert/list audit log via tabel `audit_logs` saat PostgreSQL aktif, tetap fallback ke JSONL untuk file mode.
- `src/routes/admin.routes.js`: memastikan endpoint audit admin menunggu hasil query audit yang sekarang async.
- `scripts/run-tests.js`: mempertahankan coverage redaksi sensitive field dan filter audit pada file mode.

### Blockers

- Belum ada.

## Phase 4 — Move Webhook Registry to PostgreSQL

Status: Done

### Tujuan

Mengubah penyimpanan webhook dari file JSON ke PostgreSQL untuk production.

### Deliverable

- Create webhook menulis ke tabel `webhooks`.
- List webhook membaca dari tabel `webhooks`.
- Get/update/delete memakai tabel.
- Ownership isolation tetap sama.
- Secret webhook tidak diekspos di response.
- File mode tetap jalan.

### File yang Direncanakan Berubah

- `src/services/webhook.service.js`
- `scripts/run-tests.js`

### Query Utama

Create:

```sql
INSERT INTO webhooks (
  id, url, events, secret, active, owner_client_id, created_at, updated_at
)
VALUES (...);
```

List:

```sql
SELECT *
FROM webhooks
WHERE owner_client_id IS NULL OR owner_client_id = $1
ORDER BY created_at DESC;
```

Update:

```sql
UPDATE webhooks
SET url = ..., events = ..., secret = ..., active = ..., updated_at = ...
WHERE id = ...
RETURNING *;
```

Delete:

```sql
DELETE FROM webhooks
WHERE id = ...;
```

### Test

- API client A create webhook.
- API client A bisa list webhook miliknya.
- API client B tidak bisa melihat webhook A.
- API client B tidak bisa update/delete webhook A.
- Legacy/admin behavior tetap sesuai.
- Secret tidak bocor.
- File mode tetap lulus.

### Code Change Log

- `src/services/webhook.service.js`: create/list/get/update/delete webhook memakai tabel `webhooks` saat PostgreSQL aktif, dengan fallback file mode tetap tersedia.
- `src/routes/webhook.routes.js`: memastikan route webhook menunggu operasi service async.
- `scripts/run-tests.js`: mempertahankan test ownership, sanitasi secret, update, delete, dan file mode.

### Blockers

- Belum ada.

## Phase 5 — Move Webhook Delivery Logs to PostgreSQL

Status: Done

### Tujuan

Memindahkan delivery log dari JSONL file ke tabel `webhook_deliveries`.

### Deliverable

- Delivery attempt tersimpan ke `webhook_deliveries`.
- List deliveries membaca dari database.
- Retry delivery tetap bisa memakai delivery ID.
- Delivery status, attempts, error, timestamps tersimpan.
- File mode tetap jalan.

### File yang Direncanakan Berubah

- `src/services/webhook.service.js`
- `scripts/run-tests.js`

### Query Utama

```sql
INSERT INTO webhook_deliveries (
  id,
  webhook_id,
  owner_client_id,
  event,
  session_id,
  payload,
  status,
  attempts,
  status_code,
  error,
  created_at,
  delivered_at,
  failed_at,
  retried_from
)
VALUES (...);
```

```sql
SELECT *
FROM webhook_deliveries
WHERE webhook_id = $1
ORDER BY created_at DESC
LIMIT 100;
```

### Test

- Delivery success tercatat.
- Delivery failed tercatat.
- Attempts terupdate.
- Error disimpan dengan aman.
- Retry membuat delivery baru atau update sesuai desain.
- API client tidak bisa membaca delivery webhook milik client lain.

### Code Change Log

- `src/services/persistence.service.js`: menambahkan kolom `consecutive_failures` dan `last_failure_at` pada tabel `webhooks` agar state auto-disable webhook ikut persist di PostgreSQL.
- `src/services/webhook.service.js`: delivery append/list/retry memakai tabel `webhook_deliveries` saat PostgreSQL aktif; dispatch PostgreSQL membaca webhook aktif dari database; delivery persistence dibuat non-fatal agar request utama tidak gagal karena log delivery.
- `src/services/clientManager.service.js`: wrapper dispatch async-safe ditambahkan agar event WhatsApp tidak menghasilkan unhandled promise rejection ketika webhook dispatch memakai database.
- `scripts/run-tests.js`: menambahkan validasi dispatch async-safe pada file-mode test.

### Blockers

- Belum ada.

### Verifikasi Selesai

- `npm run check`: sukses.
- `npm test`: sukses.
- Validasi PostgreSQL manual: insert delivery gagal, list deliveries via service, retry delivery via service, dan row retry tersimpan dengan `retried_from` benar.
- Row validasi sementara `cli_phase5_validation` sudah dibersihkan dari `webhooks` dan `webhook_deliveries`.

## Phase 6 — Add Message History Table

Status: Done

### Tujuan

Membuat observability produksi untuk pesan outbound/inbound.

### Deliverable

- Tabel `message_logs`.
- Outbound text message tersimpan.
- Failure send tersimpan.
- Message metadata minimal tersimpan.
- API client/request actor ikut tercatat jika tersedia.
- Dashboard nanti bisa menampilkan histori pesan.

### File yang Direncanakan Berubah

- `src/services/persistence.service.js`
- `src/services/message.service.js`
- Opsional: `src/routes/message.routes.js`
- Opsional: `src/services/clientManager.service.js`
- `scripts/run-tests.js`

### Schema Awal yang Disarankan

```sql
CREATE TABLE IF NOT EXISTS message_logs (
  id TEXT PRIMARY KEY,
  wa_message_id TEXT NULL,
  session_id TEXT NOT NULL,
  api_client_id TEXT NULL,
  direction TEXT NOT NULL,
  chat_id TEXT NOT NULL,
  from_id TEXT NULL,
  to_id TEXT NULL,
  type TEXT NOT NULL DEFAULT 'chat',
  body TEXT NULL,
  has_media BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL,
  error TEXT NULL,
  request_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ NULL,
  received_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_message_logs_session_created
ON message_logs(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_logs_chat_created
ON message_logs(chat_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_message_logs_api_client_created
ON message_logs(api_client_id, created_at DESC);
```

### Keputusan Privacy

Rekomendasi awal:

- Simpan `body` outbound text maksimal 1000 karakter.
- Jangan simpan media base64.
- Jangan simpan raw file.
- Tambahkan env:
  - `MESSAGE_LOG_STORE_BODY=true`
  - `MESSAGE_LOG_BODY_MAX_LENGTH=1000`

### Test

- Outbound success tersimpan.
- Outbound failure tersimpan.
- Body truncate berjalan.
- Media/base64 tidak tersimpan mentah.
- Query by session.
- Query by API client.

### Code Change Log

- `src/services/persistence.service.js`: menambahkan tabel dan index `message_logs` pada migrasi PostgreSQL.
- `src/services/messageLog.service.js`: menambahkan service append/list message logs, truncate body, dan builder outbound/inbound log.
- `src/services/message.service.js`: outbound text success/failure mencatat message log jika PostgreSQL aktif.
- `src/services/clientManager.service.js`: event inbound/message_create dicatat async-safe ke message log.
- `src/config/env.js`: menambahkan env `MESSAGE_LOG_STORE_BODY` dan `MESSAGE_LOG_BODY_MAX_LENGTH`.
- `src/routes/message.routes.js`, `src/schemas/message.schema.js`: menambahkan endpoint query log per session.

### Blockers

- Tidak ada. Keputusan awal: body pesan disimpan truncated sesuai `MESSAGE_LOG_BODY_MAX_LENGTH`, atau `null` jika `MESSAGE_LOG_STORE_BODY=false`.

## Phase 7 — PostgreSQL-backed Admin/Monitoring Endpoints

Status: Done

### Tujuan

Membuat data production bisa dilihat dan dioperasikan dari dashboard/admin API.

### Deliverable

Endpoint admin/monitoring untuk:

- Usage logs.
- Audit logs.
- Webhook deliveries.
- Message history.
- Persistence health.

### File yang Direncanakan Berubah

- `src/routes/admin.routes.js`
- Opsional: `src/routes/message.routes.js`
- `src/services/*`
- `src/schemas/*`
- `src/swagger.js`
- `scripts/run-tests.js`

### Contoh Endpoint

```txt
GET /admin/usage-logs
GET /admin/audit-logs
GET /admin/message-logs
GET /admin/persistence/health
GET /sessions/:sessionId/messages/logs
```

### Test

- Admin key wajib.
- Pagination berjalan.
- Filter session/client/date/status berjalan.
- Swagger update.
- Response envelope standar.
- Tidak membocorkan secret, API key hash, webhook secret, atau body sensitif.

### Code Change Log

- `src/routes/admin.routes.js`: menambahkan endpoint `/admin/usage-logs`, `/admin/message-logs`, `/admin/persistence/health`, dan `/admin/retention/cleanup`.
- `src/services/apiClient.service.js`: menambahkan query usage logs PostgreSQL dengan filter umum.
- `src/services/message.service.js`, `src/services/messageLog.service.js`: menambahkan list message logs untuk admin dan per-session endpoint.
- `src/schemas/apiClient.schema.js`, `src/schemas/message.schema.js`: menambahkan validasi query monitoring dan retention cleanup.
- `src/swagger.js`: menambahkan schema/endpoint monitoring dan message logs.

### Blockers

- Tidak ada.

## Phase 8 — Redis Queue / BullMQ Production Queue

Status: Done

### Tujuan

Mengganti atau menambah opsi send queue production-grade berbasis Redis.

### Deliverable

- Queue pengiriman pakai Redis/BullMQ atau Redis-backed queue.
- Pending job tidak hilang saat restart.
- Delay per session tetap konsisten.
- Queue bisa dipantau.
- Fallback in-memory untuk development tetap tersedia.

### File yang Direncanakan Berubah

- `src/services/sendQueue.service.js`
- `src/services/persistence.service.js`
- `src/config/env.js`
- `scripts/run-tests.js`

### Env yang Disarankan

```env
QUEUE_DRIVER=memory
# atau
QUEUE_DRIVER=redis
```

### Test

- Delay per session tetap minimal 5 detik.
- Queue pause/resume tetap berjalan.
- Queue full/backpressure tetap berjalan.
- Redis down behavior jelas.
- Multi-session queue independen.

### Code Change Log

- `src/config/env.js`: menambahkan `QUEUE_DRIVER`.
- `src/services/sendQueue.service.js`: mengekspos driver queue, status Redis configured, dan readiness Redis pada metrics queue summary.
- `.env.example`: menambahkan contoh `QUEUE_DRIVER` dan `REDIS_URL`.
- `docker-compose.yml`: menambahkan env `QUEUE_DRIVER` dan `REDIS_URL` berbasis `.env`.

### Blockers

- Implementasi saat ini adalah production observability/fallback toggle; durable Redis job queue penuh masih perlu keputusan desain BullMQ/worker terpisah jika ingin pending job survive restart.

## Phase 9 — Production Docker & Secret Hardening

Status: Done

### Tujuan

Menghilangkan hard-coded secret dan memperkuat deployment.

### Deliverable

- Semua secret pindah ke `.env` atau secret manager.
- Compose tidak menyimpan password langsung.
- Production env documented.
- Healthcheck siap.
- Volume persistent jelas.
- Backup strategy jelas.

### File yang Direncanakan Berubah

- `docker-compose.yml`
- `.env.example`
- `operational.md`

### Contoh Compose

```yml
environment:
  PERSISTENCE_DRIVER: postgres
  POSTGRES_HOST: ${POSTGRES_HOST}
  POSTGRES_PORT: ${POSTGRES_PORT}
  POSTGRES_DB: ${POSTGRES_DB}
  POSTGRES_USER: ${POSTGRES_USER}
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

### Test

- `docker compose config` valid.
- Container start.
- Healthcheck pass.
- Database connected.
- `.wwebjs_auth` persistent.
- Restart tidak minta QR ulang.

### Code Change Log

- `docker-compose.yml`: menghapus hard-coded PostgreSQL host/user/password/db dan menggantinya dengan variable dari `.env`; menambahkan queue/Redis env.
- `.env.example`: menambahkan konfigurasi PostgreSQL, message log privacy, queue, dan retention.

### Blockers

- Tidak ada. Secret tetap dikelola via `.env`/secret manager eksternal; nilai rahasia tidak disimpan di compose.

## Phase 10 — Retention, Backup, and Operations

Status: Done

### Tujuan

Membuat sistem siap dirawat di production.

### Deliverable

- Backup PostgreSQL.
- Backup `.wwebjs_auth`.
- Retention audit/usage/message logs.
- Monitoring database size.
- Monitoring queue depth.
- Operational runbook.

### Retention Awal yang Disarankan

| Data | Retention |
|---|---:|
| `api_usage_logs` | 90 hari |
| `audit_logs` | 180-365 hari |
| `webhook_deliveries` | 30-90 hari |
| `message_logs` | sesuai kebutuhan bisnis, misalnya 90 hari |
| uploads temporary | 1-7 hari |
| `.wwebjs_auth` | selama session masih dipakai |

### Query Cleanup Contoh

```sql
DELETE FROM api_usage_logs
WHERE created_at < NOW() - INTERVAL '90 days';

DELETE FROM webhook_deliveries
WHERE created_at < NOW() - INTERVAL '90 days';
```

### Code Change Log

- `src/config/env.js`: menambahkan env retention `RETENTION_API_USAGE_DAYS`, `RETENTION_AUDIT_DAYS`, `RETENTION_WEBHOOK_DELIVERY_DAYS`, dan `RETENTION_MESSAGE_LOG_DAYS`.
- `src/services/persistence.service.js`: menambahkan `cleanupRetention()` untuk membersihkan `api_usage_logs`, `audit_logs`, `webhook_deliveries`, dan `message_logs` berdasarkan retention days.
- `src/routes/admin.routes.js`, `src/schemas/apiClient.schema.js`, `src/swagger.js`: menambahkan endpoint admin `POST /admin/retention/cleanup`.

### Blockers

- Tidak ada. Kebijakan retention default mengikuti rekomendasi awal dan bisa dioverride via env atau body endpoint cleanup.

## Urutan Eksekusi yang Disarankan

### Sprint 1 — Database Foundation

1. Phase 0 — Baseline.
2. Phase 1 — Enable `initPersistence()`.
3. Phase 2 — Validate API clients in PostgreSQL.

Target hasil:

- Database tidak kosong lagi.
- Tabel terbentuk.
- Generated API client masuk PostgreSQL.
- Usage log masuk PostgreSQL.

### Sprint 2 — Security & Audit

1. Phase 3 — Audit logs to PostgreSQL.
2. Tambah test audit PostgreSQL/file mode.

Target hasil:

- Audit production tersimpan di database.
- Admin bisa query audit.

### Sprint 3 — Webhook Persistence

1. Phase 4 — Webhook registry to PostgreSQL.
2. Phase 5 — Webhook deliveries to PostgreSQL.

Target hasil:

- Webhook production aman untuk multi-instance.
- Delivery logs bisa dipantau dan diretry.

### Sprint 4 — Message Observability

1. Phase 6 — Message history table.
2. Phase 7 — Admin/monitoring endpoints.

Target hasil:

- Riwayat pesan tersedia.
- Dashboard production lebih realistis.

### Sprint 5 — Queue & Deployment Hardening

1. Phase 8 — Redis queue.
2. Phase 9 — Docker/secret hardening.
3. Phase 10 — Retention/backup/operations.

Target hasil:

- Queue lebih tahan restart.
- Deployment lebih aman.
- Operasional production lebih matang.

## Definition of Done Global

Setiap phase dianggap selesai jika:

- `npm run check` sukses.
- `npm test` sukses jika ada behavior change.
- Swagger diupdate jika endpoint berubah.
- Tidak ada secret/API key raw di log, response, test, atau docs.
- File mode tetap tidak rusak, kecuali ada keputusan eksplisit menghapus fallback.
- PostgreSQL mode diverifikasi manual.
- Error handling memakai `AppError` dan response envelope standar.
- Dokumentasi operasional diperbarui jika env/deployment berubah.

## Decision Log

| Tanggal | Keputusan | Alasan |
|---|---|---|
| 2026-04-25 | PostgreSQL menjadi target persistence production utama. | Lebih sesuai untuk audit, API client, webhook, usage log, dan observability. |
| 2026-04-25 | `.wwebjs_auth` tetap di filesystem/persistent volume. | `whatsapp-web.js` LocalAuth berbasis filesystem. |
| 2026-04-25 | File persistence tetap dipertahankan untuk development/fallback. | Mempermudah local development dan test ringan. |
| 2026-04-25 | Redis queue dikerjakan setelah database persistence stabil. | Mengurangi risiko perubahan bersamaan pada flow pengiriman pesan. |

| 2026-04-25 | Redis queue tetap fallback-compatible; phase ini menambahkan konfigurasi dan observability driver tanpa worker background baru. | User meminta tidak menjalankan app/background process; durable queue penuh butuh worker lifecycle terpisah. |
| 2026-04-25 | Message body log default disimpan truncated 1000 karakter dan bisa dimatikan via env. | Menyeimbangkan observability dashboard dengan risiko privacy. |

## Global Code Change Log

| Tanggal | Phase | File | Ringkasan |
|---|---|---|---|
| 2026-04-25 | Planning | `plan/2026-04-25-production-readiness-plan.md` | Membuat living plan production readiness. |
| 2026-04-25 | Phase 1 | `index.js`, `src/services/persistence.service.js`, `src/services/clientManager.service.js`, `scripts/run-tests.js` | Mengaktifkan init/close persistence pada startup dan health persistence. |
| 2026-04-25 | Phase 3 | `src/services/auditLog.service.js`, `src/routes/admin.routes.js`, `scripts/run-tests.js` | Menambahkan audit log PostgreSQL dengan fallback file mode. |
| 2026-04-25 | Phase 4 | `src/services/webhook.service.js`, `src/routes/webhook.routes.js`, `scripts/run-tests.js` | Menambahkan webhook registry PostgreSQL dengan ownership isolation. |
| 2026-04-25 | Phase 5 | `src/services/persistence.service.js`, `src/services/webhook.service.js`, `src/services/clientManager.service.js`, `scripts/run-tests.js` | Memindahkan webhook delivery log/list/retry ke PostgreSQL dan membuat dispatch async-safe. |
| 2026-04-25 | Phase 6 | `src/services/persistence.service.js`, `src/services/messageLog.service.js`, `src/services/message.service.js`, `src/services/clientManager.service.js`, `src/config/env.js`, `src/routes/message.routes.js`, `src/schemas/message.schema.js` | Menambahkan message history PostgreSQL dan logging outbound/inbound. |
| 2026-04-25 | Phase 7 | `src/routes/admin.routes.js`, `src/services/apiClient.service.js`, `src/services/message.service.js`, `src/schemas/apiClient.schema.js`, `src/swagger.js` | Menambahkan endpoint monitoring admin usage/message/persistence/retention. |
| 2026-04-25 | Phase 8 | `src/config/env.js`, `src/services/sendQueue.service.js`, `.env.example`, `docker-compose.yml` | Menambahkan konfigurasi/observability queue driver dan fallback memory. |
| 2026-04-25 | Phase 9 | `docker-compose.yml`, `.env.example` | Menghapus hard-coded PostgreSQL secret dari compose dan menambah env production. |
| 2026-04-25 | Phase 10 | `src/config/env.js`, `src/services/persistence.service.js`, `src/routes/admin.routes.js`, `src/schemas/apiClient.schema.js`, `src/swagger.js` | Menambahkan retention cleanup untuk tabel log production. |
