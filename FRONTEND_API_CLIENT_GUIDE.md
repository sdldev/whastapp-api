# Frontend Integration Guide: Generate API Client

Dokumen ini menjelaskan cara tim frontend mengintegrasikan fitur generate API untuk client eksternal yang akan memakai WhatsApp API.

## 1. Konsep Credential

Aplikasi sekarang memiliki dua jenis credential:

1. **Admin key** untuk dashboard/frontend internal.
   - Header: `x-admin-key`
   - Dipakai hanya untuk endpoint `/admin/*`.
   - Nilainya berasal dari environment `ADMIN_API_KEY`.

2. **Client API key** untuk client eksternal.
   - Header: `x-api-key`
   - Digenerate melalui endpoint admin.
   - Dipakai client untuk endpoint WhatsApp API seperti `/sessions`, `/messages`, `/media`, `/webhooks`, dan lain-lain.

Raw client API key hanya ditampilkan sekali saat create/rotate. Backend hanya menyimpan hash.

## 2. Base URL

Development default:

```txt
http://localhost:3000
```

Swagger:

```txt
http://localhost:3000/api-docs
```

OpenAPI JSON:

```txt
http://localhost:3000/api-docs.json
```

## 3. Admin Headers

Semua endpoint admin wajib memakai:

```txt
x-admin-key: <ADMIN_API_KEY>
Content-Type: application/json
```

Jika admin key salah atau kosong, response:

```json
{
  "success": false,
  "error": {
    "code": "INVALID_ADMIN_API_KEY",
    "message": "Invalid or missing admin API key"
  },
  "meta": {
    "timestamp": "2026-04-25T00:00:00.000Z"
  }
}
```

## 4. Create / Generate API Client

Endpoint:

```txt
POST /admin/api-clients
```

Request:

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

Field:

| Field | Type | Required | Notes |
|---|---|---:|---|
| `name` | string | yes | Nama client/integrasi |
| `description` | string | no | Catatan internal |
| `allowedSessions` | string[] | yes | Session WhatsApp yang boleh diakses; gunakan `['*']` untuk semua session |
| `scopes` | string[] | yes | Permission endpoint; gunakan `['*']` untuk full access |
| `rateLimitPerMinute` | number | no | Default dari `DEFAULT_API_CLIENT_RATE_LIMIT_PER_MINUTE` |
| `expiresAt` | ISO datetime/null | no | Tanggal expired client dan key |

Response sukses:

```json
{
  "success": true,
  "data": {
    "id": "cli_abc123def4567890",
    "name": "Client Toko A",
    "description": "Integrasi CRM Toko A",
    "status": "active",
    "allowedSessions": ["sales"],
    "scopes": ["sessions:read", "messages:send", "media:send"],
    "rateLimitPerMinute": 60,
    "createdAt": "2026-04-25T00:00:00.000Z",
    "updatedAt": "2026-04-25T00:00:00.000Z",
    "expiresAt": "2026-12-31T23:59:59.000Z",
    "revokedAt": null,
    "lastUsedAt": null,
    "keys": [
      {
        "id": "key_abc123def4567890",
        "clientId": "cli_abc123def4567890",
        "keyPrefix": "wa_sk_live_cli_abc123de",
        "status": "active",
        "createdAt": "2026-04-25T00:00:00.000Z",
        "expiresAt": "2026-12-31T23:59:59.000Z",
        "revokedAt": null,
        "lastUsedAt": null
      }
    ],
    "apiKey": "wa_demo_live_cli_abc123def4567890_example_key_do_not_use"
  },
  "meta": {
    "timestamp": "2026-04-25T00:00:00.000Z"
  }
}
```

Frontend harus memperlakukan `data.apiKey` sebagai secret dan menampilkannya hanya pada modal hasil generate.

Rekomendasi UI setelah create:

- Tampilkan alert: `Copy API key sekarang. Key ini tidak akan ditampilkan lagi.`
- Tombol `Copy API Key`.
- Tombol `Download .env` dengan isi:

```env
WHATSAPP_API_BASE_URL=http://localhost:3000
WHATSAPP_API_KEY=wa_sk_live_cli_xxx_secret
```

## 5. List API Clients

Endpoint:

```txt
GET /admin/api-clients
```

Response `data` berupa array client. Raw `apiKey` tidak dikembalikan.

Tabel frontend yang disarankan:

