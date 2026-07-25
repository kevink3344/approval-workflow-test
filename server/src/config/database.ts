import { createClient } from '@libsql/client';
import { env } from './env';

const client = createClient({
  url: env.TURSO_DATABASE_URL,
  authToken: env.TURSO_DATABASE_TOKEN,
});

export default client;