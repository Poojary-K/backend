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
  
  // CORS configuration - allow requests from Angular dev server
  app.use(cors({
    origin: ['http://localhost:4200', 'http://localhost:3000', 'http://172.25.10.114:4200'], // Angular dev server
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  
  app.use(helmet());
  app.use(express.json());
  
  // Apply rate limiting to all API routes
  app.use('/api', rateLimiter);
  
  app.use('/api', routes);
  app.use(errorHandler);
  return app;
};


