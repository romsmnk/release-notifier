import { PrismaClient } from '@prisma/client';
import { execSync } from 'node:child_process';
import { logger } from '../config/logger';

export const prisma = new PrismaClient({
  log: [
    {
      emit: 'event',
      level: 'query',
    },
    {
      emit: 'event',
      level: 'warn',
    },
    {
      emit: 'event',
      level: 'error',
    },
  ],
});

// Middleware for logging
prisma.$on('query', (e) => {
  logger.debug({ query: e.query, params: e.params }, 'Database query');
});

prisma.$on('error', (e) => {
  logger.error({ message: e.message }, 'Database error');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

export async function initializeDatabase() {
  try {
    logger.info('Running database migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    logger.info('Migrations completed');

    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error({ error }, 'Failed to initialize database');
    throw error;
  }
}
