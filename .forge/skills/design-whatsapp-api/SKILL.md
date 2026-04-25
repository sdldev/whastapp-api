---
name: design-whatsapp-api
description: Design or evolve API contracts for this WhatsApp API project. Use when adding/changing Express endpoints, request/response schemas, auth scopes, webhook events, OpenAPI docs, compatibility, deprecation, or frontend/client-facing behavior before implementation.
---

# Design WhatsApp API

Adapted from the `api-designer` pattern in VoltAgent's awesome-codex-subagents and scoped to this repository.

## Workflow

1. Map the current contract surface:
   - route mount in `src/app.js`
   - route module in `src/routes`
   - Zod schema in `src/schemas`
   - service boundary in `src/services`
   - OpenAPI entry in `src/swagger.js`
   - auth scope mapping in `src/services/apiClient.service.js`
2. Propose the smallest endpoint/request/response change that supports the feature.
3. Check compatibility for existing clients:
   - preserve standardized `{ success, data, meta }` and `{ success, error, meta }` envelopes
   - avoid renaming/removing fields without migration notes
   - make optional/null behavior explicit
4. Define auth and tenancy behavior:
   - protected API route: `x-api-key`, generated API client, scope, allowed session, rate limit
   - admin route: `/admin` with `x-admin-key`
   - webhook ownership isolation for API clients
5. Decide failure semantics with stable `AppError` codes.
6. Update implementation plan to include Swagger and tests.

## Contract Checklist

- [ ] Endpoint path follows existing resource style under `/sessions/:sessionId/...`, `/webhooks`, `/admin`, `/metrics`, or `/health`.
- [ ] Request params/query/body are represented by Zod schemas.
- [ ] Success and error response shapes match existing helpers.
- [ ] Required auth scope is added or confirmed in `apiClientService.getRequiredScope()`.
- [ ] OpenAPI schemas, parameters, security, tags, and responses are updated.
- [ ] Test coverage can be added to `scripts/run-tests.js` without live WhatsApp when possible.

## Output

Return:
- proposed endpoint/contract changes
- affected files
- auth/scope and audit implications
- compatibility notes
- implementation and verification checklist
