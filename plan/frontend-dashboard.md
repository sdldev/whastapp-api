# Plan: React Admin Dashboard

## Tujuan

Membangun dashboard React sederhana khusus admin untuk mengelola WhatsApp API dari sisi internal. Dashboard hanya dapat diakses oleh admin yang memiliki `ADMIN_API_KEY`, lalu menggunakan header `x-admin-key` untuk semua endpoint `/admin/*`.

## Dasar Kontrak Backend

- Backend WhatsApp API berjalan di `http://localhost:7000`.
- Aplikasi React dashboard berjalan di `http://localhost:7001`.
- Admin route dipasang sebelum middleware API client, sehingga endpoint `/admin/*` memakai admin auth khusus.
- Semua endpoint admin wajib mengirim header `x-admin-key` dan `Content-Type: application/json`.
- Endpoint client management tersedia untuk create, list, detail, update, revoke, dan rotate API key.
- Raw `apiKey` hanya muncul saat create/rotate dan tidak boleh disimpan permanen di frontend.

## Scope Dashboard

### 1. Admin Login / Gate

Fitur:

- Dashboard React berjalan di `http://localhost:7001` saat development.
- Form input:
  - Base URL backend, default `http://localhost:7000`.
  - Admin key.
- Validasi akses dengan request ringan ke `GET /admin/api-clients` atau `GET /admin/persistence/health`.
- Jika sukses, simpan status sesi admin di memory state.
- Jangan simpan admin key ke `localStorage` secara default.
- Opsi "remember for this tab" boleh memakai `sessionStorage` dengan peringatan keamanan.
- Jika response `INVALID_ADMIN_API_KEY`, tampilkan error auth dan tetap di halaman login.

Acceptance criteria:

- User tanpa admin key tidak bisa melihat layout dashboard.
- Logout menghapus admin key dari memory/session storage.
- Semua request admin menyertakan `x-admin-key`.

### 2. Layout Dashboard

Struktur React:

```txt
src/
  main.jsx
  App.jsx
  api/
    adminClient.js
    response.js
  auth/
    AdminAuthProvider.jsx
    RequireAdmin.jsx
  components/
    AppShell.jsx
    DataTable.jsx
    ConfirmDialog.jsx
    SecretRevealModal.jsx
    StatusBadge.jsx
    ErrorState.jsx
    LoadingState.jsx
  pages/
    LoginPage.jsx
    OverviewPage.jsx
    ApiClientsPage.jsx
    ApiClientFormPage.jsx
    ApiClientDetailPage.jsx
    AuditLogsPage.jsx
    UsageLogsPage.jsx
    MessageLogsPage.jsx
    PersistencePage.jsx
    WebhooksPage.jsx
    SessionsPage.jsx
    QueuePage.jsx
    MetricsPage.jsx
```

Navigasi utama:

- Overview
- API Clients
- Sessions
- Messages / Logs
- Webhooks
- Queue
- Metrics
- Audit Logs
- Persistence

Catatan: modul Sessions, Webhooks, Queue, dan Metrics dapat memakai generated client API key bila backend endpoint non-admin membutuhkan `x-api-key`. Untuk dashboard admin sederhana, fase awal boleh fokus penuh pada endpoint `/admin/*` dan menampilkan shortcut/link ke fitur protected.

### 3. API Wrapper

Buat wrapper request terpusat:

- `adminRequest(path, options)`:
  - Prefix base URL dari auth context.
  - Tambah header `x-admin-key`.
  - Parse response envelope `{ success, data, meta }`.
  - Untuk error envelope `{ success: false, error, meta }`, throw error dengan `code`, `message`, dan `timestamp`.
- Jangan log raw admin key, generated API key, webhook secret, atau request body sensitif.
- Handle state:
  - loading
  - empty
  - validation error
  - auth error
  - network/server error
  - success toast/alert

### 4. Overview Page

Isi awal:

- Card jumlah API clients aktif/inactive/revoked dari `GET /admin/api-clients`.
- Card persistence health dari `GET /admin/persistence/health`.
- Card ringkas audit atau usage terbaru dari:
  - `GET /admin/audit-logs?limit=5`
  - `GET /admin/usage-logs?limit=5`
- Shortcut ke Create API Client, Audit Logs, dan Message Logs.

Acceptance criteria:

- Overview tetap usable jika salah satu widget gagal; tampilkan error per-widget.
- Tidak menampilkan secret mentah.

### 5. API Client Management CRUD

