const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'whatsapp-api-tests-'));
process.env.API_CLIENT_STORE_FILE = path.join(tempRoot, 'api-clients.json');
process.env.API_USAGE_LOG_FILE = path.join(tempRoot, 'usage.log');
process.env.AUDIT_LOG_FILE = path.join(tempRoot, 'audit.log');
process.env.WEBHOOK_STORE_FILE = path.join(tempRoot, 'webhooks.json');
process.env.WEBHOOK_DELIVERY_LOG_FILE = path.join(tempRoot, 'webhook-deliveries.log');
process.env.API_KEY_PEPPER = 'test-pepper';
process.env.DEFAULT_API_CLIENT_RATE_LIMIT_PER_MINUTE = '2';
process.env.SEND_QUEUE_MAX_PENDING_PER_SESSION = '1';
process.env.MESSAGE_CACHE_MAX_ENTRIES = '2';
process.env.MESSAGE_CACHE_TTL_MS = '60000';
process.env.WEBHOOK_DELIVERY_CONCURRENCY = '1';
process.env.WEBHOOK_DELIVERY_MAX_QUEUE = '10';
process.env.WEBHOOK_MAX_CONSECUTIVE_FAILURES = '1';
process.env.PERSISTENCE_DRIVER = 'file';
process.env.SESSION_INITIALIZE_TIMEOUT_MS = '1000';
process.env.SESSION_RESTORE_CONCURRENCY = '2';
process.env.JSONL_LOG_MAX_BYTES = '1024';
process.env.JSONL_LOG_MAX_BACKUP_FILES = '2';

const apiClientService = require('../src/services/apiClient.service');
const auditLogService = require('../src/services/auditLog.service');
const webhookService = require('../src/services/webhook.service');
const sendQueue = require('../src/services/sendQueue.service');
const apiKeyMiddleware = require('../src/middlewares/apiKey.middleware');
const { assertSafeOutboundUrl, isPrivateAddress } = require('../src/utils/outboundUrl');
const messageCache = require('../src/store/messageCache.store');
const clientManager = require('../src/services/clientManager.service');
const messageLogService = require('../src/services/messageLog.service');
const env = require('../src/config/env');
const persistence = require('../src/services/persistence.service');
const { appendJsonLine } = require('../src/utils/jsonlFile');

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

