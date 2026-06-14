import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.PREVIEW_PORT || '4321';
const host = process.env.PREVIEW_HOST || '127.0.0.1';
const children = [];

function runOnce(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

function runDetached(command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  children.push(child);
  return child;
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});

async function main() {
  console.log('\n=== Preview com reload automatico ===\n');
  console.log('Build inicial...');
  await runOnce('node', ['scripts/sync-oya-card.mjs']);
  await runOnce('npm', ['run', 'build']);

  console.log(`\nAbre no browser: http://${host}:${port}/movimento-irun/cursos/`);
  console.log('Edita ficheiros em src/ — apos cada build o browser recarrega sozinho.');
  console.log('Parar: Ctrl+C\n');

  runDetached('npx', [
    'browser-sync',
    'start',
    '--server',
    'dist',
    '--files',
    'dist/**/*',
    '--port',
    port,
    '--no-open',
    '--host',
    host,
    '--reload-delay',
    '400',
  ]);

  await new Promise((resolve) => setTimeout(resolve, 2000));

  runDetached('npx', ['astro', 'build', '--watch']);
}

main().catch((error) => {
  console.error(error.message);
  shutdown();
  process.exit(1);
});