Endpoint:

- `GET /admin/api-clients`
- `POST /admin/api-clients`
- `GET /admin/api-clients/:clientId`
- `PATCH /admin/api-clients/:clientId`
- `POST /admin/api-clients/:clientId/revoke`
- `POST /admin/api-clients/:clientId/keys/rotate`

List page:

- Tabel kolom:
  - Name
  - Client ID
  - Status
  - Allowed Sessions
  - Scopes
  - Rate Limit
  - Last Used
  - Expires At
  - Created At
- Filter lokal:
  - status
  - keyword name/client id
  - scope
- Actions:
  - Detail
  - Edit
  - Rotate Key
  - Revoke

Create form:

- Field:
  - `name` required
  - `description` optional
  - `allowedSessions` required string array, dukung chip input dan `*`
  - `scopes` required string array, dukung preset dan custom scope
  - `rateLimitPerMinute` optional number
  - `expiresAt` optional datetime/null
- Setelah sukses, tampilkan `SecretRevealModal` untuk `data.apiKey`.

Edit form:

- Field minimal satu yang berubah:
  - `description`
  - `allowedSessions`
  - `scopes`
  - `rateLimitPerMinute`
  - `status`: `active`, `inactive`, `revoked`
  - `expiresAt`
- Jangan pernah meminta atau menampilkan raw API key lama.

Detail page:

- Tampilkan metadata client dan keys tanpa hash/secret.
- Tampilkan status key, `keyPrefix`, created/expired/revoked/last used.

Danger actions:

- Revoke wajib confirmation dialog.
- Rotate key wajib confirmation dialog.
- Setelah rotate sukses, tampilkan raw `data.apiKey` hanya sekali.

Secret handling:

- Modal berisi warning: "Copy API key sekarang. Key ini tidak akan ditampilkan lagi."
- Tombol Copy API Key.
- Tombol Download `.env` berisi:

```env
WHATSAPP_API_BASE_URL=http://localhost:7000
WHATSAPP_API_KEY=<generated-api-key>
```

- Setelah modal ditutup, hapus secret dari state.

### 6. Logs dan Audit

Pages:

- Audit Logs: `GET /admin/audit-logs`
- Usage Logs: `GET /admin/usage-logs`
- Message Logs: `GET /admin/message-logs`

Fitur:

- Filter query mengikuti backend:
  - limit
  - actorId/clientId jika tersedia
  - sessionId
  - action
  - statusCode
  - date range jika didukung response/query backend
- Tabel responsif dengan detail drawer JSON metadata tereduksi.
- Jangan render field sensitif jika muncul; mask key seperti `apiKey`, `secret`, `token`, `password`, `keyHash`, `base64`, `data`.

### 7. Persistence dan Retention Management

Endpoint:

- `GET /admin/persistence/health`
- `POST /admin/retention/cleanup`

Fitur:

- Tampilkan status storage/persistence health.
- Form cleanup retention:
  - target/type sesuai schema backend.
  - dry-run jika schema mendukung.
- Tombol cleanup wajib confirmation dialog.

### 8. Fitur Protected WhatsApp API di Dashboard

Karena endpoint di luar `/admin` memakai `x-api-key`, dashboard perlu mode "Act as API Client" untuk fitur WhatsApp API. Admin memilih salah satu API client lalu memasukkan/generated client API key secara sementara di memory untuk mengakses fitur protected.

Fitur yang direncanakan:

#### Sessions

- List sessions: `GET /sessions`
- Start/restore/restart/logout/destroy session sesuai scope client.
- Status/health/QR page per session.
- State session: `initializing`, `qr`, `authenticated`, `ready`, `disconnected`, `auth_failure`, `error`.

#### Messages dan Media

- Send text: `POST /sessions/:sessionId/messages/text`
- Reply/react/forward/edit/delete/star sesuai scope.
- Media base64/url/upload.
- Disable action jika session tidak `ready`.

#### Webhooks CRUD

- `GET /webhooks`
- `POST /webhooks`
- `GET /webhooks/:webhookId`
- `PATCH /webhooks/:webhookId`
- `DELETE /webhooks/:webhookId`
- `GET /webhooks/:webhookId/deliveries`
- `POST /webhooks/deliveries/:deliveryId/retry`

UI:

- Mask webhook secret setelah save.
- Delete dan retry wajib confirmation.
- Tampilkan delivery attempts, status, last error.

#### Queue dan Metrics

