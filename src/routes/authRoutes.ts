import { Router } from 'express';
import { register, login } from '../controllers/authController.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { registerSchema, loginSchema } from '../schemas/authSchemas.js';

const router = Router();

router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);

export default router;


