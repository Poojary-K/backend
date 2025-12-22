import { Router } from 'express';
import { createContributionHandler, listContributionsHandler } from '../controllers/contributionController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { contributionSchema } from '../schemas/contributionSchemas.js';

const router = Router();

// Apply authentication to all routes in this router
router.use(authenticate);

router.post('/', validateRequest(contributionSchema), createContributionHandler);
router.get('/', listContributionsHandler);

export default router;


