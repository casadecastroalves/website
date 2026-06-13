import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const port = process.env.PREVIEW_PORT || '4321';
const host = process.env.PREVIEW_HOST || '127.0.0.1';

const previewPages = [
  { label: 'Home', path: '/' },
  { label: 'Edições', path: '/movimento-irun/edicoes/' },
  { label: '1ª Edição', path: '/movimento-irun/edicao-1/' },
  { label: 'Confraria de Oyá', path: '/movimento-irun/confraria-de-oya/' },
  { label: '6ª Edição', path: '/movimento-irun/edicao-6/' },
];

function run(command, args) {
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

function distIsReady() {
  return fs.existsSync(path.join(distDir, 'index.html'));
}

async function main() {
  const forceBuild = process.argv.includes('--build');

  if (forceBuild || !distIsReady()) {
    console.log('\nA construir o site para visualização...\n');
    await run('node', ['scripts/sync-oya-card.mjs']);
    await run('npm', ['run', 'build']);
  } else {
    console.log('\nA usar build existente em dist/. Para reconstruir: npm run view:build\n');
    await run('node', ['scripts/sync-oya-card.mjs']);
  }

  console.log(`Visualizador: http://${host}:${port}\n`);
  console.log('Páginas úteis para rever agora:');
  for (const page of previewPages) {
    console.log(`  http://${host}:${port}${page.path}  — ${page.label}`);
  }
  console.log('\nParar o visualizador: Ctrl+C\n');

  const preview = spawn(
    'npx',
    ['astro', 'preview', '--host', host, '--port', port],
    {
      cwd: root,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    }
  );

  preview.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
