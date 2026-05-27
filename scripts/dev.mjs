import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

function start(name, command) {
  const child = spawn(command, { cwd: root, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout?.on('data', (chunk) => process.stdout.write(prefix(name, chunk)));
  child.stderr?.on('data', (chunk) => process.stderr.write(prefix(name, chunk)));
  return child;
}

function prefix(name, chunk) {
  return String(chunk).split(/(?<=\n)/).map((line) => line ? `[${name}] ${line}` : line).join('');
}

const processes = [
  start('backend', 'pnpm --filter @sessionless/backend dev'),
  start('frontend', 'pnpm --filter @sessionless/frontend dev'),
];

let shuttingDown = false;

for (const child of processes) {
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const proc of processes) {
      if (proc.pid && proc.exitCode == null) proc.kill();
    }
    if (code && code !== 0) process.exitCode = code;
    if (signal) process.exitCode = 1;
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    shuttingDown = true;
    for (const child of processes) child.kill(signal);
  });
}
