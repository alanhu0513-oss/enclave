const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Enclave API',
      version: '1.0.0',
      description: 'AI-powered identity protection platform API. Detect deepfakes, monitor the dark web, and protect your digital identity.',
      contact: { name: 'Enclave Support', email: 'support@enclave.app' },
      license: { name: 'MIT', url: 'https://opensource.org/licenses/MIT' },
    },
    servers: [
      { url: 'https://enclave-production-d818.up.railway.app', description: 'Production' },
      { url: 'http://localhost:4000', description: 'Development' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            email: { type: 'string', format: 'email' },
            fullName: { type: 'string' },
            plan: { type: 'string', enum: ['free', 'detection_only', 'pro', 'shield', 'business'] },
          },
        },
        Alert: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            source_url: { type: 'string', format: 'uri' },
            confidence: { type: 'number', minimum: 0, maximum: 100 },
            status: { type: 'string', enum: ['PENDING_REVIEW', 'CONFIRMED', 'FALSE_POSITIVE', 'RESOLVED_REMOVED'] },
            media_type: { type: 'string' },
            matched_on: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Takedown: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            alert_id: { type: 'string' },
            type: { type: 'string', enum: ['dmca', 'cease_desist', 'take_it_down_act'] },
            status: { type: 'string', enum: ['draft', 'sent', 'acknowledged', 'removed', 'escalated'] },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Notification: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            type: { type: 'string' },
            title: { type: 'string' },
            body: { type: 'string' },
            read: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Subscription: {
          type: 'object',
          properties: {
            tier: { type: 'string' },
            status: { type: 'string' },
            scanLimit: { type: 'integer' },
            scansUsed: { type: 'integer' },
            scansRemaining: { type: 'integer' },
          },
        },
        DetectionResult: {
          type: 'object',
          properties: {
            confidence: { type: 'number', minimum: 0, maximum: 100 },
            verdict: { type: 'string', enum: ['AUTHENTIC', 'MANIPULATION_DETECTED', 'SUSPICIOUS', 'UNKNOWN'] },
            details: { type: 'object' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication and registration' },
      { name: 'Alerts', description: 'Threat alerts and scanning' },
      { name: 'Detect', description: 'ML-powered deepfake detection' },
      { name: 'Takedowns', description: 'Content takedown management' },
      { name: 'Notifications', description: 'In-app and push notifications' },
      { name: 'Monitoring', description: 'Proactive identity monitoring' },
      { name: 'Billing', description: 'Subscription and payment management' },
      { name: 'Organizations', description: 'Team and enterprise features' },
      { name: 'Admin', description: 'Administrative endpoints (admin only)' },
    ],
  },
  apis: ['./src/routes/*.js'],
};

const specs = swaggerJsdoc(options);

module.exports = { swaggerUi, specs };
