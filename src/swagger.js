const swaggerJsdoc = require('swagger-jsdoc');

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'WhatsApp API Interface',
      version: '1.0.0',
      description: 'REST API dan webhook interface berbasis whatsapp-web.js untuk session auth, messaging, media, mentions, contacts, chats, groups, polls, dan webhook events.'
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Local development server'
      }
    ],
    tags: [
      { name: 'Health', description: 'API health check' },
      { name: 'Sessions', description: 'WhatsApp session lifecycle dan QR authentication' },
      { name: 'Messages', description: 'Text message, reply, reaction, dan deprecated message features' },
      { name: 'Media', description: 'Send media dari base64, URL, upload, dan download incoming media' },
      { name: 'Mentions', description: 'User mentions dan group mentions' },
      { name: 'Contacts', description: 'Contact info, profile picture, block/unblock, dan contact card' },
      { name: 'Location', description: 'Send location message' },
      { name: 'Chats', description: 'Chat info dan mute/unmute' },
      { name: 'Groups', description: 'Group invite, metadata, settings, participants, dan mention everyone' },
      { name: 'Polls', description: 'Create poll dan vote poll' },
      { name: 'Channels', description: 'Channel read, send, admin, subscribers, dan settings dengan feature detection' },
      { name: 'Metrics', description: 'Runtime metrics untuk sessions, queue, dan process' },
      { name: 'Queue', description: 'In-memory send queue status dan control per session' },
      { name: 'Admin', description: 'Generate dan kelola API client untuk integrasi frontend/client eksternal' },
      { name: 'Webhooks', description: 'Webhook registration dan event delivery configuration' },
      { name: 'Unsupported', description: 'Unsupported atau deprecated features' }
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API key client hasil generate dari endpoint admin. Legacy API_KEY env masih didukung sebagai fallback.'
        },
        AdminKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-admin-key',
          description: 'Admin key untuk endpoint /admin/*, berasal dari ADMIN_API_KEY.'
        }
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { type: 'object' },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Invalid request payload' },
                details: {}
              }
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        SessionStatus: {
          type: 'object',
          properties: {
            sessionId: { type: 'string', example: 'default' },
            status: { type: 'string', example: 'ready' },
            qr: { type: 'string', nullable: true },
            qrDataUrl: { type: 'string', nullable: true },
            me: { type: 'object', nullable: true },
            lastError: { type: 'string', nullable: true },
            startedAt: { type: 'string', format: 'date-time', nullable: true },
            readyAt: { type: 'string', format: 'date-time', nullable: true },
            disconnectedAt: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        Webhook: {
          type: 'object',
          properties: {
            id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
            url: { type: 'string', example: 'https://example.com/whatsapp/webhook' },
            events: {
              type: 'array',
              items: { type: 'string' },
              example: ['message.received', 'session.ready']
            },
            active: { type: 'boolean', example: true },
            ownerClientId: { type: 'string', nullable: true, example: 'cli_1234' },
            hasSecret: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        WebhookDelivery: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            webhookId: { type: 'string' },
            ownerClientId: { type: 'string', nullable: true },
            event: { type: 'string', example: 'message.received' },
            sessionId: { type: 'string', example: 'default' },
            status: { type: 'string', example: 'delivered' },
            attempts: { type: 'integer', example: 1 },
            statusCode: { type: 'integer', nullable: true, example: 200 },
            error: { type: 'string', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            deliveredAt: { type: 'string', format: 'date-time', nullable: true },
            failedAt: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        SendTextRequest: {
          type: 'object',
          required: ['to', 'message'],
          properties: {
            to: { type: 'string', example: '6281234567890' },
            message: { type: 'string', example: 'Halo dari WhatsApp API' },
            options: { type: 'object', example: { linkPreview: true } }
          }
        },
        MediaBase64Request: {
          type: 'object',
          required: ['to', 'mimetype', 'data'],
          properties: {
            to: { type: 'string', example: '6281234567890' },
            mimetype: { type: 'string', example: 'image/png' },
            data: { type: 'string', description: 'Base64 media content' },
            filename: { type: 'string', example: 'image.png' },
            caption: { type: 'string', example: 'Ini gambar' }
          }
        },
        MediaUrlRequest: {
          type: 'object',
          required: ['to', 'url'],
          properties: {
            to: { type: 'string', example: '6281234567890' },
            url: { type: 'string', example: 'https://example.com/file.pdf' },
            caption: { type: 'string', example: 'Ini dokumen' }
          }
        },
        ApiClient: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'cli_8f2a7b1c9d0e1234' },
            name: { type: 'string', example: 'Client Toko A' },
            description: { type: 'string', example: 'Integrasi CRM Toko A' },
            status: { type: 'string', example: 'active' },
            allowedSessions: { type: 'array', items: { type: 'string' }, example: ['sales'] },
            scopes: { type: 'array', items: { type: 'string' }, example: ['sessions:read', 'messages:send'] },
            rateLimitPerMinute: { type: 'integer', example: 60 },
            expiresAt: { type: 'string', format: 'date-time', nullable: true },
            lastUsedAt: { type: 'string', format: 'date-time', nullable: true }
          }
        },
        AuditLog: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'audit_abc123' },
            createdAt: { type: 'string', format: 'date-time' },
            actorType: { type: 'string', example: 'api_client' },
            actorId: { type: 'string', nullable: true, example: 'cli_8f2a7b1c9d0e1234' },
            apiKeyId: { type: 'string', nullable: true, example: 'key_123' },
            authMode: { type: 'string', nullable: true, example: 'api-client' },
            action: { type: 'string', example: 'messages:send' },
            sessionId: { type: 'string', nullable: true, example: 'default' },
            method: { type: 'string', example: 'POST' },
            path: { type: 'string', example: '/sessions/default/messages/text' },
            statusCode: { type: 'integer', example: 201 },
            ipAddress: { type: 'string', nullable: true },
            userAgent: { type: 'string', nullable: true },
            requestId: { type: 'string', nullable: true },
            metadata: { type: 'object' }
          }
        },
        ApiClientCreateRequest: {
          type: 'object',
          required: ['name', 'allowedSessions', 'scopes'],
          properties: {
            name: { type: 'string', example: 'Client Toko A' },
            description: { type: 'string', example: 'Integrasi CRM Toko A' },
            allowedSessions: { type: 'array', items: { type: 'string' }, example: ['sales'] },
            scopes: { type: 'array', items: { type: 'string' }, example: ['sessions:read', 'messages:send', 'media:send'] },
            rateLimitPerMinute: { type: 'integer', example: 60 },
            expiresAt: { type: 'string', format: 'date-time', nullable: true }
          }
        }
      },
      parameters: {
        SessionId: {
          name: 'sessionId',
          in: 'path',
          required: true,
          schema: { type: 'string', example: 'default' }
        },
        MessageId: {
          name: 'messageId',
          in: 'path',
          required: true,
          schema: { type: 'string', example: 'serialized-message-id' }
        },
        ContactId: {
          name: 'contactId',
          in: 'path',
          required: true,
          schema: { type: 'string', example: '6281234567890' }
        },
        ChatId: {
          name: 'chatId',
          in: 'path',
          required: true,
          schema: { type: 'string', example: '6281234567890' }
        },
        GroupId: {
          name: 'groupId',
          in: 'path',
          required: true,
          schema: { type: 'string', example: '120363000000000000@g.us' }
        },
        ChannelId: {
          name: 'channelId',
          in: 'path',
          required: true,
          schema: { type: 'string', example: '120363000000000000@newsletter' }
        },
        UserId: {
          name: 'userId',
          in: 'path',
          required: true,
          schema: { type: 'string', example: '6281234567890' }
        }
      }
    },
    security: [
      { ApiKeyAuth: [] }
    ],
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check API server',
          security: [],
          responses: {
            200: { description: 'API server sehat', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } }
          }
        }
      },
      '/health/ready': {
        get: {
          tags: ['Health'],
          summary: 'Advanced readiness check with session and stored auth summary',
          security: [],
          responses: { 200: { description: 'Readiness information' } }
        }
      },
      '/sessions': {
        get: {
          tags: ['Sessions'],
          summary: 'List WhatsApp sessions',
          responses: { 200: { description: 'Daftar session' } }
        }
      },
      '/sessions/restore': {
        post: {
          tags: ['Sessions'],
          summary: 'Restore all LocalAuth sessions found in auth storage',
          responses: { 202: { description: 'Restore process started/completed' } }
        }
      },
      '/sessions/terminate-all': {
        post: {
          tags: ['Sessions'],
          summary: 'Destroy all active WhatsApp sessions',
          responses: { 200: { description: 'All runtime sessions destroyed' } }
        }
      },
      '/sessions/{sessionId}/start': {
        post: {
          tags: ['Sessions'],
          summary: 'Start WhatsApp session dan generate QR jika belum login',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    restartIfExists: { type: 'boolean', example: false }
                  }
                }
              }
            }
          },
          responses: { 202: { description: 'Session sedang initializing' } }
        }
      },
      '/sessions/{sessionId}/status': {
        get: {
          tags: ['Sessions'],
          summary: 'Get session lifecycle status',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          responses: { 200: { description: 'Status session', content: { 'application/json': { schema: { $ref: '#/components/schemas/SessionStatus' } } } } }
        }
      },
      '/sessions/{sessionId}/health': {
        get: {
          tags: ['Sessions'],
          summary: 'Get session health including browser connection state',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          responses: { 200: { description: 'Session health' } }
        }
      },
      '/sessions/{sessionId}/screenshot': {
        get: {
          tags: ['Sessions'],
          summary: 'Get Puppeteer page screenshot as base64 PNG',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          responses: { 200: { description: 'Screenshot base64 data' } }
        }
      },
      '/sessions/{sessionId}/qr': {
        get: {
          tags: ['Sessions'],
          summary: 'Get QR raw string dan QR data URL',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          responses: { 200: { description: 'QR session' } }
        }
      },
      '/sessions/{sessionId}/logout': {
        post: {
          tags: ['Sessions'],
          summary: 'Logout WhatsApp session',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          responses: { 200: { description: 'Session logout' } }
        }
      },
      '/sessions/{sessionId}/restart': {
        post: {
          tags: ['Sessions'],
          summary: 'Restart WhatsApp session',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          responses: { 202: { description: 'Session restart diproses' } }
        }
      },
      '/sessions/{sessionId}/recover': {
        post: {
          tags: ['Sessions'],
          summary: 'Recover a session by destroying runtime and starting it again',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          responses: { 202: { description: 'Session recovery diproses' } }
        }
      },
      '/sessions/{sessionId}': {
        delete: {
          tags: ['Sessions'],
          summary: 'Destroy WhatsApp session runtime',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          responses: { 200: { description: 'Session destroyed' } }
        }
      },
      '/sessions/{sessionId}/messages/text': {
        post: {
          tags: ['Messages'],
          summary: 'Send text message',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SendTextRequest' } } } },
          responses: { 201: { description: 'Message sent' } }
        }
      },
      '/sessions/{sessionId}/messages/reply': {
        post: {
          tags: ['Messages'],
          summary: 'Reply message dari cache runtime',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['messageId', 'message'],
                  properties: {
                    messageId: { type: 'string' },
                    message: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: { 201: { description: 'Reply sent' } }
        }
      },
      '/sessions/{sessionId}/messages/react': {
        post: {
          tags: ['Messages'],
          summary: 'React to message dari cache runtime',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['messageId', 'reaction'],
                  properties: {
                    messageId: { type: 'string' },
                    reaction: { type: 'string', example: '👍' }
                  }
                }
              }
            }
          },
          responses: { 200: { description: 'Reaction updated' } }
        }
      },
      '/sessions/{sessionId}/messages/{messageId}/forward': {
        post: {
          tags: ['Messages'],
          summary: 'Forward message from runtime cache to another chat',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/MessageId' }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['to'], properties: { to: { type: 'string', example: '6281234567890' } } } } } },
          responses: { 201: { description: 'Message forwarded' } }
        }
      },
      '/sessions/{sessionId}/messages/{messageId}': {
        patch: {
          tags: ['Messages'],
          summary: 'Edit message from runtime cache',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/MessageId' }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['message'], properties: { message: { type: 'string' } } } } } },
          responses: { 200: { description: 'Message edited' } }
        },
        delete: {
          tags: ['Messages'],
          summary: 'Delete message from runtime cache',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/MessageId' }],
          requestBody: { required: false, content: { 'application/json': { schema: { type: 'object', properties: { everyone: { type: 'boolean', example: false } } } } } },
          responses: { 200: { description: 'Message deleted' } }
        }
      },
      '/sessions/{sessionId}/messages/{messageId}/star': {
        post: {
          tags: ['Messages'],
          summary: 'Star message from runtime cache',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/MessageId' }],
          responses: { 200: { description: 'Message starred' } }
        },
        delete: {
          tags: ['Messages'],
          summary: 'Unstar message from runtime cache',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/MessageId' }],
          responses: { 200: { description: 'Message unstarred' } }
        }
      },
      '/sessions/{sessionId}/messages/{messageId}/quoted': {
        get: {
          tags: ['Messages'],
          summary: 'Get quoted message from runtime cache',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/MessageId' }],
          responses: { 200: { description: 'Quoted message' } }
        }
      },
      '/sessions/{sessionId}/messages/chats/{chatId}/messages/fetch': {
        post: { tags: ['Messages'], summary: 'Fetch recent messages from chat', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChatId' }], requestBody: { required: false, content: { 'application/json': { schema: { type: 'object', properties: { limit: { type: 'integer', example: 25 }, fromMe: { type: 'boolean' } } } } } }, responses: { 200: { description: 'Fetched messages' } } }
      },
      '/sessions/{sessionId}/messages/chats/{chatId}/messages/search': {
        post: { tags: ['Messages'], summary: 'Search messages in a chat', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChatId' }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, limit: { type: 'integer', example: 25 }, page: { type: 'integer', example: 0 } } } } } }, responses: { 200: { description: 'Search result messages' } } }
      },
      '/sessions/{sessionId}/messages/chats/{chatId}/seen': {
        post: { tags: ['Messages'], summary: 'Send seen/read receipt to chat', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChatId' }], responses: { 200: { description: 'Seen sent' } } }
      },
      '/sessions/{sessionId}/messages/chats/{chatId}/mark-unread': {
        post: { tags: ['Messages'], summary: 'Mark chat as unread', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChatId' }], responses: { 200: { description: 'Chat marked unread' } } }
      },
      '/sessions/{sessionId}/messages/chats/{chatId}/presence/typing': {
        post: { tags: ['Messages'], summary: 'Send typing presence to chat', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChatId' }], requestBody: { required: false, content: { 'application/json': { schema: { type: 'object', properties: { durationMs: { type: 'integer', example: 3000 } } } } } }, responses: { 200: { description: 'Typing presence sent' } } }
      },
      '/sessions/{sessionId}/messages/chats/{chatId}/presence/recording': {
        post: { tags: ['Messages'], summary: 'Send recording presence to chat', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChatId' }], requestBody: { required: false, content: { 'application/json': { schema: { type: 'object', properties: { durationMs: { type: 'integer', example: 3000 } } } } } }, responses: { 200: { description: 'Recording presence sent' } } }
      },
      '/sessions/{sessionId}/messages/chats/{chatId}/presence/clear': {
        post: { tags: ['Messages'], summary: 'Clear chat presence state', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChatId' }], responses: { 200: { description: 'Presence cleared' } } }
      },
      '/sessions/{sessionId}/messages/presence/available': {
        post: { tags: ['Messages'], summary: 'Set session presence available', parameters: [{ $ref: '#/components/parameters/SessionId' }], responses: { 200: { description: 'Presence available' } } }
      },
      '/sessions/{sessionId}/messages/presence/unavailable': {
        post: { tags: ['Messages'], summary: 'Set session presence unavailable', parameters: [{ $ref: '#/components/parameters/SessionId' }], responses: { 200: { description: 'Presence unavailable' } } }
      },
      '/sessions/{sessionId}/messages/buttons': {
        post: { tags: ['Unsupported'], summary: 'Buttons deprecated', parameters: [{ $ref: '#/components/parameters/SessionId' }], responses: { 410: { description: 'Feature deprecated' } } }
      },
      '/sessions/{sessionId}/messages/lists': {
        post: { tags: ['Unsupported'], summary: 'Lists deprecated', parameters: [{ $ref: '#/components/parameters/SessionId' }], responses: { 410: { description: 'Feature deprecated' } } }
      },
      '/sessions/{sessionId}/media/base64': {
        post: {
          tags: ['Media'],
          summary: 'Send media from base64',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/MediaBase64Request' } } } },
          responses: { 201: { description: 'Media sent' } }
        }
      },
      '/sessions/{sessionId}/media/url': {
        post: {
          tags: ['Media'],
          summary: 'Send media from URL',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/MediaUrlRequest' } } } },
          responses: { 201: { description: 'Media sent' } }
        }
      },
      '/sessions/{sessionId}/media/upload': {
        post: {
          tags: ['Media'],
          summary: 'Send media from multipart upload',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  required: ['to', 'file'],
                  properties: {
                    to: { type: 'string', example: '6281234567890' },
                    caption: { type: 'string' },
                    file: { type: 'string', format: 'binary' }
                  }
                }
              }
            }
          },
          responses: { 201: { description: 'Uploaded media sent' } }
        }
      },
      '/sessions/{sessionId}/media/sticker/base64': {
        post: { tags: ['Media'], summary: 'Send sticker from base64 media', parameters: [{ $ref: '#/components/parameters/SessionId' }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/MediaBase64Request' } } } }, responses: { 201: { description: 'Sticker sent' } } }
      },
      '/sessions/{sessionId}/media/sticker/url': {
        post: { tags: ['Media'], summary: 'Send sticker from media URL', parameters: [{ $ref: '#/components/parameters/SessionId' }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/MediaUrlRequest' } } } }, responses: { 201: { description: 'Sticker sent' } } }
      },
      '/sessions/{sessionId}/media/{messageId}/download': {
        get: {
          tags: ['Media'],
          summary: 'Download media dari message cache sebagai base64 JSON',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/MessageId' }],
          responses: { 200: { description: 'Media base64 data' } }
        }
      },
      '/sessions/{sessionId}/media/{messageId}/download.bin': {
        get: {
          tags: ['Media'],
          summary: 'Download media dari message cache sebagai binary stream',
          parameters: [
            { $ref: '#/components/parameters/SessionId' },
            { $ref: '#/components/parameters/MessageId' },
            { name: 'filename', in: 'query', required: false, schema: { type: 'string' } }
          ],
          responses: { 200: { description: 'Media binary stream' } }
        }
      },
      '/sessions/{sessionId}/mentions/users': {
        post: {
          tags: ['Mentions'],
          summary: 'Send message with user mentions',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['to', 'message', 'mentions'],
                  properties: {
                    to: { type: 'string', example: '120363000000000000@g.us' },
                    message: { type: 'string', example: 'Halo @6281234567890' },
                    mentions: { type: 'array', items: { type: 'string' }, example: ['6281234567890'] }
                  }
                }
              }
            }
          },
          responses: { 201: { description: 'Mention message sent' } }
        }
      },
      '/sessions/{sessionId}/mentions/groups': {
        post: {
          tags: ['Mentions'],
          summary: 'Send message with group mentions',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['to', 'message', 'groupMentions'],
                  properties: {
                    to: { type: 'string', example: '6281234567890' },
                    message: { type: 'string', example: 'Cek grup ini' },
                    groupMentions: {
                      type: 'array',
                      items: {
                        type: 'object',
                        required: ['id', 'subject'],
                        properties: {
                          id: { type: 'string', example: '120363000000000000@g.us' },
                          subject: { type: 'string', example: 'Nama Grup' }
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          responses: { 201: { description: 'Group mention sent' } }
        }
      },
      '/sessions/{sessionId}/contacts': {
        get: { tags: ['Contacts'], summary: 'List all contacts', parameters: [{ $ref: '#/components/parameters/SessionId' }], responses: { 200: { description: 'Contacts list' } } }
      },
      '/sessions/{sessionId}/contacts/check-registered': {
        post: { tags: ['Contacts'], summary: 'Check whether a number is registered on WhatsApp', parameters: [{ $ref: '#/components/parameters/SessionId' }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['number'], properties: { number: { type: 'string', example: '6281234567890' } } } } } }, responses: { 200: { description: 'Registration status' } } }
      },
      '/sessions/{sessionId}/contacts/number-id': {
        post: { tags: ['Contacts'], summary: 'Get WhatsApp number ID', parameters: [{ $ref: '#/components/parameters/SessionId' }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['number'], properties: { number: { type: 'string' } } } } } }, responses: { 200: { description: 'Number ID' } } }
      },
      '/sessions/{sessionId}/contacts/formatted-number': {
        post: { tags: ['Contacts'], summary: 'Get formatted number', parameters: [{ $ref: '#/components/parameters/SessionId' }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['number'], properties: { number: { type: 'string' } } } } } }, responses: { 200: { description: 'Formatted number' } } }
      },
      '/sessions/{sessionId}/contacts/country-code': {
        post: { tags: ['Contacts'], summary: 'Get country code from number', parameters: [{ $ref: '#/components/parameters/SessionId' }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['number'], properties: { number: { type: 'string' } } } } } }, responses: { 200: { description: 'Country code' } } }
      },
      '/sessions/{sessionId}/contacts/profile/display-name': {
        patch: { tags: ['Contacts'], summary: 'Update own profile display name', parameters: [{ $ref: '#/components/parameters/SessionId' }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['value'], properties: { value: { type: 'string' } } } } } }, responses: { 200: { description: 'Display name updated' } } }
      },
      '/sessions/{sessionId}/contacts/profile/status': {
        patch: { tags: ['Contacts'], summary: 'Update own profile status/about', parameters: [{ $ref: '#/components/parameters/SessionId' }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['value'], properties: { value: { type: 'string' } } } } } }, responses: { 200: { description: 'Status updated' } } }
      },
      '/sessions/{sessionId}/contacts/profile/picture': {
        put: { tags: ['Contacts'], summary: 'Update own profile picture', parameters: [{ $ref: '#/components/parameters/SessionId' }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['mimetype', 'data'], properties: { mimetype: { type: 'string' }, data: { type: 'string' }, filename: { type: 'string' } } } } } }, responses: { 200: { description: 'Profile picture updated' } } },
        delete: { tags: ['Contacts'], summary: 'Delete own profile picture', parameters: [{ $ref: '#/components/parameters/SessionId' }], responses: { 200: { description: 'Profile picture deleted' } } }
      },
      '/sessions/{sessionId}/contacts/card': {
        post: {
          tags: ['Contacts'],
          summary: 'Send contact card',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', required: ['to', 'contactId'], properties: { to: { type: 'string' }, contactId: { type: 'string' } } } } }
          },
          responses: { 201: { description: 'Contact card sent' } }
        }
      },
      '/sessions/{sessionId}/contacts/{contactId}': {
        get: { tags: ['Contacts'], summary: 'Get contact info', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ContactId' }], responses: { 200: { description: 'Contact info' } } }
      },
      '/sessions/{sessionId}/contacts/{contactId}/about': {
        get: { tags: ['Contacts'], summary: 'Get contact about/status text', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ContactId' }], responses: { 200: { description: 'Contact about' } } }
      },
      '/sessions/{sessionId}/contacts/{contactId}/common-groups': {
        get: { tags: ['Contacts'], summary: 'Get common groups with contact', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ContactId' }], responses: { 200: { description: 'Common groups' } } }
      },
      '/sessions/{sessionId}/contacts/{contactId}/profile-picture': {
        get: { tags: ['Contacts'], summary: 'Get contact profile picture URL', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ContactId' }], responses: { 200: { description: 'Profile picture URL' } } }
      },
      '/sessions/{sessionId}/contacts/{contactId}/block': {
        post: { tags: ['Contacts'], summary: 'Block contact', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ContactId' }], responses: { 200: { description: 'Contact blocked' } } }
      },
      '/sessions/{sessionId}/contacts/{contactId}/unblock': {
        post: { tags: ['Contacts'], summary: 'Unblock contact', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ContactId' }], responses: { 200: { description: 'Contact unblocked' } } }
      },
      '/sessions/{sessionId}/location': {
        post: {
          tags: ['Location'],
          summary: 'Send location',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['to', 'latitude', 'longitude'], properties: { to: { type: 'string' }, latitude: { type: 'number', example: -6.2 }, longitude: { type: 'number', example: 106.8 }, description: { type: 'string', example: 'Jakarta' } } } } } },
          responses: { 201: { description: 'Location sent' } }
        }
      },
      '/sessions/{sessionId}/chats': {
        get: { tags: ['Chats'], summary: 'List all chats', parameters: [{ $ref: '#/components/parameters/SessionId' }], responses: { 200: { description: 'Chats list' } } }
      },
      '/sessions/{sessionId}/chats/search': {
        post: { tags: ['Chats'], summary: 'Search chats by id/name', parameters: [{ $ref: '#/components/parameters/SessionId' }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, limit: { type: 'integer', example: 25 } } } } } }, responses: { 200: { description: 'Chat search results' } } }
      },
      '/sessions/{sessionId}/chats/{chatId}': {
        get: { tags: ['Chats'], summary: 'Get chat info', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChatId' }], responses: { 200: { description: 'Chat info' } } }
      },
      '/sessions/{sessionId}/chats/{chatId}/mute': {
        post: {
          tags: ['Chats'],
          summary: 'Mute chat',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChatId' }],
          requestBody: { required: false, content: { 'application/json': { schema: { type: 'object', properties: { until: { type: 'string', format: 'date-time' } } } } } },
          responses: { 200: { description: 'Chat muted' } }
        }
      },
      '/sessions/{sessionId}/chats/{chatId}/unmute': {
        post: { tags: ['Chats'], summary: 'Unmute chat', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChatId' }], responses: { 200: { description: 'Chat unmuted' } } }
      },
      '/sessions/{sessionId}/chats/{chatId}/archive': {
        post: { tags: ['Chats'], summary: 'Archive chat', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChatId' }], responses: { 200: { description: 'Chat archived' } } }
      },
      '/sessions/{sessionId}/chats/{chatId}/unarchive': {
        post: { tags: ['Chats'], summary: 'Unarchive chat', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChatId' }], responses: { 200: { description: 'Chat unarchived' } } }
      },
      '/sessions/{sessionId}/chats/{chatId}/pin': {
        post: { tags: ['Chats'], summary: 'Pin chat', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChatId' }], responses: { 200: { description: 'Chat pinned' } } }
      },
      '/sessions/{sessionId}/chats/{chatId}/unpin': {
        post: { tags: ['Chats'], summary: 'Unpin chat', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChatId' }], responses: { 200: { description: 'Chat unpinned' } } }
      },
      '/sessions/{sessionId}/chats/{chatId}/clear': {
        post: { tags: ['Chats'], summary: 'Clear chat messages', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChatId' }], responses: { 200: { description: 'Chat cleared' } } }
      },
      '/sessions/{sessionId}/groups': {
        post: { tags: ['Groups'], summary: 'Create group', parameters: [{ $ref: '#/components/parameters/SessionId' }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name', 'participants'], properties: { name: { type: 'string' }, participants: { type: 'array', items: { type: 'string' } } } } } } }, responses: { 201: { description: 'Group created' } } }
      },
      '/sessions/{sessionId}/groups/join': {
        post: {
          tags: ['Groups'],
          summary: 'Join group by invite code or URL',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['inviteCodeOrUrl'], properties: { inviteCodeOrUrl: { type: 'string', example: 'https://chat.whatsapp.com/xxxx' } } } } } },
          responses: { 200: { description: 'Joined group' } }
        }
      },
      '/sessions/{sessionId}/groups/invite-info': {
        post: { tags: ['Groups'], summary: 'Get group invite info by invite code or URL', parameters: [{ $ref: '#/components/parameters/SessionId' }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['inviteCodeOrUrl'], properties: { inviteCodeOrUrl: { type: 'string' } } } } } }, responses: { 200: { description: 'Invite info' } } }
      },
      '/sessions/{sessionId}/groups/{groupId}': {
        get: { tags: ['Groups'], summary: 'Get group info', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/GroupId' }], responses: { 200: { description: 'Group info' } } }
      },
      '/sessions/{sessionId}/groups/{groupId}/invite': {
        get: { tags: ['Groups'], summary: 'Get group invite code', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/GroupId' }], responses: { 200: { description: 'Group invite' } } },
        delete: { tags: ['Groups'], summary: 'Revoke group invite code', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/GroupId' }], responses: { 200: { description: 'Group invite revoked' } } }
      },
      '/sessions/{sessionId}/groups/{groupId}/leave': {
        post: { tags: ['Groups'], summary: 'Leave group', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/GroupId' }], responses: { 200: { description: 'Left group' } } }
      },
      '/sessions/{sessionId}/groups/{groupId}/picture': {
        put: { tags: ['Groups'], summary: 'Set group picture', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/GroupId' }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['mimetype', 'data'], properties: { mimetype: { type: 'string' }, data: { type: 'string' }, filename: { type: 'string' } } } } } }, responses: { 200: { description: 'Group picture updated' } } },
        delete: { tags: ['Groups'], summary: 'Delete group picture', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/GroupId' }], responses: { 200: { description: 'Group picture deleted' } } }
      },
      '/sessions/{sessionId}/groups/{groupId}/info': {
        patch: {
          tags: ['Groups'],
          summary: 'Update group subject/description',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/GroupId' }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { subject: { type: 'string' }, description: { type: 'string' } } } } } },
          responses: { 200: { description: 'Group info updated' } }
        }
      },
      '/sessions/{sessionId}/groups/{groupId}/settings': {
        patch: {
          tags: ['Groups'],
          summary: 'Update group settings',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/GroupId' }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { messagesAdminsOnly: { type: 'boolean' }, infoAdminsOnly: { type: 'boolean' } } } } } },
          responses: { 200: { description: 'Group settings updated' } }
        }
      },
      '/sessions/{sessionId}/groups/{groupId}/participants': {
        post: {
          tags: ['Groups'],
          summary: 'Add group participants',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/GroupId' }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['participants'], properties: { participants: { type: 'array', items: { type: 'string' }, example: ['6281234567890'] } } } } } },
          responses: { 200: { description: 'Participants added' } }
        }
      },
      '/sessions/{sessionId}/groups/{groupId}/participants/{participantId}': {
        delete: {
          tags: ['Groups'],
          summary: 'Remove group participant',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/GroupId' }, { name: 'participantId', in: 'path', required: true, schema: { type: 'string', example: '6281234567890' } }],
          responses: { 200: { description: 'Participant removed' } }
        }
      },
      '/sessions/{sessionId}/groups/{groupId}/participants/{participantId}/promote': {
        post: { tags: ['Groups'], summary: 'Promote participant to admin', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/GroupId' }, { name: 'participantId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Participant promoted' } } }
      },
      '/sessions/{sessionId}/groups/{groupId}/participants/{participantId}/demote': {
        post: { tags: ['Groups'], summary: 'Demote participant admin', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/GroupId' }, { name: 'participantId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Participant demoted' } } }
      },
      '/sessions/{sessionId}/groups/{groupId}/membership-requests': {
        get: {
          tags: ['Groups'],
          summary: 'List group membership requests',
          description: 'Feature-detected wrapper untuk membaca request join group jika didukung whatsapp-web.js/runtime.',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/GroupId' }],
          responses: { 200: { description: 'Membership request list' }, 501: { description: 'Feature not available' } }
        }
      },
      '/sessions/{sessionId}/groups/{groupId}/membership-requests/approve': {
        post: {
          tags: ['Groups'],
          summary: 'Approve group membership requests',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/GroupId' }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['requesterIds'], properties: { requesterIds: { type: 'array', items: { type: 'string' }, example: ['6281234567890@c.us'] } } } } } },
          responses: { 200: { description: 'Membership requests approved' }, 501: { description: 'Feature not available' } }
        }
      },
      '/sessions/{sessionId}/groups/{groupId}/membership-requests/reject': {
        post: {
          tags: ['Groups'],
          summary: 'Reject group membership requests',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/GroupId' }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['requesterIds'], properties: { requesterIds: { type: 'array', items: { type: 'string' }, example: ['6281234567890@c.us'] } } } } } },
          responses: { 200: { description: 'Membership requests rejected' }, 501: { description: 'Feature not available' } }
        }
      },
      '/sessions/{sessionId}/groups/{groupId}/mention-everyone': {
        post: {
          tags: ['Groups'],
          summary: 'Mention every group participant',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/GroupId' }],
          requestBody: { required: false, content: { 'application/json': { schema: { type: 'object', properties: { messagePrefix: { type: 'string', example: 'Pengumuman:' }, messageSuffix: { type: 'string', example: 'Mohon dibaca.' } } } } } },
          responses: { 201: { description: 'Mention everyone message sent' } }
        }
      },
      '/sessions/{sessionId}/polls': {
        post: {
          tags: ['Polls'],
          summary: 'Create poll',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['to', 'name', 'options'], properties: { to: { type: 'string' }, name: { type: 'string' }, options: { type: 'array', items: { type: 'string' } }, allowMultipleAnswers: { type: 'boolean' } } } } } },
          responses: { 201: { description: 'Poll created' } }
        }
      },
      '/sessions/{sessionId}/polls/{pollMessageId}/vote': {
        post: {
          tags: ['Polls'],
          summary: 'Vote poll dari message cache',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { name: 'pollMessageId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['selectedOptions'], properties: { selectedOptions: { type: 'array', items: { type: 'string' } } } } } } },
          responses: { 200: { description: 'Poll voted' } }
        }
      },
      '/sessions/{sessionId}/channels': {
        get: {
          tags: ['Channels'],
          summary: 'List detected channel chats',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          responses: { 200: { description: 'Channels list' } }
        }
      },
      '/sessions/{sessionId}/channels/search': {
        post: {
          tags: ['Channels'],
          summary: 'Search detected channels by id/name/description',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['query'], properties: { query: { type: 'string' }, limit: { type: 'integer', example: 25 } } } } } },
          responses: { 200: { description: 'Matching channels' } }
        }
      },
      '/sessions/{sessionId}/channels/{channelId}': {
        get: {
          tags: ['Channels'],
          summary: 'Get channel metadata',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChannelId' }],
          responses: { 200: { description: 'Channel metadata' }, 400: { description: 'Feature not available or target is not a channel' } }
        },
        delete: {
          tags: ['Channels'],
          summary: 'Delete channel if account has permission',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChannelId' }],
          responses: { 200: { description: 'Channel deleted' }, 400: { description: 'Feature not available' } }
        }
      },
      '/sessions/{sessionId}/channels/{channelId}/messages': {
        post: {
          tags: ['Channels'],
          summary: 'Send channel message from text/base64/url',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChannelId' }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { message: { type: 'string' }, mimetype: { type: 'string' }, data: { type: 'string' }, url: { type: 'string' }, filename: { type: 'string' }, caption: { type: 'string' }, options: { type: 'object' } } } } } },
          responses: { 201: { description: 'Channel message sent' }, 400: { description: 'Feature not available' } }
        },
        get: {
          tags: ['Channels'],
          summary: 'Fetch channel messages',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChannelId' }, { name: 'limit', in: 'query', required: false, schema: { type: 'integer', example: 25 } }],
          responses: { 200: { description: 'Channel messages' }, 400: { description: 'Feature not available' } }
        }
      },
      '/sessions/{sessionId}/channels/{channelId}/seen': {
        post: { tags: ['Channels'], summary: 'Send seen/read state to channel', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChannelId' }], responses: { 200: { description: 'Seen sent' } } }
      },
      '/sessions/{sessionId}/channels/{channelId}/mute': {
        post: { tags: ['Channels'], summary: 'Mute channel', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChannelId' }], responses: { 200: { description: 'Channel muted' } } }
      },
      '/sessions/{sessionId}/channels/{channelId}/unmute': {
        post: { tags: ['Channels'], summary: 'Unmute channel', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChannelId' }], responses: { 200: { description: 'Channel unmuted' } } }
      },
      '/sessions/{sessionId}/channels/{channelId}/info': {
        patch: {
          tags: ['Channels'],
          summary: 'Update channel subject/description',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChannelId' }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { subject: { type: 'string' }, description: { type: 'string' } } } } } },
          responses: { 200: { description: 'Channel info updated' } }
        }
      },
      '/sessions/{sessionId}/channels/{channelId}/picture': {
        put: {
          tags: ['Channels'],
          summary: 'Update channel profile picture from base64 media',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChannelId' }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['mimetype', 'data'], properties: { mimetype: { type: 'string' }, data: { type: 'string' }, filename: { type: 'string' } } } } } },
          responses: { 200: { description: 'Channel picture updated' } }
        }
      },
      '/sessions/{sessionId}/channels/{channelId}/reaction-setting': {
        patch: {
          tags: ['Channels'],
          summary: 'Update channel reaction setting',
          parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChannelId' }],
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['reactionCode'], properties: { reactionCode: { type: 'integer', example: 1 } } } } } },
          responses: { 200: { description: 'Reaction setting updated' } }
        }
      },
      '/sessions/{sessionId}/channels/{channelId}/admin-invites/accept': {
        post: { tags: ['Channels'], summary: 'Accept channel admin invite', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChannelId' }], responses: { 200: { description: 'Admin invite accepted' } } }
      },
      '/sessions/{sessionId}/channels/{channelId}/admin-invites/{userId}': {
        post: { tags: ['Channels'], summary: 'Send channel admin invite to user', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChannelId' }, { $ref: '#/components/parameters/UserId' }], responses: { 201: { description: 'Admin invite sent' } } },
        delete: { tags: ['Channels'], summary: 'Revoke channel admin invite', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChannelId' }, { $ref: '#/components/parameters/UserId' }], responses: { 200: { description: 'Admin invite revoked' } } }
      },
      '/sessions/{sessionId}/channels/{channelId}/ownership/transfer/{userId}': {
        post: { tags: ['Channels'], summary: 'Transfer channel ownership', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChannelId' }, { $ref: '#/components/parameters/UserId' }], responses: { 200: { description: 'Ownership transferred' } } }
      },
      '/sessions/{sessionId}/channels/{channelId}/admins/{userId}/demote': {
        post: { tags: ['Channels'], summary: 'Demote channel admin', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChannelId' }, { $ref: '#/components/parameters/UserId' }], responses: { 200: { description: 'Channel admin demoted' } } }
      },
      '/sessions/{sessionId}/channels/{channelId}/subscribers': {
        get: { tags: ['Channels'], summary: 'Get channel subscribers', parameters: [{ $ref: '#/components/parameters/SessionId' }, { $ref: '#/components/parameters/ChannelId' }, { name: 'limit', in: 'query', required: false, schema: { type: 'integer', example: 100 } }], responses: { 200: { description: 'Channel subscribers' } } }
      },
      '/sessions/{sessionId}/communities/{anyPath}': {
        parameters: [{ $ref: '#/components/parameters/SessionId' }, { name: 'anyPath', in: 'path', required: true, schema: { type: 'string' } }],
        get: { tags: ['Unsupported'], summary: 'Communities feature not ready', responses: { 501: { description: 'Feature not ready' } } },
        post: { tags: ['Unsupported'], summary: 'Communities feature not ready', responses: { 501: { description: 'Feature not ready' } } }
      },
      '/admin/api-clients': {
        post: {
          tags: ['Admin'],
          summary: 'Generate API client dan API key baru',
          security: [{ AdminKeyAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiClientCreateRequest' } } }
          },
          responses: {
            201: { description: 'API client created. Raw apiKey hanya ditampilkan sekali.' },
            401: { description: 'Invalid admin API key' }
          }
        },
        get: {
          tags: ['Admin'],
          summary: 'List API clients',
          security: [{ AdminKeyAuth: [] }],
          responses: { 200: { description: 'API client list' } }
        }
      },
      '/admin/api-clients/{clientId}': {
        get: {
          tags: ['Admin'],
          summary: 'Get API client detail',
          security: [{ AdminKeyAuth: [] }],
          parameters: [{ name: 'clientId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'API client detail' } }
        },
        patch: {
          tags: ['Admin'],
          summary: 'Update API client permissions, sessions, status, rate limit, atau expiry',
          security: [{ AdminKeyAuth: [] }],
          parameters: [{ name: 'clientId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiClientCreateRequest' } } }
          },
          responses: { 200: { description: 'API client updated' } }
        }
      },
      '/admin/api-clients/{clientId}/revoke': {
        post: {
          tags: ['Admin'],
          summary: 'Revoke API client dan semua key aktifnya',
          security: [{ AdminKeyAuth: [] }],
          parameters: [{ name: 'clientId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'API client revoked' } }
        }
      },
      '/admin/api-clients/{clientId}/keys/rotate': {
        post: {
          tags: ['Admin'],
          summary: 'Rotate API key. Key lama direvoke dan raw key baru ditampilkan sekali.',
          security: [{ AdminKeyAuth: [] }],
          parameters: [{ name: 'clientId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'API key rotated' } }
        }
      },
      '/admin/audit-logs': {
        get: {
          tags: ['Admin'],
          summary: 'List structured audit logs',
          description: 'Membaca audit log JSONL dari AUDIT_LOG_FILE. Field sensitif sudah direduksi.',
          security: [{ AdminKeyAuth: [] }],
          parameters: [
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 1000, example: 100 } },
            { name: 'actorId', in: 'query', required: false, schema: { type: 'string', example: 'cli_8f2a7b1c9d0e1234' } },
            { name: 'sessionId', in: 'query', required: false, schema: { type: 'string', example: 'default' } },
            { name: 'action', in: 'query', required: false, schema: { type: 'string', example: 'messages:send' } },
            { name: 'statusCode', in: 'query', required: false, schema: { type: 'integer', example: 201 } }
          ],
          responses: {
            200: { description: 'Audit logs', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/AuditLog' } } } } },
            401: { description: 'Invalid admin API key' }
          }
        }
      },
      '/sessions/{sessionId}/events': {
        get: {
          tags: ['Sessions'],
          summary: 'Subscribe realtime events via Server-Sent Events',
          parameters: [{ $ref: '#/components/parameters/sessionId' }],
          responses: {
            200: {
              description: 'SSE stream. Requires events:read scope and allowed session access.',
              content: { 'text/event-stream': { schema: { type: 'string' } } }
            }
          }
        }
      },
      '/metrics': {
        get: {
          tags: ['Metrics'],
          summary: 'Get runtime metrics',
          description: 'Mengembalikan ringkasan uptime, sessions, in-memory send queue, dan process memory. Requires metrics:read scope.',
          security: [{ ApiKeyAuth: [] }],
          responses: { 200: { description: 'Runtime metrics' } }
        }
      },
      '/sessions/{sessionId}/queue': {
        get: {
          tags: ['Queue'],
          summary: 'Get session send queue state',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          responses: { 200: { description: 'Queue state for session' } }
        }
      },
      '/sessions/{sessionId}/queue/pause': {
        post: {
          tags: ['Queue'],
          summary: 'Pause session send queue',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          responses: { 200: { description: 'Queue paused' } }
        }
      },
      '/sessions/{sessionId}/queue/resume': {
        post: {
          tags: ['Queue'],
          summary: 'Resume session send queue',
          parameters: [{ $ref: '#/components/parameters/SessionId' }],
          responses: { 200: { description: 'Queue resumed' } }
        }
      },
      '/webhooks': {
        post: {
          tags: ['Webhooks'],
          summary: 'Register webhook target',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['url', 'events'],
                  properties: {
                    url: { type: 'string', example: 'https://example.com/whatsapp/webhook' },
                    events: { type: 'array', items: { type: 'string' }, example: ['message.received', 'session.ready'] },
                    secret: { type: 'string', example: 'webhook-secret' }
                  }
                }
              }
            }
          },
          responses: { 201: { description: 'Webhook registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/Webhook' } } } } }
        },
        get: {
          tags: ['Webhooks'],
          summary: 'List registered webhooks',
          responses: { 200: { description: 'Webhook list' } }
        }
      },
      '/webhooks/{webhookId}': {
        get: {
          tags: ['Webhooks'],
          summary: 'Get webhook detail',
          parameters: [{ name: 'webhookId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Webhook detail', content: { 'application/json': { schema: { $ref: '#/components/schemas/Webhook' } } } } }
        },
        patch: {
          tags: ['Webhooks'],
          summary: 'Update webhook target, events, secret, or active flag',
          parameters: [{ name: 'webhookId', in: 'path', required: true, schema: { type: 'string' } }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    url: { type: 'string', example: 'https://example.com/new-webhook' },
                    events: { type: 'array', items: { type: 'string' }, example: ['*'] },
                    secret: { type: 'string', example: 'new-secret' },
                    active: { type: 'boolean', example: true }
                  }
                }
              }
            }
          },
          responses: { 200: { description: 'Webhook updated' } }
        },
        delete: {
          tags: ['Webhooks'],
          summary: 'Delete webhook',
          parameters: [{ name: 'webhookId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Webhook deleted' } }
        }
      },
      '/webhooks/{webhookId}/deliveries': {
        get: {
          tags: ['Webhooks'],
          summary: 'List recent webhook delivery logs',
          parameters: [{ name: 'webhookId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 200: { description: 'Webhook deliveries', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/WebhookDelivery' } } } } } }
        }
      },
      '/webhooks/deliveries/{deliveryId}/retry': {
        post: {
          tags: ['Webhooks'],
          summary: 'Retry failed webhook delivery',
          parameters: [{ name: 'deliveryId', in: 'path', required: true, schema: { type: 'string' } }],
          responses: { 202: { description: 'Webhook delivery retry queued/executed' } }
        }
      }
    }
  },
  apis: []
});

module.exports = swaggerSpec;
