/**
 * Orion IDE â€” Drive Service
 *
 * All Google Drive operations â€” files, folders, projects.
 * Auto-creates OrionIDE/ folder on first use.
 * Write-buffer: batches writes, flushes to Drive every 60 seconds.
 *
 * Endpoints:
 *   GET    /drive/projects            â€” List user projects
 *   GET    /drive/files               â€” List files in a folder
 *   POST   /drive/files               â€” Create file/folder
 *   GET    /drive/files/:id           â€” Read file content
 *   PUT    /drive/files/:id           â€” Update (add to write buffer)
 *   PUT    /drive/files/:id/flush     â€” Immediate write (Ctrl+S)
 *   DELETE /drive/files/:id           â€” Delete file/folder
 *   PATCH  /drive/files/:id/rename    â€” Rename
 *   POST   /drive/ensure-root        â€” Ensure OrionIDE/ exists
 *   POST   /drive/ensure-path        â€” Ensure nested path exists
 */

require('dotenv').config();
require('./utils/validateEnv')();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { createLogger } = require('../../../shared/utils/logger');
const driveRoutes = require('./routes/drive');
const { startAutoFlush, stopAutoFlush } = require('./services/writeBuffer');

const logger = createLogger('drive-service');
const app = express();
const PORT = process.env.PORT || 3002;

// â”€â”€ Middleware â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use(helmet());
app.use(cors(require('../../../shared/utils/corsConfig')));
app.options('*', cors(require('../../../shared/utils/corsConfig')));
app.use(express.json({ limit: '10mb' })); // 10MB for large file content

// Forward or generate request ID
app.use((req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.requestId);
  next();
});

// â”€â”€ Health Check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'drive-service',
    timestamp: new Date().toISOString(),
  });
});

// â”€â”€ Drive Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use('/drive', driveRoutes);

// â”€â”€ 404 Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`,
      details: null,
    },
  });
});

// â”€â”€ Global Error Handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app.use((err, req, res, _next) => {
  logger.error('Unhandled error', {
    requestId: req.requestId,
    error: err.message,
    stack: err.stack,
  });
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? err.message : null,
    },
  });
});

// â”€â”€ Start Server â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    logger.info('Drive Service started', {
      port: PORT,
      env: process.env.NODE_ENV || 'development',
    });

    // Start the 60-second write buffer auto-flush
    startAutoFlush();
  });

  // Graceful shutdown â€” flush all buffers before exit
  const shutdown = async () => {
    logger.info('Shutting down â€” flushing write buffers...');
    stopAutoFlush();
    const { flushAllBuffers } = require('./services/writeBuffer');
    await flushAllBuffers();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

module.exports = app;
