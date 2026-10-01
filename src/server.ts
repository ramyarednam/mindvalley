import { config } from './config.ts';
import { Store } from './db.ts';
import { createApp } from './app.ts';
import { seedAdminFromEnv, setupCode } from './auth.ts';

const store = new Store(config.dbPath);
await seedAdminFromEnv(store);
const app = createApp(store);
const server = app.server();

server.listen(config.port, config.host, () => {
  console.log(`Pre-Watch running at http://localhost:${config.port}`);
  console.log(`  Team app: http://localhost:${config.port}/app/`);
  if (store.countUsers() === 0) {
    console.log('');
    console.log('  First run: open the team app and create the admin account.');
    console.log(`  Setup code: ${setupCode()}`);
    console.log('');
  }
});

const shutdown = () => {
  server.close();
  store.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