| Column | Source |
|---|---|
| Name | `name` |
| Client ID | `id` |
| Status | `status` |
| Allowed Sessions | `allowedSessions` |
| Scopes | `scopes` |
| Rate Limit | `rateLimitPerMinute` |
| Last Used | `lastUsedAt` |
| Expires At | `expiresAt` |
| Created At | `createdAt` |

Actions:

- Detail
- Edit
- Rotate Key
- Revoke

## 6. Get API Client Detail

Endpoint:

```txt
GET /admin/api-clients/:clientId
```

Digunakan untuk halaman detail/edit.

## 7. Update API Client

Endpoint:

```txt
PATCH /admin/api-clients/:clientId
```

Request minimal satu field:

```json
{
  "allowedSessions": ["sales", "support"],
  "scopes": ["sessions:read", "messages:send", "media:send", "webhooks:create"],
  "rateLimitPerMinute": 120,
  "status": "active",
  "expiresAt": null
}
```

Status valid:

```txt
active
inactive
revoked
```

## 8. Revoke API Client

Endpoint:

```txt
POST /admin/api-clients/:clientId/revoke
```

Efek:

- Client status menjadi `revoked`.
- Semua key milik client ikut `revoked`.
- Request client berikutnya akan gagal.

## 9. Rotate API Key

Endpoint:

```txt
POST /admin/api-clients/:clientId/keys/rotate
```

Efek:

- Semua key aktif lama direvoke.
- Key baru dibuat.
- Response mengandung `data.apiKey` baru dan hanya ditampilkan sekali.

Gunakan flow UI yang sama seperti create API key.

## 10. Client Menggunakan Generated API Key

Client eksternal menggunakan header:

```txt
x-api-key: <generated-api-key>
```

Contoh:

```bash
curl -X POST http://localhost:3000/sessions/sales/messages/text \
  -H "Content-Type: application/json" \
  -H "x-api-key: wa_sk_live_cli_xxx_secret" \
  -d '{
    "to": "6281234567890",
    "message": "Halo dari client"
  }'
```

Jika key valid, scope cukup, dan session diizinkan, request diproses.

## 11. Rate Limit Headers

Generated API client mendapat rate limit per menit.

Response protected endpoint akan menyertakan:

```txt
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 59
X-RateLimit-Reset: 2026-04-25T00:01:00.000Z
```

Jika limit habis:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests",
    "details": {
      "limit": 60,
      "resetAt": "2026-04-25T00:01:00.000Z"
    }
  },
  "meta": {
    "timestamp": "2026-04-25T00:00:30.000Z"
  }
}
```

HTTP status: `429`.

Catatan: rate limit HTTP berbeda dengan delay pengiriman WhatsApp. Pengiriman message/media tetap memiliki gate minimal 5 detik per session.

## 12. Scope List

Scope yang tersedia:

```txt
*
sessions:read
sessions:start
sessions:logout
sessions:restart
sessions:destroy
sessions:screenshot
messages:send
messages:reply
messages:react
messages:forward
messages:edit
messages:delete
messages:star
messages:read
media:send
media:send_sticker
media:download
mentions:users
mentions:groups
contacts:read
contacts:block
contacts:unblock
contacts:send_card
profile:update
location:send
chats:read
chats:update
chats:delete
chats:mute
chats:unmute
groups:read
groups:create
groups:join
groups:update
groups:leave
groups:participants:add
groups:participants:remove
groups:participants:promote
groups:participants:demote
groups:mention_everyone
groups:membership:read
groups:membership:update
presence:update
polls:create
polls:vote
channels:read
channels:send
channels:update
channels:admin
channels:delete
events:read
webhooks:read
webhooks:create
webhooks:update
webhooks:delete
webhooks:retry
metrics:read
queue:read
queue:manage
```

Untuk MVP frontend, buat preset:

### Read Only

```json
["sessions:read", "contacts:read", "chats:read", "groups:read", "webhooks:read"]
```

### Messaging Basic

```json
["sessions:read", "messages:send", "messages:reply", "messages:forward", "messages:read", "presence:update", "media:send", "media:send_sticker", "media:download"]
```

### Webhook Manager

```json
["webhooks:read", "webhooks:create", "webhooks:update", "webhooks:delete", "webhooks:retry", "events:read"]
```

### Operations Dashboard

```json
["sessions:read", "events:read", "metrics:read", "queue:read", "queue:manage"]
```

Gunakan preset ini untuk dashboard internal yang perlu melihat metrics runtime dan pause/resume queue per session.

### Group Admin

```json
["sessions:read", "groups:read", "groups:update", "groups:participants:add", "groups:participants:remove", "groups:participants:promote", "groups:participants:demote", "groups:membership:read", "groups:membership:update", "groups:mention_everyone"]
```

Gunakan preset ini hanya untuk client yang boleh mengelola group admin action dan membership requests.

### Channel Manager

```json
["sessions:read", "channels:read", "channels:send", "channels:update", "channels:admin", "channels:delete"]
```

Gunakan preset channel hanya untuk client yang memang perlu mengelola WhatsApp Channels. Beberapa endpoint channel bisa mengembalikan `FEATURE_NOT_AVAILABLE` jika method belum didukung oleh runtime `whatsapp-web.js` atau akun tidak memiliki permission channel terkait.

### Realtime Dashboard

Frontend dashboard bisa subscribe event session melalui SSE:

```js
const source = new EventSource(`${baseUrl}/sessions/default/events`);

