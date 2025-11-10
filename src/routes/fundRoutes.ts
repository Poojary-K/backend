import { Router } from 'express';
import { getFundStatusHandler } from '../controllers/fundController.js';

const router = Router();

router.get('/status', getFundStatusHandler);

export default router;


