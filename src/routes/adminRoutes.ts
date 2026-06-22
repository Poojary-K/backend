import { Router } from 'express';
import { startDbBackupHandler } from '../controllers/adminController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { requireAdmin } from '../middlewares/adminMiddleware.js';

const router = Router();

router.post('/db-backup', authenticate, requireAdmin, startDbBackupHandler);

export default router;
