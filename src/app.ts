import express from 'express';
import helmet from 'helmet';
import routes from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';

/**
 * Builds and configures the express application instance with middleware and routes.
 */
export const createApp = () => {
  const app = express();
  app.use(helmet());
  app.use(express.json());
  app.use('/api', routes);
  app.use(errorHandler);
  return app;
};


