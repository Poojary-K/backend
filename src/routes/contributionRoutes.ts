import { Router } from 'express';
import { createContributionHandler, listContributionsHandler } from '../controllers/contributionController.js';
import { authenticate } from '../middlewares/authMiddleware.js';

const router = Router();

router.use(authenticate);
router.post('/', createContributionHandler);
router.get('/', listContributionsHandler);

export default router;


