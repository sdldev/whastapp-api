const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const env = require('./config/env');
const swaggerSpecs = require('./swagger');
const apiKeyMiddleware = require('./middlewares/apiKey.middleware');
const errorMiddleware = require('./middlewares/error.middleware');
const notFoundMiddleware = require('./middlewares/notFound.middleware');
const healthRoutes = require('./routes/health.routes');
const sessionRoutes = require('./routes/session.routes');
const messageRoutes = require('./routes/message.routes');
const mediaRoutes = require('./routes/media.routes');
const mentionRoutes = require('./routes/mention.routes');
const contactRoutes = require('./routes/contact.routes');
const webhookRoutes = require('./routes/webhook.routes');
const locationRoutes = require('./routes/location.routes');
const chatRoutes = require('./routes/chat.routes');
const groupRoutes = require('./routes/group.routes');
const pollRoutes = require('./routes/poll.routes');
const channelRoutes = require('./routes/channel.routes');
const communityRoutes = require('./routes/community.routes');
const eventRoutes = require('./routes/event.routes');
const queueRoutes = require('./routes/queue.routes');
const metricsRoutes = require('./routes/metrics.routes');
const adminRoutes = require('./routes/admin.routes');
const adminKeyMiddleware = require('./middlewares/adminKey.middleware');

const app = express();

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || env.corsOrigins.includes('*') || env.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json({ limit: env.jsonBodyLimit }));
app.use(express.urlencoded({ extended: true, limit: env.jsonBodyLimit }));
app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));

if (env.enableApiDocs) {
  app.get('/api-docs.json', (req, res) => res.json(swaggerSpecs.userSwaggerSpec));
  app.use('/api-docs', swaggerUi.serveFiles(swaggerSpecs.userSwaggerSpec), swaggerUi.setup(swaggerSpecs.userSwaggerSpec, {
    explorer: true,
    customSiteTitle: 'WhatsApp API User Documentation'
  }));
}

app.use('/health', healthRoutes);

if (env.enableApiDocs) {
  app.get('/admin/api-docs.json', adminKeyMiddleware, (req, res) => res.json(swaggerSpecs.adminSwaggerSpec));
  app.use('/admin/api-docs', adminKeyMiddleware, swaggerUi.serveFiles(swaggerSpecs.adminSwaggerSpec), swaggerUi.setup(swaggerSpecs.adminSwaggerSpec, {
    explorer: true,
    customSiteTitle: 'WhatsApp API Admin Documentation'
  }));
}

app.use('/admin', adminKeyMiddleware, adminRoutes);
app.use(apiKeyMiddleware);
app.use('/metrics', metricsRoutes);
app.use('/sessions', sessionRoutes);
app.use('/sessions/:sessionId/messages', messageRoutes);
app.use('/sessions/:sessionId/media', mediaRoutes);
app.use('/sessions/:sessionId/mentions', mentionRoutes);
app.use('/sessions/:sessionId/contacts', contactRoutes);
app.use('/sessions/:sessionId/location', locationRoutes);
app.use('/sessions/:sessionId/chats', chatRoutes);
app.use('/sessions/:sessionId/groups', groupRoutes);
app.use('/sessions/:sessionId/polls', pollRoutes);
app.use('/sessions/:sessionId/channels', channelRoutes);
app.use('/sessions/:sessionId/communities', communityRoutes);
app.use('/sessions/:sessionId/events', eventRoutes);
app.use('/sessions/:sessionId/queue', queueRoutes);
app.use('/webhooks', webhookRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;
