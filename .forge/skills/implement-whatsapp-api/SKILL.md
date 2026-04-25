---
name: implement-whatsapp-api
description: Implement scoped backend changes in this Node.js CommonJS Express whatsapp-web.js API. Use for route/service/schema changes, WhatsApp session operations, webhook/queue/API-client behavior, bug fixes, and OpenAPI updates after the desired behavior is known.
---

# Implement WhatsApp API

Adapted from the `backend-developer` and `javascript-pro` patterns in VoltAgent's awesome-codex-subagents and scoped to this repository.

## Workflow

1. Locate the owning path:
   - HTTP entry in `src/app.js` and `src/routes/*`
   - request schema in `src/schemas/*`
   - domain logic in `src/services/*`
   - response/error helpers in `src/utils/*`
   - API docs in `src/swagger.js`
2. Implement the smallest coherent change.
3. Keep route handlers thin:
   - `validate(schema)` for input
   - `asyncHandler` for async errors
   - service call for business logic
   - `success()` for responses
4. Put expected failures in `AppError` with stable codes and status codes.
5. Preserve CommonJS. Do not convert to ESM or TypeScript.
6. For WhatsApp operations, call `clientManager.ensureReady(sessionId)` before actions requiring ready clients.
7. For protected endpoints, update `apiClientService.getRequiredScope()` and regression tests.
8. Update `src/swagger.js` for API contract changes.
9. Run `npm run check`; run `npm test` for behavior changes when feasible.

## Safety Rules

- Do not leak raw API keys, tokens, webhook secrets, key hashes, base64 media, or sensitive request bodies.
- Do not destructively modify `data/`, `uploads/`, or `.wwebjs_auth` unless explicitly requested.
- Do not hard-code ports, credentials, paths, rate limits, Puppeteer options, Redis, or Postgres config.
- Preserve webhook ownership isolation and session lifecycle webhook dispatches.

## Output

Return:
- files changed and behavior summary
- auth/scope/webhook/session impact
- validation commands run
- unverified runtime assumptions, especially live WhatsApp, QR, Redis, Postgres, Docker, or external webhooks
