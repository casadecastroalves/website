#!/usr/bin/env node
/** Audita entradas repetidas no índice de busca (mesmo nome normalizado). */
import { readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { join } from "path";

const BASE = join(import.meta.dirname, "..");
const data = join(BASE, "data");

function slugify(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function readJson(p) {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

const manifest = readJson(join(data, "manifest.json"));
const territorios = readJson(join(data, "territorios.json"))?.territorios || [];
const tiById = Object.fromEntries(territorios.map((t) => [t.id, t]));

const fichas = (manifest.fichas || [])
  .map((id) => readJson(join(data, "fichas", `${id}.json`)))
  .filter(Boolean);
const fichaById = Object.fromEntries(fichas.map((f) => [f.id, f]));

const pontos = [];
for (const pf of manifest.pontos || []) {
  const j = readJson(join(data, "pontos", `${pf}.json`));
  if (!j?.pontos) continue;
  for (const p of j.pontos) pontos.push({ ...p, territorioId: p.territorioId || j.territorioId });
}

function pinMatchesFicha(p, f) {
  if (!f) return false;
  const a = slugify(p.nome);
  const b = slugify(f.meta?.nome);
  return a && b && (a === b || a.includes(b) || b.includes(a));
}

function isTeia(p) {
  if (p.teiaDosPovos) return true;
  const f = fichaById[p.fichaId || p.entidadeId];
  return !!f?.teiaDosPovos;
}

function isPc(p) {
  if (p.pontoCultura) return true;
  const f = fichaById[p.fichaId || p.entidadeId];
  return !!f?.pontoCultura;
}

const index = [];
const fichaIndexed = new Set();

for (const f of fichas) {
  if (f.stub) continue;
  fichaIndexed.add(f.id);
  const tags = [f.tipo];
  if (f.pontoCultura) tags.push("PC");
  if (f.teiaDosPovos) tags.push("Teia");
  index.push({ source: `ficha:${f.id}`, name: f.meta?.nome, tags: tags.join("+") });
}

for (const p of pontos) {
  const fid = p.fichaId || p.entidadeId;
  const f = fid ? fichaById[fid] : null;
  if (fid && fichaIndexed.has(fid) && pinMatchesFicha(p, f)) continue;
  const tags = [(p.categorias || [])[0] || "lugar"];
  if (isPc(p)) tags.push("PC");
  if (isTeia(p)) tags.push("Teia");
  index.push({ source: `ponto:${p.id}`, name: p.nome, tags: tags.join("+") });
}

const byName = new Map();
for (const item of index) {
  const key = slugify(item.name);
  if (!byName.has(key)) byName.set(key, []);
  byName.get(key).push(item);
}

const dupes = [...byName.entries()]
  .filter(([, items]) => items.length > 1)
  .map(([key, items]) => ({ name: items[0].name, key, count: items.length, entries: items }))
  .sort((a, b) => b.count - a.count);

const report = {
  at: new Date().toISOString(),
  totalIndex: index.length,
  duplicateGroups: dupes.length,
  duplicates: dupes,
};

const out = join(import.meta.dirname, "audit-search-duplicates.json");
writeFileSync(out, JSON.stringify(report, null, 2) + "\n", "utf8");

console.log(`Índice: ${index.length} entradas`);
console.log(`Grupos repetidos: ${dupes.length}`);
if (dupes.length) {
  console.log("\nRepetidos:");
  for (const d of dupes) {
    console.log(`  ${d.name} (${d.count}x)`);
    for (const e of d.entries) console.log(`    - ${e.source} [${e.tags}]`);
  }
} else {
  console.log("Nenhuma repetição por nome.");
}

// Test queries
const queries = ["teno", "tenonde", "guine barriguda", "lagoa", "terere", "saubara", "caxute", "museu"];
console.log("\n--- Simulação de busca ---");
for (const q of queries) {
  const n = slugify(q).replace(/-/g, "");
  const hits = index.filter((i) => slugify(i.name).includes(n) || slugify(`${i.name} ${i.tags}`).includes(n));
  console.log(`"${q}": ${hits.length} → ${hits.map((h) => h.name).join(" | ") || "(nenhum)"}`);
}

console.log(`\nRelatório: ${out}`);
