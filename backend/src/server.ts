import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { gameRoutes } from './routes/gameRoutes';
import { arenaRoutes } from './routes/arenaRoutes';
import { botRoutes } from './routes/botRoutes';
import { statsRoutes } from './routes/statsRoutes';
import { agentRoutes } from './routes/agentRoutes';
import { setupSocketHandler } from './websocket/socketHandler';
import { errorHandler } from './middleware/errorHandler';
import logger from './utils/logger';
import { prisma } from './config/database';

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-wallet-address', 'x-agent-key'],
    credentials: true,
  })
);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
app.use('/api/game', gameRoutes);
app.use('/api/arena', arenaRoutes);
app.use('/api/bot', botRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/agent', agentRoutes);

// Error handling middleware (must be after routes)
app.use(errorHandler);

// Create HTTP server
const server = http.createServer(app);

// Attach Socket.io
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Setup WebSocket handler
setupSocketHandler(io);

// Make io accessible to routes via app.locals
app.set('io', io);

// Start server
server.listen(PORT, () => {
  logger.info(`Bot Arena backend server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`WebSocket server attached`);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  server.close(() => {
    logger.info('HTTP server closed');
  });

  io.close(() => {
    logger.info('WebSocket server closed');
  });

  await prisma.$disconnect();
  logger.info('Database connection closed');

  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason: Error) => {
  logger.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

export { app, server, io };
