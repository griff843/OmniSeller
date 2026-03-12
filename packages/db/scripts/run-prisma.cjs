const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const prismaArgs = process.argv.slice(2);
const envFiles = [
  path.join(repoRoot, '.env'),
  path.join(repoRoot, '.env.local'),
  path.join(packageRoot, '.env'),
  path.join(packageRoot, '.env.local'),
];

for (const envFile of envFiles) {
  if (!fs.existsSync(envFile)) {
    continue;
  }

  const raw = fs.readFileSync(envFile, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    if (!key || process.env[key] !== undefined) {
      continue;
    }

    let value = trimmed.slice(equalsIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function findListeningWindowsPorts(targetPorts) {
  try {
    const output = execSync('netstat -ano -p tcp', {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    const listeners = [];
    for (const line of output.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('TCP')) {
        continue;
      }

      const parts = trimmed.split(/\s+/);
      if (parts.length < 5) {
        continue;
      }

      const localAddress = parts[1];
      const state = parts[3];
      const pid = parts[4];

      if (state !== 'LISTENING') {
        continue;
      }

      const port = Number(localAddress.slice(localAddress.lastIndexOf(':') + 1));
      if (!targetPorts.has(port)) {
        continue;
      }

      listeners.push({ port, pid });
    }

    return listeners;
  } catch {
    return [];
  }
}

function enforceWindowsGenerateGuard() {
  if (process.platform !== 'win32') {
    return;
  }

  if (process.env.OMNISELLER_SKIP_PRISMA_DEV_GUARD === '1') {
    return;
  }

  if (prismaArgs[0] !== 'generate') {
    return;
  }

  const listeners = findListeningWindowsPorts(new Set([3000, 3001]));
  if (listeners.length === 0) {
    return;
  }

  const details = listeners.map((listener) => `port ${listener.port} (pid ${listener.pid})`).join(', ');

  console.error(
    [
      'Prisma generate was blocked because local dev processes are still listening on ' + details + '.',
      'On Windows, active Next.js/NestJS processes often keep Prisma engine DLL files locked and cause EPERM rename failures during client regeneration.',
      'Stop `pnpm dev` or the individual web/api dev processes, then rerun `pnpm db:generate`.',
      'If you intentionally need to bypass this guard, run PowerShell with `$env:OMNISELLER_SKIP_PRISMA_DEV_GUARD="1"; pnpm db:generate`.',
    ].join('\n'),
  );

  process.exit(1);
}

enforceWindowsGenerateGuard();

const prismaBin = path.join(packageRoot, 'node_modules', 'prisma', 'build', 'index.js');
const result = spawnSync(process.execPath, [prismaBin, ...prismaArgs], {
  cwd: packageRoot,
  stdio: 'inherit',
  env: process.env,
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 0);
