import { spawn } from 'node:child_process';

const args = process.argv.slice(2);
const blocked = args[0] === 'dev' || args[0] === 'preview';

if (blocked) {
  console.error('\n========================================');
  console.error('  astro dev / preview NAO funciona aqui');
  console.error('  (projecto no Google Drive)');
  console.error('========================================');
  console.error('\n  Duplo-clique: ver-site-live.bat');
  console.error('  Ou no terminal: npm run live\n');
  process.exit(1);
}

const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['astro', ...args], {
  stdio: 'inherit',
  shell: false,
});

child.on('exit', (code) => process.exit(code ?? 0));