async function main() {
  await runTest('api client create/auth/scope/session/rate-limit', async () => {
    const created = await apiClientService.createApiClient({
      name: 'Test Client',
      allowedSessions: ['default'],
      scopes: ['messages:send'],
      rateLimitPerMinute: 2
    });

    assert.ok(created.id.startsWith('cli_'));
    assert.ok(created.apiKey.startsWith(`wa_sk_live_${created.id}_`));
    assert.strictEqual(created.keys[0].keyHash, undefined);

    const auth = await apiClientService.authenticateApiKey(created.apiKey);
    assert.strictEqual(auth.client.id, created.id);
    assert.doesNotThrow(() => apiClientService.authorizeScope(auth.client, 'messages:send'));
    assert.throws(() => apiClientService.authorizeScope(auth.client, 'media:send'), /permission/);
    assert.doesNotThrow(() => apiClientService.authorizeSession(auth.client, 'default'));
    assert.throws(() => apiClientService.authorizeSession(auth.client, 'sales'), /not allowed/);

    assert.strictEqual(apiClientService.checkRateLimit(auth.client).remaining, 1);
    assert.strictEqual(apiClientService.checkRateLimit(auth.client).remaining, 0);
    assert.throws(() => apiClientService.checkRateLimit(auth.client), /Too many requests/);
  });

  await runTest('api key middleware rejects missing keys and awaits generated client auth', async () => {
    const created = await apiClientService.createApiClient({
      name: 'Middleware Client',
      allowedSessions: ['default'],
      scopes: ['messages:send'],
      rateLimitPerMinute: 2
    });

    const rejectedReq = {
      get: () => undefined,
      path: '/sessions/default/messages/text',
      method: 'POST'
    };
    await new Promise((resolve, reject) => {
      apiKeyMiddleware(rejectedReq, { on() {}, set() {} }, (error) => {
        try {
          assert.ok(error);
          assert.strictEqual(error.code, 'INVALID_API_KEY');
          resolve();
        } catch (assertionError) {
          reject(assertionError);
        }
      });
    });

    const acceptedReq = {
      get: (header) => header === 'x-api-key' ? created.apiKey : null,
      path: '/sessions/default/messages/text',
      originalUrl: '/sessions/default/messages/text',
      method: 'POST',
      params: {},
      query: {},
      body: { message: 'hello' },
      ip: '127.0.0.1'
    };
    const acceptedRes = {
      headers: {},
      set(name, value) {
        this.headers[name] = value;
      },
      on(event, handler) {
        if (event === 'finish') this.finishHandler = handler;
      }
    };

    await new Promise((resolve, reject) => {
      apiKeyMiddleware(acceptedReq, acceptedRes, (error) => {
        try {
          assert.ifError(error);
          assert.strictEqual(acceptedReq.authMode, 'api-client');
          assert.strictEqual(acceptedReq.apiClient.id, created.id);
          assert.strictEqual(acceptedReq.requiredScope, 'messages:send');
          assert.strictEqual(acceptedRes.headers['X-RateLimit-Limit'], '2');
          resolve();
        } catch (assertionError) {
          reject(assertionError);
        }
      });
    });
  });

  await runTest('audit log redacts sensitive fields and filters entries', async () => {
    await auditLogService.appendAuditLog({
      actorType: 'api_client',
      actorId: 'cli_test',
      action: 'messages:send',
      sessionId: 'default',
      statusCode: 201,
      metadata: {
        body: {
          message: 'hello',
          data: 'base64-secret',
          apiKey: 'secret-key'
        }
      }
    });

    const entries = await auditLogService.listAuditLogs({ actorId: 'cli_test', sessionId: 'default', limit: 10 });
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].metadata.body.data, '[REDACTED]');
    assert.strictEqual(entries[0].metadata.body.apiKey, '[REDACTED]');
    assert.strictEqual(auditLogService.redactObject({ Authorization: 'Bearer token' }).Authorization, '[REDACTED]');
    assert.strictEqual(auditLogService.redactObject({ webhookSecret: 'secret' }).webhookSecret, '[REDACTED]');
    assert.strictEqual(auditLogService.redactObject({ refresh_token: 'token' }).refresh_token, '[REDACTED]');
  });

  await runTest('outbound URL hardening blocks private targets and validates allowlist', async () => {
    assert.strictEqual(isPrivateAddress('127.0.0.1'), true);
    assert.strictEqual(isPrivateAddress('10.0.0.1'), true);
    assert.strictEqual(isPrivateAddress('8.8.8.8'), false);
    await assert.rejects(() => assertSafeOutboundUrl('http://127.0.0.1:8080/hook'), /private or reserved/);
    await assert.rejects(() => assertSafeOutboundUrl('file:///tmp/test'), /HTTP or HTTPS/);
  });

  await runTest('persistence initializes file mode without postgres and exposes health', async () => {
    await persistence.initPersistence();
    assert.strictEqual(persistence.isPostgresConfigured(), false);
    assert.strictEqual(persistence.isPostgresEnabled(), false);
    const health = await persistence.getHealth();
    assert.strictEqual(health.driver, 'file');
    assert.strictEqual(health.postgres.enabled, false);
    await persistence.closePersistence();
  });

  await runTest('advanced health hides stored session ids by default', async () => {
    const clientManager = require('../src/services/clientManager.service');
    const health = await clientManager.getAdvancedHealth();
    assert.ok(health.storedSessions);
    assert.ok(health.persistence);
    assert.strictEqual(health.persistence.driver, 'file');
    assert.strictEqual(Object.prototype.hasOwnProperty.call(health.storedSessions, 'sessionIds'), false);
  });

  await runTest('webhook create/list/update/delete ownership basics', async () => {
    const actor = { authMode: 'api-client', clientId: 'cli_owner' };
    const other = { authMode: 'api-client', clientId: 'cli_other' };
    const webhook = await webhookService.createWebhook({
      url: 'https://example.com/hook',
      events: ['message.received'],
      secret: 'secret'
    }, actor);

    assert.strictEqual(webhook.ownerClientId, 'cli_owner');
    assert.strictEqual(webhook.hasSecret, true);
    assert.strictEqual((await webhookService.listWebhooks(actor)).length, 1);
    assert.strictEqual((await webhookService.listWebhooks(other)).length, 0);
    await assert.rejects(() => webhookService.getWebhook(webhook.id, other), /not allowed/);

    const updated = await webhookService.updateWebhook(webhook.id, { active: false, events: ['*'] }, actor);
    assert.strictEqual(updated.active, false);
    assert.deepStrictEqual(updated.events, ['*']);

    assert.strictEqual(await webhookService.deleteWebhook(webhook.id, actor), true);
  });

  await runTest('send queue state pause resume max pending and metrics summary', async () => {
    const initial = sendQueue.getSessionSendState('default');
    assert.strictEqual(initial.sessionId, 'default');
    assert.ok(initial.delayMs >= 5000);
    assert.strictEqual(initial.maxPending, 1);

    const blocked = sendQueue.runWithDelay('blocked', () => new Promise(() => {}));
    assert.ok(blocked);
    await assert.rejects(() => sendQueue.runWithDelay('blocked', () => Promise.resolve()), /Send queue is full/);
    const blockedState = sendQueue.getSessionSendState('blocked');
    assert.strictEqual(blockedState.pending, 1);
    assert.strictEqual(blockedState.stats.rejected, 1);

    const paused = sendQueue.pauseSession('default');
    assert.strictEqual(paused.paused, true);

    const summary = sendQueue.getQueueSummary();
    assert.ok(summary.pausedSessions >= 1);
    assert.ok(summary.totalPending >= 1);
    assert.strictEqual(summary.maxPendingPerSession, 1);
    assert.ok(Array.isArray(summary.states));

    const resumed = sendQueue.resumeSession('default');
    assert.strictEqual(resumed.paused, false);
  });

  await runTest('message cache enforces LRU max entries', () => {
    messageCache.setMessage({ id: { _serialized: 'msg_1' }, body: 'one' });
    messageCache.setMessage({ id: { _serialized: 'msg_2' }, body: 'two' });
    assert.strictEqual(messageCache.getMessage('msg_1').body, 'one');
    messageCache.setMessage({ id: { _serialized: 'msg_3' }, body: 'three' });

    assert.strictEqual(messageCache.getCacheStats().size, 2);
    assert.ok(messageCache.getMessage('msg_1'));
    assert.strictEqual(messageCache.getMessage('msg_2'), undefined);
    assert.ok(messageCache.getMessage('msg_3'));
  });

  await runTest('webhook delivery queue exposes bounded state and dispatch remains async-safe', async () => {
    const queueState = webhookService.getDeliveryQueueState();
    assert.strictEqual(queueState.concurrency, 1);
    assert.strictEqual(queueState.maxQueue, 10);
    assert.ok(queueState.queued >= 0);
    assert.ok(queueState.active >= 0);

    await webhookService.dispatch('message.received', 'default', { id: 'msg-test' });
  });

  await runTest('session timeout and log rotation helpers are configured', async () => {
    assert.strictEqual(env.sessionInitializeTimeoutMs, 1000);
    assert.strictEqual(env.sessionRestoreConcurrency, 2);
    await assert.rejects(
      () => clientManager.withTimeout(new Promise(() => {}), 1, 'timeout test', 'TEST_TIMEOUT'),
      (error) => error.code === 'TEST_TIMEOUT'
    );

    const rotatingLog = path.join(tempRoot, 'rotating-jsonl.log');
    for (let index = 0; index < 20; index += 1) {
      appendJsonLine(rotatingLog, { index, payload: 'x'.repeat(100) });
    }
    assert.ok(fs.existsSync(rotatingLog));
    assert.ok(fs.existsSync(`${rotatingLog}.1`));
    assert.ok(fs.statSync(rotatingLog).size < env.jsonlLogMaxBytes + 256);
  });

  await runTest('message log builder truncates body and preserves metadata', () => {
    const longBody = 'x'.repeat(env.messageLogBodyMaxLength + 25);
    const log = messageLogService.buildOutboundLog({
      sessionId: 'default',
      chatId: '6281234567890@c.us',
      message: longBody,
      status: 'failed',
      error: new Error('send failed'),
      actor: { authMode: 'api-client', clientId: 'cli_test' },
      requestId: 'req-test'
    });

    assert.strictEqual(log.apiClientId, 'cli_test');
    assert.strictEqual(log.body.length, env.messageLogBodyMaxLength);
    assert.strictEqual(log.status, 'failed');
    assert.strictEqual(log.requestId, 'req-test');
    assert.strictEqual(log.hasMedia, false);
  });

  await runTest('scope mapping covers production reliability endpoints', () => {
    assert.strictEqual(apiClientService.getRequiredScope('GET', '/metrics'), 'metrics:read');
    assert.strictEqual(apiClientService.getRequiredScope('GET', '/sessions/default/messages/logs'), 'messages:read');
    assert.strictEqual(apiClientService.getRequiredScope('GET', '/sessions/default/queue'), 'queue:read');
    assert.strictEqual(apiClientService.getRequiredScope('POST', '/sessions/default/queue/pause'), 'queue:manage');
    assert.strictEqual(apiClientService.getRequiredScope('GET', '/sessions/default/groups/group@g.us/membership-requests'), 'groups:membership:read');
    assert.strictEqual(apiClientService.getRequiredScope('POST', '/sessions/default/groups/group@g.us/membership-requests/approve'), 'groups:membership:update');
  });

  if (process.exitCode) process.exit(process.exitCode);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
