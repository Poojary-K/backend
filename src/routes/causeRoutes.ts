import { Router } from 'express';
import { createCauseHandler, listCausesHandler } from '../controllers/causeController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', listCausesHandler);
router.post('/', authenticate, createCauseHandler);

export default router;


