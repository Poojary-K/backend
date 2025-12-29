import { Router } from 'express';
import {
  createContributionHandler,
  listContributionsHandler,
  getContributionByIdHandler,
  updateContributionHandler,
  deleteContributionHandler,
} from '../controllers/contributionController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { contributionSchema } from '../schemas/contributionSchemas.js';

const router = Router();

// Apply authentication to all routes in this router
router.use(authenticate);

router.get('/', listContributionsHandler);
router.get('/:id', getContributionByIdHandler);
router.post('/', validateRequest(contributionSchema), createContributionHandler);
router.put('/:id', validateRequest(contributionSchema), updateContributionHandler);
router.delete('/:id', deleteContributionHandler);

export default router;


