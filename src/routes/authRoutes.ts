import { Router } from 'express';
import {
  register,
  login,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPasswordHandler,
} from '../controllers/authController.js';
import { upgradeToAdminHandler } from '../controllers/adminController.js';
import { validateRequest } from '../middlewares/validateRequest.js';
import { authenticate } from '../middlewares/authMiddleware.js';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/authSchemas.js';
import { upgradeToAdminSchema } from '../schemas/adminSchemas.js';

const router = Router();

router.post('/register', validateRequest(registerSchema), register);
router.post('/login', validateRequest(loginSchema), login);
router.get('/verify-email', validateRequest(verifyEmailSchema, 'query'), verifyEmail);
router.post('/resend-verification', validateRequest(resendVerificationSchema), resendVerification);
router.post('/forgot-password', validateRequest(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validateRequest(resetPasswordSchema), resetPasswordHandler);
router.post('/upgrade-to-admin', authenticate, validateRequest(upgradeToAdminSchema), upgradeToAdminHandler);

export default router;
