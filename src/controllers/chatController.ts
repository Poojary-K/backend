import type { Request, Response, NextFunction } from 'express';
import type { z } from 'zod';
import { HttpError } from '../middlewares/errorHandler.js';
import {
  createChatSession,
  listChatSessions,
  getChatSession,
  deleteChatSession,
  sendMessage,
} from '../services/chatService.js';
import { checkAgentHealth } from '../services/llmClient.js';
import type { createSessionSchema, sendMessageSchema } from '../schemas/chatSchemas.js';

const MAX_SESSION_LIST_LIMIT = 100;
const DEFAULT_SESSION_LIST_LIMIT = 50;

// Resolves the authenticated caller or fails with 401.
const requireUser = (req: Request): { memberId: number; isAdmin: boolean } => {
  if (!req.user) {
    throw new HttpError('Authentication required', 401);
  }
  return { memberId: req.user.memberId, isAdmin: req.user.isAdmin ?? false };
};

// Parses and validates the :sessionId route param.
const parseSessionId = (value: string | undefined): number => {
  const id = Number.parseInt(value ?? '', 10);
  if (Number.isNaN(id)) {
    throw new HttpError('Invalid session ID', 400);
  }
  return id;
};

/**
 * Returns whether the AI agent is reachable and configured.
 */
export const chatHealthHandler = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { available } = await checkAgentHealth();
    res.status(200).json({ success: true, data: { available } });
  } catch (error) {
    next(error);
  }
};

/**
 * Creates a new chat session.
 */
export const createSessionHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { memberId } = requireUser(req);
    const { title } = req.body as z.infer<typeof createSessionSchema>;
    const session = await createChatSession(memberId, title);
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    next(error);
  }
};

/**
 * Lists the current user's active sessions.
 */
export const listSessionsHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { memberId } = requireUser(req);
    const parsedLimit = Number.parseInt(String(req.query.limit ?? ''), 10);
    const limit = Number.isNaN(parsedLimit)
      ? DEFAULT_SESSION_LIST_LIMIT
      : Math.min(Math.max(parsedLimit, 1), MAX_SESSION_LIST_LIMIT);
    const sessions = await listChatSessions(memberId, limit);
    res.status(200).json({ success: true, data: { sessions } });
  } catch (error) {
    next(error);
  }
};

/**
 * Returns a session with its message history.
 */
export const getSessionHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { memberId } = requireUser(req);
    const sessionId = parseSessionId(req.params.sessionId);
    const data = await getChatSession(sessionId, memberId);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

/**
 * Hard-deletes a session and its messages.
 */
export const deleteSessionHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { memberId } = requireUser(req);
    const sessionId = parseSessionId(req.params.sessionId);
    await deleteChatSession(sessionId, memberId);
    res.status(200).json({ success: true, message: 'Session deleted' });
  } catch (error) {
    next(error);
  }
};

/**
 * Sends a user message and returns the assistant reply.
 */
export const sendMessageHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { memberId, isAdmin } = requireUser(req);
    const sessionId = parseSessionId(req.params.sessionId);
    const { content } = req.body as z.infer<typeof sendMessageSchema>;
    const result = await sendMessage({ sessionId, memberId, isAdmin, content });
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};
