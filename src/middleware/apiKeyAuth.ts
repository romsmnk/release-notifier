import { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config';
import { logger } from '../config/logger';

export async function apiKeyAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!config.apiKeyEnabled) {
    return;
  }

  const token = request.headers['x-api-key'] as string;

  if (!token) {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing API key in x-api-key header',
      statusCode: 401,
    });

    return;
  }

  if (token !== config.apiKeyToken) {
    logger.warn({ token: token.substring(0, 5) }, 'Invalid API key attempt');
    reply.status(403).send({
      error: 'Forbidden',
      message: 'Invalid API key',
      statusCode: 403,
    });

    return;
  }
}
