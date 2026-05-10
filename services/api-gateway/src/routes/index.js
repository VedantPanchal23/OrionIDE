/**
 * Orion IDE — API Gateway Route Index
 *
 * Mounts all service proxy routes on the Express app.
 * Each route file handles its own path prefix and proxying.
 */

const { mountAuthRoutes } = require('./auth');
const { mountDriveRoutes } = require('./drive');
const { mountEditorRoutes } = require('./editor');
const { mountExecuteRoutes } = require('./execute');
const { mountAgentRoutes } = require('./agents');
const { mountNotificationRoutes } = require('./notifications');

/**
 * Mount all downstream service routes on the app.
 * Order matters: auth routes first (some bypass auth middleware).
 * @param {import('express').Application} app
 */
const mountAllRoutes = (app) => {
  mountAuthRoutes(app);           // /api/auth/*           → auth-service:3001
  mountDriveRoutes(app);          // /api/drive/*          → drive-service:3002
  mountEditorRoutes(app);         // /api/editor/*         → editor-service:3003
  mountExecuteRoutes(app);        // /api/execute/*        → execution-service:3004
  mountAgentRoutes(app);          // /api/agents/*         → agent-service:3005
  mountNotificationRoutes(app);   // /api/notifications/*  → notification-service:3006
};

module.exports = { mountAllRoutes };
