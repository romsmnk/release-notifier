import dotenv from 'dotenv';
import path from 'node:path';

// Load environment variables
dotenv.config({
  path: path.resolve(process.cwd(), '.env'),
});

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL,

  // GitHub API
  githubApiToken: process.env.GITHUB_API_TOKEN,
  githubApiMaxRetries: Number.parseInt(process.env.GITHUB_API_MAX_RETRIES || '3', 10),
  githubApiRetryDelay: Number.parseInt(process.env.GITHUB_API_RETRY_DELAY || '1000', 10),

  // Email
  email: {
    host: process.env.EMAIL_HOST || 'smtp.mailtrap.io',
    port: Number.parseInt(process.env.EMAIL_PORT || '465', 10),
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM || 'noreply@release-notifier.local',
  },

  // Redis
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',

  // Scanner
  scannerInterval: Number.parseInt(process.env.SCANNER_INTERVAL || '3600000', 10), // 1 hour by default

  // API Key
  apiKeyEnabled: process.env.API_KEY_ENABLED === 'true',
  apiKeyToken: process.env.API_KEY_TOKEN,

  // Cache TTL (10 minutes)
  cacheTtl: 10 * 60,

  // GitHub API Rate Limits
  rateLimits: {
    unauthenticated: 60, // per hour
    authenticated: 5000, // per hour
  },
};
