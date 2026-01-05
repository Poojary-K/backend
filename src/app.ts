import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { rateLimiter } from './middlewares/rateLimiter.js';

/**
 * Builds and configures the express application instance with middleware and routes.
 */
export const createApp = () => {
  const app = express();
  
  // CORS configuration - allow any origin (required when using credentials)
  app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  
  app.use(helmet());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  
  // Apply rate limiting to all API routes
  app.use('/api', rateLimiter);
  
  app.use('/api', routes);
  app.use(errorHandler);
  return app;
};