- Queue status/control per session:
  - `GET /sessions/:sessionId/queue`
  - `POST /sessions/:sessionId/queue/pause`
  - `POST /sessions/:sessionId/queue/resume`
- Metrics:
  - `GET /metrics`

### 9. Preset Scope untuk Form API Client

Sediakan preset agar admin mudah membuat client:

- Read Only:
  - `sessions:read`, `messages:read`, `contacts:read`, `chats:read`, `metrics:read`
- Messaging:
  - `sessions:read`, `messages:send`, `messages:reply`, `messages:react`, `media:send`
- Webhook Manager:
  - `webhooks:read`, `webhooks:create`, `webhooks:update`, `webhooks:delete`, `webhooks:retry`
- Group Admin:
  - `sessions:read`, `groups:read`, `groups:update`, `groups:participants:add`, `groups:participants:remove`, `groups:participants:promote`, `groups:participants:demote`, `groups:membership:read`, `groups:membership:update`, `groups:mention_everyone`
- Channel Manager:
  - `sessions:read`, `channels:read`, `channels:send`, `channels:update`, `channels:admin`, `channels:delete`
- Full Access:
  - `*`

### 10. UI/UX Minimal

Gunakan React dengan:

- React Router untuk routing.
- React Query atau SWR untuk fetching/cache.
- Form library ringan seperti React Hook Form.
- Styling sederhana: Tailwind CSS atau CSS modules.
- Komponen table sederhana dengan pagination lokal untuk fase awal.

Setiap page harus punya:

- Loading state.
- Empty state.
- Error state.
- Success feedback.
- Disabled/busy state pada tombol submit.
- Confirmation untuk destructive actions.

### 11. Keamanan Frontend

Wajib:

- Dashboard hanya render setelah admin auth valid.
- Admin key tidak disimpan di localStorage secara default.
- Generated API key hanya di memory dan dihapus setelah modal ditutup.
- Jangan log secret ke console.
- Mask field sensitif di tabel/detail/logs.
- Gunakan HTTPS di production.
- Jangan expose `ADMIN_API_KEY` sebagai env build-time frontend publik; untuk production lebih aman gunakan BFF/server-side session yang menyimpan admin key di server.

### 12. Tahapan Implementasi

#### Fase 1: Admin Core

1. Setup React app.
2. Buat admin login gate.
3. Buat API wrapper untuk `/admin/*`.
4. Buat layout dashboard.
5. Buat Overview page.
6. Buat API Clients list/create/detail/edit.
7. Buat revoke dan rotate key dengan confirmation dan secret reveal modal.

#### Fase 2: Observability dan Maintenance

1. Audit logs page.
2. Usage logs page.
3. Message logs page.
4. Persistence health page.
5. Retention cleanup form.

#### Fase 3: WhatsApp Operations

1. Mode temporary client API key.
2. Sessions page.
3. Webhooks CRUD.
4. Queue control.
5. Metrics page.
6. Basic message/media send forms.

### 13. Validasi

Manual checks:

- Login gagal dengan admin key kosong/salah.
- Login sukses dengan admin key valid.
- Create API client sukses dan raw key muncul sekali.
- Close secret modal menghapus raw key dari state.
- List API clients tidak menampilkan raw key.
- Edit client mengubah allowed sessions/scopes/rate limit/status.
- Revoke butuh confirmation dan status berubah revoked.
- Rotate butuh confirmation dan key baru muncul sekali.
- Audit/usage/message logs tidak menampilkan secret mentah.
- Logout menghapus semua credential dari state.

Automated checks yang disarankan:

- Unit test API wrapper untuk success/error envelope.
- Component test `RequireAdmin` agar route dashboard terkunci.
- Component test `SecretRevealModal` agar secret hilang saat close callback.
- Mock integration test API Clients CRUD dengan MSW.

### 14. Risiko dan Catatan

- Browser `EventSource` tidak dapat mengirim custom header `x-api-key`; realtime events perlu BFF/proxy atau polyfill yang mendukung header.
- Endpoint protected di luar `/admin` tidak bisa memakai admin key; perlu generated API key atau BFF.
- WhatsApp session state asynchronous; UI harus polling/refetch dan tidak menganggap start session langsung ready.
- Beberapa fitur channel/group bisa gagal karena keterbatasan runtime `whatsapp-web.js` atau permission akun.
- Production sebaiknya tidak mengirim admin key langsung ke SPA publik; gunakan backend-for-frontend untuk session admin.
