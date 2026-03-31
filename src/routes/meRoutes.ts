import { Router } from 'express';
import { authenticate } from '../middlewares/authMiddleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { patchEmailPreferencesSchema } from '../schemas/meSchemas.js';
import { getMyEmailPreferencesHandler, patchMyEmailPreferencesHandler } from '../controllers/meController.js';

const router = Router();

router.get('/email-preferences', authenticate, getMyEmailPreferencesHandler);
router.patch(
  '/email-preferences',
  authenticate,
  validateRequest(patchEmailPreferencesSchema),
  patchMyEmailPreferencesHandler,
);

export default router;
