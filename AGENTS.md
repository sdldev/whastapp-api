# Development Guidelines for WhatsApp API

## Core Development Rules

### Application Runtime
- This project is a Node.js 18+ CommonJS REST API built with `express` and `whatsapp-web.js`.
- Do not assume a live WhatsApp session is available during development or automated tests.
- Do not require QR scan, live WhatsApp connectivity, Redis, Postgres, or external webhook receivers unless explicitly requested.
- Treat `whatsapp-web.js` as an unofficial WhatsApp client; avoid aggressive automation and preserve send delay/queue safeguards.

### Package Management
- Use `npm` commands only; do not introduce `yarn` or `pnpm`.
- Check `package.json` before running commands.
- Available validation commands:
  - `npm run check` for syntax validation.
  - `npm test` for syntax plus lightweight business-rule tests.

### Code Quality Standards
- Preserve CommonJS style with `require` and `module.exports`; do not convert the project to ESM or TypeScript.
- Keep route handlers thin: validate request data, call services, then return standardized responses.
- Use meaningful names and keep functions focused.
- Add comments only for non-obvious behavior or project-specific constraints.

## Project Structure

```txt
├── index.js                 # HTTP server startup and graceful shutdown
├── src/
│   ├── app.js               # Express app wiring, middleware, routes, Swagger
│   ├── config/              # Environment parsing and runtime config
│   ├── constants/           # Shared constants
│   ├── middlewares/         # Auth, validation, not-found, error middleware
│   ├── routes/              # Express route modules
│   ├── schemas/             # Zod request schemas
│   ├── services/            # Business logic and integrations
│   ├── store/               # Persistence/store helpers
│   ├── utils/               # Response, errors, logger, async helpers
│   └── swagger.js           # OpenAPI specification
├── scripts/
│   ├── check-syntax.js      # JavaScript syntax validation
│   └── run-tests.js         # Lightweight Node tests
├── data/                    # Runtime persistence; avoid destructive edits
├── uploads/                 # Runtime upload artifacts
└── .wwebjs_auth/            # WhatsApp LocalAuth runtime state
```

## Development Focus Areas

### Routes and Validation
- Define request validation with Zod schemas in `src/schemas`.
- Use `validate(schema)` middleware for params, query, and body validation.
- Read validated payloads from `req.validated` when implementing route handlers.
- Wrap async route handlers with `asyncHandler`.

### Services and Business Logic
- Put WhatsApp, webhook, queue, API client, persistence, and audit behavior in `src/services`.
- Use `clientManager.ensureReady(sessionId)` before actions that require an authenticated WhatsApp client.
- Preserve WhatsApp session lifecycle events and webhook dispatch behavior.
- Preserve graceful shutdown so active clients are destroyed on process termination.

### API Responses and Errors
- Return successful responses through `success(res, data, statusCode, extraMeta)`.
- Return expected failures by throwing `AppError` with clear status code and stable error code.
- Let centralized error middleware format validation, operational, and unexpected errors.
- Do not create ad-hoc JSON response envelopes.

### Security, Auth, and Audit
- Preserve generated API client authentication with scopes, allowed sessions, and rate limits.
- Legacy `API_KEY` fallback may remain, but generated API clients are preferred for production behavior.
- Keep admin endpoints under `/admin` and protected by `x-admin-key`.
- When adding protected endpoints, update `apiClientService.getRequiredScope()` and add tests for scope mapping.
- Maintain audit logging for admin/protected routes and redact sensitive metadata.

### Webhooks and Ownership
- Preserve webhook ownership isolation between API clients.
- One API client must not read, update, or delete another client's webhook registrations.
- Preserve webhook timeout/retry behavior and avoid blocking HTTP request handlers on long-running deliveries.

### OpenAPI
- Update `src/swagger.js` whenever API routes, payloads, responses, tags, or security requirements change.
- Reuse existing OpenAPI components, schemas, security schemes, and response conventions.

## Restrictions and Limitations

### What NOT to do
- Do not commit `.env`, generated API keys, `.wwebjs_auth`, runtime logs, uploaded files, or persisted runtime data containing secrets.
- Do not log or expose raw API keys, tokens, passwords, webhook secrets, key hashes, media base64 payloads, or sensitive request bodies.
- Do not hard-code ports, credentials, paths, rate limits, Puppeteer options, Redis settings, or Postgres settings.
- Do not destructively modify `data/`, `uploads/`, or `.wwebjs_auth` unless explicitly requested.
- Do not add new frameworks, module systems, package managers, or documentation files unless explicitly requested.

### What TO do
- Use environment config from `src/config/env.js`.
- Keep API behavior compatible with existing standardized response shapes.
- Add or update tests in `scripts/run-tests.js` for business rules that do not need a live WhatsApp session.
- Run `npm run check` after code changes when feasible.
- Run `npm test` for behavior changes when feasible.

## Before Completing Any Task
- [ ] Code follows CommonJS and existing project layering.
- [ ] Request validation is covered by Zod schemas where applicable.
- [ ] Async route errors flow through `asyncHandler` and centralized error middleware.
- [ ] Responses use `success()`/`fail()` conventions.
- [ ] Auth scopes, allowed sessions, rate limits, and audit logging remain correct.
- [ ] Sensitive data is not exposed in logs, errors, responses, docs, or tests.
- [ ] `src/swagger.js` is updated for API contract changes.
- [ ] `npm run check` and/or `npm test` has been run when feasible, or blockers are clearly reported.
