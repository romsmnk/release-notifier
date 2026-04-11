import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../config/logger';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import {
  GetSubscriptionsRequestSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
} from '../schemas';
import { SubscriptionService } from '../services/subscription';

export function setupRoutes(fastify: FastifyInstance, subscriptionService: SubscriptionService) {
  fastify.post<{ Body: any }>(
    '/api/subscribe',
    {
      schema: {
        description: 'Subscribe to repository release notifications',
        tags: ['Subscriptions'],
        body: {
          type: 'object',
          required: ['email', 'repository'],
          properties: {
            email: { type: 'string', format: 'email' },
            repository: { type: 'string', examples: ['golang/go'] },
          },
        },
        response: {
          201: {
            description: 'Successfully subscribed',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          400: {
            description: 'Invalid repository format',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'number' },
            },
          },
          404: {
            description: 'Repository not found',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'number' },
            },
          },
          409: {
            description: 'Already subscribed',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'number' },
            },
          },
        },
      },
      preHandler: apiKeyAuth,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const validated = SubscribeRequestSchema.parse(request.body);
        await subscriptionService.subscribeToRepository(validated.email, validated.repository);

        logger.info(
          { email: validated.email, repository: validated.repository },
          'User subscribed'
        );

        reply.status(201).send({
          success: true,
          message: `Successfully subscribed ${validated.email} to ${validated.repository}`,
        });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          reply.status(400).send({
            error: 'ValidationError',
            message: error.errors[0].message,
            statusCode: 400,
          });
        } else {
          throw error;
        }
      }
    }
  );

  fastify.post<{ Body: any }>(
    '/api/unsubscribe',
    {
      schema: {
        description: 'Unsubscribe from repository release notifications',
        tags: ['Subscriptions'],
        body: {
          type: 'object',
          required: ['email', 'repository'],
          properties: {
            email: { type: 'string', format: 'email' },
            repository: { type: 'string', examples: ['golang/go'] },
          },
        },
        response: {
          200: {
            description: 'Successfully unsubscribed',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          404: {
            description: 'Subscription not found',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'number' },
            },
          },
        },
      },
      preHandler: apiKeyAuth,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const validated = UnsubscribeRequestSchema.parse(request.body);
        await subscriptionService.unsubscribeFromRepository(validated.email, validated.repository);

        logger.info(
          { email: validated.email, repository: validated.repository },
          'User unsubscribed'
        );

        reply.send({
          success: true,
          message: `Successfully unsubscribed ${validated.email} from ${validated.repository}`,
        });
      } catch (error: any) {
        if (error.name === 'ZodError') {
          reply.status(400).send({
            error: 'ValidationError',
            message: error.errors[0].message,
            statusCode: 400,
          });
        } else {
          throw error;
        }
      }
    }
  );

  fastify.get<{ Querystring: any }>(
    '/api/subscriptions',
    {
      schema: {
        description: 'Get user subscriptions',
        tags: ['Subscriptions'],
        querystring: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
          },
        },
        response: {
          200: {
            description: 'List of subscriptions',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                repository: { type: 'string' },
                createdAt: { type: 'string' },
              },
            },
          },
          400: {
            description: 'Invalid email format',
            type: 'object',
            properties: {
              error: { type: 'string' },
              message: { type: 'string' },
              statusCode: { type: 'number' },
            },
          },
        },
      },
      preHandler: apiKeyAuth,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const validated = GetSubscriptionsRequestSchema.parse(request.query);
        const subscriptions = await subscriptionService.getUserSubscriptions(validated.email);

        reply.send(subscriptions);
      } catch (error: any) {
        if (error.name === 'ZodError') {
          reply.status(400).send({
            error: 'ValidationError',
            message: error.errors[0].message,
            statusCode: 400,
          });
        } else {
          throw error;
        }
      }
    }
  );

  fastify.get(
    '/health',
    {
      schema: {
        description: 'Health check endpoint',
        tags: ['Health'],
        response: {
          200: {
            description: 'Service is healthy',
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      reply.send({
        status: 'ok',
        timestamp: new Date().toISOString(),
      });
    }
  );
}
