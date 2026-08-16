import { spawnSync } from 'node:child_process';

const target = String(process.env.RQS_BUILD_TARGET || 'production').trim().toLowerCase();
const allowedTargets = new Set(['production', 'staging']);

if (!allowedTargets.has(target)) {
  console.error(`Invalid RQS_BUILD_TARGET: ${target}`);
  console.error('Allowed values: production, staging');
  process.exit(2);
}

const ngCommand = process.platform === 'win32' ? 'ng.cmd' : 'ng';
const extraArgs = process.argv.slice(2);
const args = ['build', '--configuration', target, ...extraArgs];

console.log(`RQS_BUILD_TARGET: ${target}`);
console.log(`RQS_BUILD_COMMAND: ng ${args.join(' ')}`);

const result = spawnSync(ngCommand, args, {
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
