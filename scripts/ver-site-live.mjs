import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const previewRoot = path.join(os.homedir(), 'AppData', 'Local', 'cca-website-preview');
const workDir = path.join(previewRoot, 'workspace');
const distDir = path.join(workDir, 'dist');
const port = '4321';
const host = '127.0.0.1';
const baseUrl = `http://${host}:${port}`;
const children = [];
let rebuildTimer;

const SYNC_ITEMS = ['src', 'public', 'scripts', 'astro.config.mjs', 'package.json'];

function killPort(targetPort) {
  if (process.platform !== 'win32') return;
  try {
    const output = execSync(`netstat -ano | findstr :${targetPort}`, { encoding: 'utf8' });
    for (const line of output.split('\n')) {
      if (!line.includes('LISTENING')) continue;
      const pid = line.trim().split(/\s+/).pop();
      if (!pid || pid === '0') continue;
      try {
        execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* port free */
  }
}

function robocopy(source, destination) {
  fs.mkdirSync(destination, { recursive: true });
  try {
    execSync(`robocopy "${source}" "${destination}" /MIR /NFL /NDL /NJH /NJS /NC /NS /NP`, {
      stdio: 'ignore',
    });
  } catch (error) {
    const code = error.status ?? error.code;
    if (typeof code === 'number' && code <= 7) return;
    throw error;
  }
}

function syncProject() {
  fs.mkdirSync(workDir, { recursive: true });

  for (const item of SYNC_ITEMS) {
    const source = path.join(root, item);
    const destination = path.join(workDir, item);

    if (!fs.existsSync(source)) continue;

    if (fs.statSync(source).isDirectory()) {
      robocopy(source, destination);
    } else {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
    }
  }

  const nodeModulesLink = path.join(workDir, 'node_modules');
  const nodeModulesSource = path.join(root, 'node_modules');

  if (!fs.existsSync(nodeModulesLink) && fs.existsSync(nodeModulesSource)) {
    execSync(`cmd /c mklink /J "${nodeModulesLink}" "${nodeModulesSource}"`, { stdio: 'ignore' });
  }
}

function runOnce(command, args, cwd = workDir) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
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

function runBackground(command, args, cwd = workDir) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  children.push(child);
  return child;
}

function waitForSite(url, maxAttempts = 120) {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const tryRequest = () => {
      http
        .get(url, (response) => {
          response.resume();
          if (response.statusCode === 200) {
            resolve();
            return;
          }
          retry();
        })
        .on('error', retry);
    };

    const retry = () => {
      attempts += 1;
      if (attempts >= maxAttempts) {
        reject(new Error('Servidor nao respondeu a tempo.'));
        return;
      }
      setTimeout(tryRequest, 1000);
    };

    tryRequest();
  });
}

function openBrowser(targetUrl) {
  if (process.platform === 'win32') {
    spawn('cmd', ['/c', 'start', '', targetUrl], { detached: true, stdio: 'ignore' });
  }
}

function shutdown() {
  for (const child of children) {
    try {
      child.kill('SIGTERM');
    } catch {
      /* ignore */
    }
  }
}

function scheduleRebuild() {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(async () => {
    try {
      console.log('\nAlteracoes detetadas — a reconstruir...\n');
      syncProject();
      await runOnce('node', ['scripts/build-search-index.mjs']);
      await runOnce('npx', ['astro', 'build']);
      console.log('Rebuild concluido.\n');
    } catch (error) {
      console.error(`Rebuild falhou: ${error.message}\n`);
    }
  }, 900);
}

function startWatcher() {
  for (const folder of ['src', 'public']) {
    const watchPath = path.join(root, folder);
    if (!fs.existsSync(watchPath)) continue;
    fs.watch(watchPath, { recursive: true }, scheduleRebuild);
  }
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});

async function main() {
  console.log('\n=== Casa de Castro Alves — Preview local ===\n');
  console.log('Motivo: Google Drive nao suporta astro dev/build directo.');
  console.log('Solucao: copia rapida para disco local + servidor estavel.\n');

  console.log('1/5 A libertar porta 4321...');
  killPort(port);

  console.log('2/5 A sincronizar projecto para disco local...');
  console.log(`    ${workDir}\n`);
  syncProject();

  console.log('3/5 A construir site...');
  await runOnce('node', ['scripts/build-search-index.mjs']);
  await runOnce('npx', ['astro', 'build']);

  console.log('\n4/5 A iniciar servidor...');
  runBackground('npx', [
    'browser-sync',
    'start',
    '--server',
    distDir,
    '--port',
    port,
    '--host',
    host,
    '--files',
    `${distDir}/**/*`,
    '--no-open',
    '--reload-delay',
    '400',
  ]);

  console.log('5/5 A aguardar resposta...');
  await waitForSite(`${baseUrl}/a-casa/`);

  startWatcher();

  console.log('\n============================================');
  console.log(`  PRONTO: ${baseUrl}/`);
  console.log(`  A Casa:  ${baseUrl}/a-casa/`);
  console.log('  Edita ficheiros em src/ — rebuild automatico');
  console.log('  Parar: Ctrl+C');
  console.log('============================================\n');

  openBrowser(`${baseUrl}/a-casa/`);
}

main().catch((error) => {
  console.error(`\nErro: ${error.message}\n`);
  shutdown();
  process.exit(1);
});
