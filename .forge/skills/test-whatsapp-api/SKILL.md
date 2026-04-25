---
name: test-whatsapp-api
description: Add or improve automated tests for this WhatsApp API project. Use for regression coverage around API clients, scopes, allowed sessions, rate limits, webhooks, queue state, persistence, validation, and service logic that can run without live WhatsApp QR/login.
---

# Test WhatsApp API

Adapted from the `test-automator` pattern in VoltAgent's awesome-codex-subagents and scoped to this repository.

## Workflow

1. Identify the behavior boundary and failure surface.
2. Prefer deterministic tests in `scripts/run-tests.js` for logic that does not need live WhatsApp.
3. Cover at least:
   - one normal path
   - one failure/permission path
   - one integration boundary such as scope mapping, ownership, persistence, or queue state
4. Keep tests lightweight with Node `assert` unless the user explicitly requests a new test framework.
5. Avoid tests requiring QR scan, live WhatsApp connectivity, Redis, Postgres, or external webhook receivers unless explicitly requested.
6. Run `npm test` after test changes; run `npm run check` if only syntax validation is needed.

## High-Value Test Targets

- `apiClientService.createApiClient`, `authenticateApiKey`, `authorizeScope`, `authorizeSession`, `checkRateLimit`.
- `apiClientService.getRequiredScope()` for every new protected route.
- Webhook create/list/update/delete ownership behavior.
- Queue pause/resume/session state behavior.
- Redaction behavior for audit or sensitive metadata.
- Zod validation schemas for new route contracts.

## Quality Rules

- Assert behavior contracts, not private implementation details unless no public seam exists.
- Reset or isolate mutable in-memory state where possible.
- Keep generated test data obviously non-secret.
- Do not mutate production-like runtime data under `data/`, `uploads/`, or `.wwebjs_auth` unless the test already uses isolated fixtures.

## Output

Return:
- tests added or changed
- behavior and risk covered
- validation command output summary
- remaining manual/integration verification needs
