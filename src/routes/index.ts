import { Router } from 'express';
import authRoutes from './authRoutes.js';
import memberRoutes from './memberRoutes.js';
import contributionRoutes from './contributionRoutes.js';
import causeRoutes from './causeRoutes.js';
import fundRoutes from './fundRoutes.js';

const router = Router();

router.use('/auth', authRoutes);
router.use('/members', memberRoutes);
router.use('/contributions', contributionRoutes);
router.use('/causes', causeRoutes);
router.use('/funds', fundRoutes);

export default router;


