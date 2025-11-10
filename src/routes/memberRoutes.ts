import { Router } from 'express';
import { listMembersHandler } from '../controllers/memberController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = Router();

router.get('/', authenticate, listMembersHandler);

export default router;


