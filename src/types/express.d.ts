import type { AuthTokenPayload } from '../utils/jwt.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthTokenPayload;
    file?: Express.Multer.File;
    files?: Express.Multer.File[];
  }
}

