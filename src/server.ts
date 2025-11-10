import { createServer } from 'node:http';
import { createApp } from './app.js';
import { getConfig } from './config/env.js';

/**
 * Bootstraps the HTTP server and begins listening on the configured port.
 */
const start = () => {
  const { port } = getConfig();
  const app = createApp();
  const server = createServer(app);
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Server listening on port ${port}`);
  });
};

start();

