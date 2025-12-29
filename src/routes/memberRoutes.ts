import { Router } from 'express';
import {
  listMembersHandler,
  getMemberByIdHandler,
  updateMemberHandler,
  deleteMemberHandler,
} from '../controllers/memberController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { requireAdmin } from '../middlewares/adminMiddleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { updateMemberSchema } from '../schemas/memberSchemas.js';

const router = Router();

router.get('/', authenticate, listMembersHandler);
router.get('/:id', authenticate, getMemberByIdHandler);
router.put('/:id', authenticate, requireAdmin, validateRequest(updateMemberSchema), updateMemberHandler);
router.delete('/:id', authenticate, requireAdmin, deleteMemberHandler);

export default router;


