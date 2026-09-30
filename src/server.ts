import { config } from './config.ts';
import { Store } from './db.ts';
import { createApp } from './app.ts';

const store = new Store(config.dbPath);
const app = createApp(store);
const server = app.server();

server.listen(config.port, config.host, () => {
  console.log(`Pre-Watch running at http://localhost:${config.port}`);
  console.log(`  Studio:   http://localhost:${config.port}/studio/`);
  if (!process.env.STUDIO_PASSWORD) console.log('  Studio password is the default "prewatch". Set STUDIO_PASSWORD before sharing this server.');
});

const shutdown = () => {
  server.close();
  store.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
