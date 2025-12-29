import { Router } from 'express';
import {
  createCauseHandler,
  listCausesHandler,
  getCauseByIdHandler,
  updateCauseHandler,
  deleteCauseHandler,
} from '../controllers/causeController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { requireAdmin } from '../middlewares/adminMiddleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { causeSchema } from '../schemas/causeSchemas.js';

const router = Router();

router.get('/', listCausesHandler);
router.get('/:id', getCauseByIdHandler);
router.post('/', authenticate, validateRequest(causeSchema), createCauseHandler);
router.put('/:id', authenticate, requireAdmin, validateRequest(causeSchema), updateCauseHandler);
router.delete('/:id', authenticate, requireAdmin, deleteCauseHandler);

export default router;


