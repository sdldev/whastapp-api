const http = require('http');
const app = require('./src/app');
const env = require('./src/config/env');
const logger = require('./src/utils/logger');
const clientManager = require('./src/services/clientManager.service');
const persistence = require('./src/services/persistence.service');

const server = http.createServer(app);
let shutdownStarted = false;

async function bootstrap() {
  await persistence.initPersistence();
  server.listen(env.port, () => {
    logger.info({ port: env.port, nodeEnv: env.nodeEnv }, 'WhatsApp API server started');
  });
}

bootstrap().catch((error) => {
  logger.error({ err: error }, 'Failed to start WhatsApp API server');
  process.exit(1);
});

async function shutdown(signal) {
  if (shutdownStarted) return;
  shutdownStarted = true;

  logger.info({ signal }, 'Shutting down WhatsApp API server');
  server.close(async () => {
    await Promise.allSettled([
      clientManager.destroyAll(),
      persistence.closePersistence()
    ]);
    logger.info('Shutdown completed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 30000).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error) => {
  logger.error({ err: error }, 'Uncaught exception');
  process.exit(1);
});
