import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { gameRoutes } from '../src/routes/gameRoutes';
import { arenaRoutes } from '../src/routes/arenaRoutes';
import { botRoutes } from '../src/routes/botRoutes';
import { statsRoutes } from '../src/routes/statsRoutes';
import { agentRoutes } from '../src/routes/agentRoutes';
import { errorHandler } from '../src/middleware/errorHandler';
import logger from '../src/utils/logger';

const app = express();

// CORS configuration
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(o => o.trim());
app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (like mobile apps or curl requests)
            if (!origin) return callback(null, true);

            if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
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

// Error handling
app.use(errorHandler);

// Export for Vercel serverless
export default app;
