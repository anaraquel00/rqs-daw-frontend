import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveBuildTarget } from './rqs-build-target.mjs';

let target;
try {
  target = resolveBuildTarget();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
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
