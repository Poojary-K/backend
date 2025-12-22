import { Router } from 'express';
import { register, login } from '../controllers/authController.js';
import { upgradeToAdminHandler } from '../controllers/adminController.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import { registerSchema, loginSchema } from '../schemas/authSchemas.js';
import { upgradeToAdminSchema } from '../schemas/adminSchemas.js';

const router = Router();

router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);
router.post('/upgrade-to-admin', authenticate, validateRequest(upgradeToAdminSchema), upgradeToAdminHandler);

export default router;


