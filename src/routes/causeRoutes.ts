import { Router } from 'express';
import { createCauseHandler, listCausesHandler } from '../controllers/causeController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { causeSchema } from '../schemas/causeSchemas.js';

const router = Router();

router.get('/', listCausesHandler);
router.post('/', authenticate, validateRequest(causeSchema), createCauseHandler);

export default router;


