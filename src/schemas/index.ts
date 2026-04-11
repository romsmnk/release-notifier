import { z } from 'zod';

// Request schemas
export const SubscribeRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  repository: z
    .string()
    .regex(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/, 'Repository format must be owner/repo'),
});

export const UnsubscribeRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
  repository: z.string(),
});

export const GetSubscriptionsRequestSchema = z.object({
  email: z.string().email('Invalid email format'),
});

// Types
export type SubscribeRequest = z.infer<typeof SubscribeRequestSchema>;
export type UnsubscribeRequest = z.infer<typeof UnsubscribeRequestSchema>;
export type GetSubscriptionsRequest = z.infer<typeof GetSubscriptionsRequestSchema>;

// Response schemas
export const SubscriptionResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export const SubscriptionsListSchema = z.array(
  z.object({
    id: z.string(),
    repository: z.string(),
    createdAt: z.string(),
  })
);

export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
});
