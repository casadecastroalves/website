import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'ver-site-live.mjs');

spawn(process.execPath, [script], { stdio: 'inherit' }).on('exit', (code) => {
  process.exit(code ?? 0);
});
