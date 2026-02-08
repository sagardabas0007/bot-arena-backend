import { PrismaClient } from '@prisma/client';
import logger from '../utils/logger';

declare global {
  var __prisma: PrismaClient | undefined;
}

const createPrismaClient = (): PrismaClient => {
  const client = new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  });

  client.$on('query' as never, (e: any) => {
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Query: ${e.query}`);
      logger.debug(`Duration: ${e.duration}ms`);
    }
  });

  return client;
};

// Singleton pattern: reuse prisma client in development (prevents too many connections during hot reloading)
export const prisma: PrismaClient =
  global.__prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export default prisma;
