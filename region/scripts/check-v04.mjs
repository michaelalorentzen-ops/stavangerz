/** One reproducible functional gate. Numeric difficulty/balance tuning is separate. */
import { spawnSync } from 'node:child_process';
const checks = ['check-v04-location', 'check-v04-checkpoint', 'check-v04-replay', 'check-v04-gear', 'check-v04-phase-gate', 'region-claim-regression', 'check-v04-mobility', 'check-v04-campaign', 'check-v04-discoveries', 'check-v04-wonders', 'check-v04-administration', 'check-simulation', 'check-gameplay', 'region-events'];
for (const check of checks) {
  const result = spawnSync(process.execPath, ['--import', 'tsx', `scripts/${check}.ts`], { stdio: 'inherit', env: { ...process.env, REQUIRE_REGIONAL_WORK: '1' } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('PASS functional v0.4 gate. Run both browser journeys against a running production build.');
