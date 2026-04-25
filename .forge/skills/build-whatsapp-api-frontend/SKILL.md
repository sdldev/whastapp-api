---
name: build-whatsapp-api-frontend
description: Build or review frontend/dashboard/API-client integration for this WhatsApp API project. Use when creating UI flows, API clients, admin dashboards, session/webhook screens, API key generation UX, forms, loading/error states, or frontend integration guidance against this backend's REST/OpenAPI contract.
---

# Build WhatsApp API Frontend

Adapted from the `frontend-developer` and `ui-designer` patterns in VoltAgent's awesome-codex-subagents and scoped to this repository's backend contract.

## Workflow

1. Map the user flow and backend contract:
   - Admin API client flow: see `FRONTEND_API_CLIENT_GUIDE.md`.
   - REST contract: use `/api-docs.json` or `src/swagger.js`.
   - Admin routes require `x-admin-key`.
   - Protected client routes require `x-api-key`.
2. Define UI state boundaries:
   - loading
   - success
   - empty
   - validation error
   - auth error
   - network/server error
3. Implement or recommend the smallest coherent UI change.
4. Keep secrets safe in UI behavior:
   - raw generated API keys appear only once
   - provide copy/download affordance immediately
   - do not log keys or persist raw keys in local storage by default
5. Align frontend validation with backend Zod/OpenAPI expectations.
6. Validate one normal flow and one high-risk edge flow.

## Project-Specific Frontend Patterns

### API Response Handling
- Success response shape: `{ success: true, data, meta }`.
- Error response shape: `{ success: false, error, meta }`.
- Show `error.message` to users when safe; use `error.code` for programmatic handling.
- Preserve `meta.timestamp` for support/debug display when useful.

### Admin Dashboard Flows
- API client create/list/detail/update/revoke/rotate flows use `/admin/api-clients` endpoints with `x-admin-key`.
- After create or rotate, show raw `data.apiKey` in a one-time secret reveal modal.
- Include clear warning: the key will not be shown again.
- Provide Copy API Key and Download `.env` actions.
- Never display raw `apiKey` in list/detail pages after the one-time response.

### Session and Messaging UX
- Treat WhatsApp session state as asynchronous and eventually changing.
- QR/login flows need polling or refresh states for `initializing`, `qr`, `authenticated`, `ready`, `disconnected`, `auth_failure`, and `error`.
- Disable send/message/media actions unless session status is `ready`.
- For message/media sending, show queue/delay feedback when relevant.

### Webhook UX
- Make webhook ownership implicit to the active API client/admin context.
- Mask webhook secrets after save.
- Show delivery status, attempts, last error, and retry affordance where contract supports it.

## UI Quality Checklist

- [ ] Forms mirror backend required/optional fields.
- [ ] Error, empty, loading, and success states are explicit.
- [ ] Buttons have disabled/busy states for in-flight requests.
- [ ] Dangerous actions such as revoke, delete, logout, destroy, or rotate key require confirmation.
- [ ] Keyboard focus is moved to modal/dialog content and returned to the trigger.
- [ ] Secrets are not logged, persisted, or exposed after one-time display.
- [ ] API wrappers centralize base URL, headers, response envelope parsing, and error handling.

## Output

Return:
- screen/component or API-client path changed or proposed
- backend endpoints and headers used
- secret-handling and error-state behavior
- validation performed
- remaining integration risks against live backend/session state
