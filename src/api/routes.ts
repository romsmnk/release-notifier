import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../config/logger';
import { apiKeyAuth } from '../middleware/apiKeyAuth';
import {
  GetSubscriptionsRequestSchema,
  SubscribeRequestSchema,
} from '../schemas';
import { SubscriptionService } from '../services/subscription';

export function setupRoutes(fastify: FastifyInstance, subscriptionService: SubscriptionService) {
  fastify.post<{ Body: any }>(
    '/api/subscribe',
    {
      schema: {
        description: 'Subscribe to repository release notifications',
        tags: ['subscription'],
        body: {
          type: 'object',
          required: ['email', 'repo'],
          properties: {
            email: { type: 'string', format: 'email' },
            repo: { type: 'string', examples: ['golang/go'] },
          },
        },
        response: {
          200: {
            description: 'Subscription successful. Confirmation email sent.',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
          400: {
            description: 'Invalid input (e.g., invalid repo format)',
            type: 'object',
          },
          404: {
            description: 'Repository not found on GitHub',
            type: 'object',
          },
          409: {
            description: 'Email already subscribed to this repository',
            type: 'object',
          },
        },
      },
      preHandler: apiKeyAuth,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const validated = SubscribeRequestSchema.parse(request.body);
        const result = await subscriptionService.subscribeToRepository(
          validated.email,
          validated.repo
        );

        logger.info(
          { email: validated.email, repo: validated.repo },
          'Subscription created, confirmation email sent'
        );

        reply.status(200).send(result);
      } catch (error: any) {
        if (error.name === 'ZodError') {
          return reply.code(400).type('application/json').send(JSON.stringify({
            error: 'ValidationError',
            message: error.errors[0].message,
            statusCode: 400,
          }));
        } else if (error.name === 'InvalidRepositoryFormatError') {
          return reply.code(400).type('application/json').send(JSON.stringify({
            error: 'ValidationError',
            message: error.message,
            statusCode: 400,
          }));
        } else if (error.name === 'RepositoryNotFoundError' || error.message?.includes('not found')) {
          return reply.code(404).type('application/json').send(JSON.stringify({
            error: 'NotFound',
            message: error.message,
            statusCode: 404,
          }));
        } else if (error.message?.includes('already subscribed') || error.message?.includes('already confirmed')) {
          return reply.code(409).type('application/json').send(JSON.stringify({
            error: 'Conflict',
            message: error.message,
            statusCode: 409,
          }));
        } else {
          throw error;
        }
      }
    }
  );

  fastify.get<{ Params: { token: string } }>(
    '/api/confirm/:token',
    {
      schema: {
        description: 'Confirms a subscription using the token sent in the confirmation email.',
        tags: ['subscription'],
        params: {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'Confirmation token' },
          },
        },
        response: {
          200: {
            description: 'Subscription confirmed successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              repository: { type: 'string' },
            },
          },
          400: {
            description: 'Invalid token',
            type: 'object',
          },
          404: {
            description: 'Token not found',
            type: 'object',
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
      try {
        const result = await subscriptionService.confirmSubscription(request.params.token);
        reply.send(result);
      } catch (error: any) {
        logger.error({ token: request.params.token, error: error.message }, 'Confirmation failed');

        if (error.name === 'TokenNotFoundError') {
          return reply.code(404).send({
            error: 'NotFound',
            message: error.message,
            statusCode: 404,
          });
        }

        reply.code(400).type('application/json').send(JSON.stringify({
          error: 'BadRequest',
          message: error.message,
          statusCode: 400,
        }));
      }
    }
  );

  fastify.get<{ Params: { token: string } }>(
    '/api/unsubscribe/:token',
    {
      schema: {
        description: 'Unsubscribes an email from release notifications using the token sent in emails.',
        tags: ['subscription'],
        params: {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'Unsubscribe token' },
          },
        },
        response: {
          200: {
            description: 'Unsubscribed successfully',
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              repository: { type: 'string' },
            },
          },
          400: {
            description: 'Invalid token',
            type: 'object',
          },
          404: {
            description: 'Token not found',
            type: 'object',
          },
        },
      },
    },
    async (request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
      try {
        const result = await subscriptionService.unsubscribeByToken(request.params.token);
        reply.send(result);
      } catch (error: any) {
        logger.error({ token: request.params.token, error: error.message }, 'Unsubscribe failed');

        if (error.name === 'TokenNotFoundError') {
          return reply.code(404).send({
            error: 'NotFound',
            message: error.message,
            statusCode: 404,
          });
        }

        reply.code(400).type('application/json').send(JSON.stringify({
          error: 'BadRequest',
          message: error.message,
          statusCode: 400,
        }));
      }
    }
  );

  fastify.get<{ Querystring: any }>(
    '/api/subscriptions',
    {
      schema: {
        description: 'Get subscriptions for an email',
        tags: ['subscription'],
        querystring: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email', description: 'Email address to look up subscriptions for' },
          },
        },
        response: {
          200: {
            description: 'Successful operation - list of subscriptions returned',
            type: 'array',
            items: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                repo: { type: 'string' },
                confirmed: { type: 'boolean' },
                last_seen_tag: { type: ['string', 'null'] },
              },
            },
          },
          400: {
            description: 'Invalid email',
            type: 'object',
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const validated = GetSubscriptionsRequestSchema.parse(request.query);
        const subscriptions = await subscriptionService.getUserSubscriptions(validated.email);

        reply.send(subscriptions);
      } catch (error: unknown) {
        const isZodError =
          typeof error === 'object' &&
          error !== null &&
          (
            ('name' in error && (error as { name?: string }).name ===  'ZodError') ||
            ('constructor' in error &&
              (error as { constructor?: { name?: string } }).constructor?.name === 'ZodError')
          );

        if (isZodError) {
          const zodError = error as { errors?: Array<{ message?: string }>; message?: string };

          return reply
            .code(400)
            .send({
              error: 'ValidationError',
              message: zodError.errors?.[0]?.message || zodError.message || 'Validation failed',
              statusCode: 400,
            });
        }

        throw error;
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
