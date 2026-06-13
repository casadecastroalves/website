import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(
  root,
  '..',
  '..',
  'MOVIMENTO IRUN',
  'OYAS 2 DEZEMBRO',
  '2 DE DEZEMBRO MOVIMENTO IRUN',
  '4.png'
);
const assetFallback = path.join(
  'C:',
  'Users',
  'inesg',
  '.cursor',
  'projects',
  'g-Meu-Drive-9-CASA-DE-CASTRO-ALVES-WEBSITE-website',
  'assets',
  'c__Users_inesg_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_4-ade58a65-11fc-415f-a063-2c7ce439fa85.png'
);

const targetName = 'confraria-de-oya-card-v4.png';
const targets = [
  path.join(root, 'public', 'images', 'edicoes', 'confraria-de-oya', targetName),
  path.join(root, 'dist', 'images', 'edicoes', 'confraria-de-oya', targetName),
];

const input = fs.existsSync(source) ? source : assetFallback;
if (!fs.existsSync(input)) {
  console.error('Source image not found:', source);
  process.exit(1);
}

for (const target of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(input, target);
  console.log('copied ->', target, fs.statSync(target).size);
}
