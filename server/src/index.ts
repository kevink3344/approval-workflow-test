import app from './app';
import { env } from './config/env';
import { runMigrations } from './config/migrate';

async function startServer() {
  await runMigrations();

  app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT} [${env.NODE_ENV}]`);
    console.log(`Health check: http://localhost:${env.PORT}/api/health`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});