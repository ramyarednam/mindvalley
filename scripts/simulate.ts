// Usage: npm run simulate -- <testId> [viewers]
import { config } from '../src/config.ts';
import { Store } from '../src/db.ts';
import { simulatePanel } from '../src/simulate.ts';

const [testId, viewersArg] = process.argv.slice(2);
if (!testId) {
  console.error('Usage: npm run simulate -- <testId> [viewers]');
  process.exit(1);
}
const store = new Store(config.dbPath);
const test = store.getTest(testId);
if (!test) {
  console.error(`No test ${testId}`);
  process.exit(1);
}
const viewers = Number(viewersArg ?? 300);
for (const cut of store.getCuts(test.id)) {
  const t0 = Date.now();
  const n = simulatePanel(store, test, cut, Math.ceil(viewers / store.getCuts(test.id).length));
  console.log(`${cut.label}: ${n} synthetic viewers in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
store.close();
