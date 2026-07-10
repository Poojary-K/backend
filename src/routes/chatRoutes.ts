import { Router } from 'express';
import {
  chatHealthHandler,
  chatToolsHandler,
  createSessionHandler,
  listSessionsHandler,
  getSessionHandler,
  deleteSessionHandler,
  getSessionPendingHandler,
  confirmSessionPendingHandler,
  cancelSessionPendingHandler,
  sendMessageHandler,
  streamMessageHandler,
} from '../controllers/chatController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { chatRateLimiter } from '../middlewares/chatRateLimiter.js';
import { createSessionSchema, sendMessageSchema } from '../schemas/chatSchemas.js';

const router = Router();

// Chat is for authenticated members only.
router.use(authenticate);

router.get('/health', chatHealthHandler);
router.get('/tools', chatToolsHandler);
router.post('/sessions', validateRequest(createSessionSchema), createSessionHandler);
router.get('/sessions', listSessionsHandler);
router.get('/sessions/:sessionId', getSessionHandler);
router.get('/sessions/:sessionId/pending', getSessionPendingHandler);
router.post('/sessions/:sessionId/pending/confirm', confirmSessionPendingHandler);
router.post('/sessions/:sessionId/pending/cancel', cancelSessionPendingHandler);
router.delete('/sessions/:sessionId', deleteSessionHandler);
// Stricter limit on the LLM-backed endpoints.
router.post('/sessions/:sessionId/messages', chatRateLimiter, validateRequest(sendMessageSchema), sendMessageHandler);
router.post('/sessions/:sessionId/messages/stream', chatRateLimiter, validateRequest(sendMessageSchema), streamMessageHandler);

export default router;
