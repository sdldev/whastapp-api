const pino = require('pino');
const env = require('../config/env');

const allowedLevels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'];
const configuredLevel = String(process.env.API_LOG_LEVEL || process.env.LOG_LEVEL || 'info').toLowerCase();
const level = allowedLevels.includes(configuredLevel) ? configuredLevel : 'info';

const logger = pino({
  level,
  transport: env.nodeEnv === 'development'
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard'
        }
      }
    : undefined
});

module.exports = logger;
