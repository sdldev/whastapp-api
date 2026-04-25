---
name: audit-whatsapp-api-security
description: Perform focused security review for this WhatsApp API project. Use when checking auth flows, API key generation/storage, scopes, allowed sessions, admin routes, webhook ownership/secrets, audit logging, input validation, media uploads, Docker/env config, or secret leakage risks.
---

# Audit WhatsApp API Security

Adapted from the `security-auditor` pattern in VoltAgent's awesome-codex-subagents and scoped to this repository.

## Workflow

1. Define the security boundary:
   - public/protected/admin route
   - API client and scope path
   - session ownership or allowed session constraint
   - webhook ownership and secret behavior
   - persistence/logging surface
2. Separate confirmed evidence from hypotheses.
3. Review attack paths:
   - missing/incorrect auth scope
   - allowed session bypass
   - admin key bypass
   - webhook cross-client access
   - secret leakage in logs/errors/docs/tests
   - unsafe media upload/download handling
   - unvalidated params/query/body
4. Recommend the smallest fix that reduces risk without broad refactors.
5. Validate with `npm run check` or `npm test` when changes are made.

## Project-Specific Checks

- `x-api-key` protected routes should map to the right scope in `apiClientService.getRequiredScope()`.
- `/admin` endpoints must remain behind `x-admin-key`.
- Generated API keys must be returned only once and stored hashed.
- Audit logs must redact sensitive fields.
- Webhook listing, reading, updating, deleting, and delivery access must enforce owner isolation.
- Runtime files `.env`, `.wwebjs_auth`, API client stores, usage logs, audit logs, delivery logs, and uploads must not be committed or exposed.

## Output

Return:
- exact scope reviewed
- findings with evidence, impact, and prerequisites
- minimal remediation steps
- verification performed
- residual risk and follow-up actions
