import { Router } from 'express';
import { validateRequest } from '../middlewares/validateRequest.js';
import { emailUnsubscribeQuerySchema } from '../schemas/emailPreferenceSchemas.js';
import { unsubscribeFromEmailHandler } from '../controllers/emailUnsubscribeController.js';

const router = Router();

router.get('/unsubscribe', validateRequest(emailUnsubscribeQuerySchema, 'query'), unsubscribeFromEmailHandler);

export default router;
