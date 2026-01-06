import type { Request, Response, NextFunction } from 'express';
import { authenticateMember, registerMember, verifyMemberEmail, resendEmailVerification } from '../services/memberService.js';
import { requestPasswordReset, resetPassword } from '../services/passwordResetService.js';
import type { z } from 'zod';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/authSchemas.js';
import { HttpError } from '../middlewares/errorHandler.js';

const wantsHtml = (req: Request): boolean => {
  const accept = req.headers.accept;
  return typeof accept === 'string' && accept.includes('text/html');
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const renderVerificationPage = (title: string, message: string, status: 'success' | 'error'): string => {
  const accent = status === 'success' ? '#16a34a' : '#dc2626';
  const statusLabel = status === 'success' ? 'Verified' : 'Error';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; }
    body {
      margin: 0;
      font-family: "Segoe UI", Tahoma, Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
    }
    .wrap {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      max-width: 520px;
      width: 100%;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 28px;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
    }
    .status {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      background: ${accent};
      color: #fff;
    }
    h1 {
      margin: 16px 0 10px;
      font-size: 24px;
    }
    p {
      margin: 0;
      line-height: 1.6;
      color: #334155;
    }
    .hint {
      margin-top: 16px;
      font-size: 14px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <span class="status">${statusLabel}</span>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <p class="hint">You can close this tab and return to the app.</p>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Handles member registration.
 * Request body is validated by validateRequest middleware.
 */
export const register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.body as z.infer<typeof registerSchema>;
    const result = await registerMember(payload);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Handles member login and issues JWT.
 * Request body is validated by validateRequest middleware.
 */
export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.body as z.infer<typeof loginSchema>;
    const result = await authenticateMember(payload);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

/**
 * Verifies a member's email address using the supplied token.
 */
export const verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.query as z.infer<typeof verifyEmailSchema>;
    const result = await verifyMemberEmail(payload.token);
    if (wantsHtml(req)) {
      res
        .status(200)
        .send(renderVerificationPage('Email verified', 'Your email address is now verified.', 'success'));
      return;
    }
    res.status(200).json({ success: true, data: result, message: 'Email verified successfully' });
  } catch (error) {
    if (wantsHtml(req)) {
      const status = error instanceof HttpError ? error.statusCode : 500;
      const message = error instanceof Error ? error.message : 'Email verification failed';
      res.status(status).send(renderVerificationPage('Email verification failed', message, 'error'));
      return;
    }
    next(error);
  }
};

/**
 * Resends a verification email to an unverified member.
 */
export const resendVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.body as z.infer<typeof resendVerificationSchema>;
    await resendEmailVerification(payload.email);
    res.status(200).json({ success: true, message: 'Verification email sent' });
  } catch (error) {
    next(error);
  }
};

/**
 * Sends a password reset email if the account exists.
 */
export const forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.body as z.infer<typeof forgotPasswordSchema>;
    await requestPasswordReset(payload.email);
    res.status(200).json({
      success: true,
      message: 'If the email exists, a password reset link has been sent.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resets a member password using a valid reset token.
 */
export const resetPasswordHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const payload = req.body as z.infer<typeof resetPasswordSchema>;
    await resetPassword(payload.token, payload.newPassword);
    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};
