import type { Request, Response, NextFunction } from 'express';
import { HttpError } from '../middlewares/errorHandler.js';
import { disableEmailUpdatesFromUnsubscribeToken } from '../services/emailPreferenceService.js';

const htmlPage = (title: string, body: string): string => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>
body { font-family: system-ui, sans-serif; background:#f4f4f5; margin:0; padding:24px; color:#18181b; }
.card { max-width:480px; margin:40px auto; background:#fff; padding:24px; border-radius:12px; border:1px solid #e4e4e7; }
h1 { font-size:1.25rem; margin:0 0 12px; }
p { margin:0; line-height:1.5; color:#52525b; font-size:0.95rem; }
</style>
</head>
<body>
<div class="card">
<h1>${title}</h1>
<p>${body}</p>
</div>
</body>
</html>`;

/**
 * Handles GET /api/email/unsubscribe?token=… — disables cause/contribution emails for the member.
 */
export const unsubscribeFromEmailHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = String(req.query.token ?? '');
    await disableEmailUpdatesFromUnsubscribeToken(token);
    res
      .status(200)
      .type('html')
      .send(
        htmlPage(
          'Unsub confirmed',
          'You will no longer receive emails about causes and contributions. You will still get account emails (such as verification and password reset) when needed.',
        ),
      );
  } catch (error) {
    if (error instanceof HttpError) {
      const message =
        error.statusCode === 400
          ? 'This unsubscribe link is invalid or has expired.'
          : error.message;
      res.status(error.statusCode).type('html').send(htmlPage('Something went wrong', message));
      return;
    }
    next(error);
  }
};
