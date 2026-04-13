import { FastifyReply, FastifyRequest } from 'fastify';

export async function errorHandler(error: Error, request: FastifyRequest, reply: FastifyReply) {
  let statusCode = 500;
  let message = 'Internal Server Error';

  if ((error as any).statusCode) {
    statusCode = (error as any).statusCode;
    message = error.message;
  }

  else if (error.name === 'ZodError' || error.constructor.name === 'ZodError') {
    statusCode = 400;
    message = (error as any).errors?.[0]?.message || error.message;
  }
  else if (['RepositoryNotFoundError', 'not found'].includes(error.name)) {
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

  reply.code(statusCode).type('application/json').send(JSON.stringify({
    error: statusCode === 400 ? 'ValidationError' : (error.name || 'Error'),
    message,
    statusCode,
  }));
}
