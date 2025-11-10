import type { AuthTokenPayload } from '../utils/jwt.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthTokenPayload;
  }
}


