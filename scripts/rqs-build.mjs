import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const target = String(process.env.RQS_BUILD_TARGET || 'production').trim().toLowerCase();
const allowedTargets = new Set(['production', 'staging']);

if (!allowedTargets.has(target)) {
  console.error(`Invalid RQS_BUILD_TARGET: ${target}`);
  console.error('Allowed values: production, staging');
  process.exit(2);
}

const scriptDir = dirname(fileURLToPath(import.meta.url));
const angularCli = resolve(scriptDir, '..', 'node_modules', '@angular', 'cli', 'bin', 'ng.js');
const extraArgs = process.argv.slice(2);
const args = ['build', '--configuration', target, ...extraArgs];

console.log(`RQS_BUILD_TARGET: ${target}`);
console.log(`RQS_BUILD_COMMAND: ng ${args.join(' ')}`);

const result = spawnSync(process.execPath, [angularCli, ...args], {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
