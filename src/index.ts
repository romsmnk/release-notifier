import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import Fastify from 'fastify';
import { setupRoutes } from './api/routes';
import { config } from './config';
import { logger } from './config/logger';
import { initializeDatabase, prisma } from './db/prisma';
import { errorHandler } from './middleware/errorHandler';
import { EmailService } from './services/email';
import { GitHubApiClient } from './services/github';
import { ReleaseScanner } from './services/scanner';
import { SubscriptionService } from './services/subscription';

async function main() {
  try {
    logger.info('Initializing database...');
    await initializeDatabase();

    const githubClient = new GitHubApiClient();
    const emailService = new EmailService();
    const subscriptionService = new SubscriptionService(githubClient, emailService);

    const emailVerified = await emailService.verifyConnection();
    if (!emailVerified) {
      logger.warn('Email service verification failed - emails may not be sent');
    }

    const fastify = Fastify({
      logger: false,
    });

    await fastify.register(fastifySwagger, {
      openapi: {
        info: {
          title: 'Release Notifier API',
          description: 'API for subscribing to GitHub repository release notifications via email',
          version: '1.0.0',
        },
        servers: [{ url: `http://localhost:${config.port}` }],
        components: {
          securitySchemes: {
            apiKey: {
              type: 'apiKey',
              name: 'x-api-key',
              in: 'header',
            },
          },
        },
      },
      hideUntagged: true,
    });

    await fastify.register(fastifySwaggerUI, {
      routePrefix: '/docs',
    });

    fastify.setErrorHandler(errorHandler);

    setupRoutes(fastify, subscriptionService);

    const scanner = new ReleaseScanner(subscriptionService);
    scanner.start();

    await fastify.listen({ port: config.port, host: '0.0.0.0' });

    logger.info({ port: config.port }, 'Server started successfully');
    logger.info('Swagger documentation available at http://localhost:3000/docs');

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM signal received: closing HTTP server');
      scanner.stop();
      await fastify.close();
      await prisma.$disconnect();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT signal received: closing HTTP server');
      scanner.stop();
      await fastify.close();
      await prisma.$disconnect();
      process.exit(0);
    });
  } catch (error) {
    logger.error({ error }, 'Fatal error during startup');
    process.exit(1);
  }
}

main();
