import { Router } from 'express';
import {
  createCauseHandler,
  createCauseWithImagesHandler,
  listCausesHandler,
  getCauseByIdHandler,
  updateCauseHandler,
  deleteCauseHandler,
} from '../controllers/causeController.js';
import {
  listCauseImagesHandler,
  addCauseImagesHandler,
  replaceCauseImageHandler,
  deleteCauseImageHandler,
} from '../controllers/causeImageController.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { requireAdmin } from '../middlewares/adminMiddleware.js';
import { uploadImages, uploadSingleImage } from '../middlewares/uploadMiddleware.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { causeSchema } from '../schemas/causeSchemas.js';

const router = Router();

router.get('/', listCausesHandler);
router.get('/:id', getCauseByIdHandler);
router.get('/:id/images', listCauseImagesHandler);
router.post('/', authenticate, validateRequest(causeSchema), createCauseHandler);
router.post('/with-images', authenticate, uploadImages('images'), createCauseWithImagesHandler);
router.post('/:id/images', authenticate, requireAdmin, uploadImages('images'), addCauseImagesHandler);
router.put('/:id', authenticate, requireAdmin, validateRequest(causeSchema), updateCauseHandler);
router.put('/:id/images/:imageId', authenticate, requireAdmin, uploadSingleImage('image'), replaceCauseImageHandler);
router.delete('/:id', authenticate, requireAdmin, deleteCauseHandler);
router.delete('/:id/images/:imageId', authenticate, requireAdmin, deleteCauseImageHandler);

export default router;
