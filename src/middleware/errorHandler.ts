import { FastifyReply, FastifyRequest } from 'fastify';

export async function errorHandler(error: Error, request: FastifyRequest, reply: FastifyReply) {
  let statusCode = 500;
  let message = 'Internal Server Error';

  if (['RepositoryNotFoundError', 'not found'].includes(error.name)) {
    statusCode = 404;
    message = error.message;
  } else if (['ValidationError', 'InvalidRepositoryFormatError'].includes(error.name)) {
    statusCode = 400;
    message = error.message;
  } else if (error.name === 'RateLimitExceededError') {
    statusCode = 429;
    message = error.message;
  } else if (error.message.includes('already subscribed')) {
    statusCode = 409;
    message = error.message;
  }

  reply.status(statusCode).send({
    error: error.name || 'Error',
    message,
    statusCode,
  });
}