source.addEventListener('message.received', (event) => {
  const payload = JSON.parse(event.data);
  console.log(payload);
});
```

Karena native `EventSource` tidak dapat mengirim custom header `x-api-key`, frontend browser disarankan memakai salah satu opsi berikut:

1. Proxy request SSE melalui backend frontend/BFF yang menambahkan `x-api-key`.
2. Gunakan polyfill EventSource yang mendukung header.
3. Gunakan endpoint dari server-side dashboard.

Scope yang dibutuhkan: `events:read` dan session harus masuk `allowedSessions`.

### Full Access

```json
["*"]
```

## 13. Session Access

`allowedSessions` membatasi session WhatsApp yang boleh dipakai client.

Contoh:

```json
["sales"]
```

Client hanya boleh akses path:

```txt
/sessions/sales/...
```

Jika client mencoba session lain:

```json
{
  "success": false,
  "error": {
    "code": "SESSION_ACCESS_DENIED",
    "message": "This API key is not allowed to access this WhatsApp session",
    "details": {
      "sessionId": "support"
    }
  },
  "meta": {
    "timestamp": "2026-04-25T00:00:00.000Z"
  }
}
```

## 14. Error Codes Penting untuk Frontend

| Code | HTTP | Meaning | UI Action |
|---|---:|---|---|
| `INVALID_ADMIN_API_KEY` | 401 | Admin key salah | Minta konfigurasi admin key |
| `INVALID_API_KEY` | 401 | Client API key salah | Minta client cek credential |
| `API_KEY_REVOKED` | 401 | Key sudah direvoke | Generate/rotate ulang |
| `API_KEY_EXPIRED` | 401 | Key expired | Rotate/generate ulang |
| `API_CLIENT_INACTIVE` | 403 | Client inactive/revoked | Aktifkan/update client |
| `INSUFFICIENT_SCOPE` | 403 | Scope kurang | Tampilkan required scope dari details |
| `SESSION_ACCESS_DENIED` | 403 | Session tidak diizinkan | Update allowedSessions |
| `RATE_LIMIT_EXCEEDED` | 429 | Request terlalu banyak | Tampilkan waktu reset |
| `VALIDATION_ERROR` | 400 | Payload invalid | Tampilkan validasi field |

## 15. Storage dan Audit

Generated API client disimpan di:

```txt
data/api-clients.json
```

Usage log disimpan JSON Lines di:

```txt
data/api-usage.log
```

Audit log terstruktur disimpan JSON Lines di:

```txt
data/audit.log
```

Audit log dapat dibaca oleh admin melalui:

```txt
GET /admin/audit-logs?limit=100&actorId=cli_xxx&sessionId=default&action=messages:send&statusCode=201
```

File ini untuk backend/ops, bukan untuk frontend langsung.

## 16. Checklist Frontend

- Buat halaman API Clients.
- Buat form Create API Client.
- Buat modal hasil generate untuk menampilkan `apiKey` sekali.
- Buat tombol copy key dan download `.env`.
- Buat tabel list client.
- Buat halaman/detail edit client.
- Buat action rotate key dengan confirmation modal.
- Buat action revoke dengan confirmation modal.
- Buat preset scopes agar admin tidak harus memilih manual semua scope.
- Tampilkan rate limit dan last used.
- Buat halaman admin-only untuk membaca audit log jika diperlukan.
- Tangani error code penting dari backend.
