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

const apiClientService = require('../src/services/apiClient.service');
const auditLogService = require('../src/services/auditLog.service');
const webhookService = require('../src/services/webhook.service');
const sendQueue = require('../src/services/sendQueue.service');

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
  await runTest('api client create/auth/scope/session/rate-limit', () => {
    const created = apiClientService.createApiClient({
      name: 'Test Client',
      allowedSessions: ['default'],
      scopes: ['messages:send'],
      rateLimitPerMinute: 2
    });

    assert.ok(created.id.startsWith('cli_'));
    assert.ok(created.apiKey.startsWith(`wa_sk_live_${created.id}_`));
    assert.strictEqual(created.keys[0].keyHash, undefined);

    const auth = apiClientService.authenticateApiKey(created.apiKey);
    assert.strictEqual(auth.client.id, created.id);
    assert.doesNotThrow(() => apiClientService.authorizeScope(auth.client, 'messages:send'));
    assert.throws(() => apiClientService.authorizeScope(auth.client, 'media:send'), /permission/);
    assert.doesNotThrow(() => apiClientService.authorizeSession(auth.client, 'default'));
    assert.throws(() => apiClientService.authorizeSession(auth.client, 'sales'), /not allowed/);

    assert.strictEqual(apiClientService.checkRateLimit(auth.client).remaining, 1);
    assert.strictEqual(apiClientService.checkRateLimit(auth.client).remaining, 0);
    assert.throws(() => apiClientService.checkRateLimit(auth.client), /Too many requests/);
  });

  await runTest('audit log redacts sensitive fields and filters entries', () => {
    auditLogService.appendAuditLog({
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

    const entries = auditLogService.listAuditLogs({ actorId: 'cli_test', sessionId: 'default', limit: 10 });
    assert.strictEqual(entries.length, 1);
    assert.strictEqual(entries[0].metadata.body.data, '[REDACTED]');
    assert.strictEqual(entries[0].metadata.body.apiKey, '[REDACTED]');
  });

  await runTest('webhook create/list/update/delete ownership basics', () => {
    const actor = { authMode: 'api-client', clientId: 'cli_owner' };
    const other = { authMode: 'api-client', clientId: 'cli_other' };
    const webhook = webhookService.createWebhook({
      url: 'https://example.com/hook',
      events: ['message.received'],
      secret: 'secret'
    }, actor);

    assert.strictEqual(webhook.ownerClientId, 'cli_owner');
    assert.strictEqual(webhook.hasSecret, true);
    assert.strictEqual(webhookService.listWebhooks(actor).length, 1);
    assert.strictEqual(webhookService.listWebhooks(other).length, 0);
    assert.throws(() => webhookService.getWebhook(webhook.id, other), /not allowed/);

    const updated = webhookService.updateWebhook(webhook.id, { active: false, events: ['*'] }, actor);
    assert.strictEqual(updated.active, false);
    assert.deepStrictEqual(updated.events, ['*']);

    assert.strictEqual(webhookService.deleteWebhook(webhook.id, actor), true);
  });

  await runTest('send queue state pause resume and metrics summary', () => {
    const initial = sendQueue.getSessionSendState('default');
    assert.strictEqual(initial.sessionId, 'default');
    assert.ok(initial.delayMs >= 5000);

    const paused = sendQueue.pauseSession('default');
    assert.strictEqual(paused.paused, true);

    const summary = sendQueue.getQueueSummary();
    assert.ok(summary.pausedSessions >= 1);
    assert.ok(Array.isArray(summary.states));

    const resumed = sendQueue.resumeSession('default');
    assert.strictEqual(resumed.paused, false);
  });

  await runTest('scope mapping covers production reliability endpoints', () => {
    assert.strictEqual(apiClientService.getRequiredScope('GET', '/metrics'), 'metrics:read');
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
