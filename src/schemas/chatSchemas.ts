import { z } from 'zod';

/**
 * Body schema for creating a chat session.
 */
export const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
});

/**
 * Body schema for sending a user message.
 */
export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
});
