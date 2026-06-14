import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../src/pages/movimento-irun/index.astro', import.meta.url);
let content = readFileSync(path, 'utf8');
const layoutIdx = content.indexOf('<Layout title');
if (layoutIdx < 0) throw new Error('Layout not found');

const match = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
if (!match) throw new Error('Frontmatter not found');

writeFileSync(path, match[0] + content.slice(layoutIdx));
console.log('Fixed duplicate frontmatter in movimento-irun/index.astro');
