import { Router } from 'express';
import {
  createContributionHandler,
  createContributionWithImagesHandler,
  listContributionsHandler,
  getContributionByIdHandler,
  updateContributionHandler,
  deleteContributionHandler,
} from '../controllers/contributionController.js';
import {
  listContributionImagesHandler,
  addContributionImagesHandler,
  replaceContributionImageHandler,
  deleteContributionImageHandler,
} from '../controllers/contributionImageController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { uploadImages, uploadSingleImage } from '../middlewares/uploadMiddleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { contributionSchema } from '../schemas/contributionSchemas.js';

const router = Router();

// Apply authentication to all routes in this router
router.use(authenticate);

router.get('/', listContributionsHandler);
router.get('/:id', getContributionByIdHandler);
router.get('/:id/images', listContributionImagesHandler);
router.post('/', validateRequest(contributionSchema), createContributionHandler);
router.post('/with-images', uploadImages('images'), createContributionWithImagesHandler);
router.post('/:id/images', uploadImages('images'), addContributionImagesHandler);
router.put('/:id', validateRequest(contributionSchema), updateContributionHandler);
router.put('/:id/images/:imageId', uploadSingleImage('image'), replaceContributionImageHandler);
router.delete('/:id', deleteContributionHandler);
router.delete('/:id/images/:imageId', deleteContributionImageHandler);

export default router;
