#!/usr/bin/env node
/**
 * Audita todos os IDs YouTube em data/ e testa se permitem embed.
 * Uso: node tools/audit-youtube-embed.mjs
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "fs";
import { join, relative } from "path";

const ROOT = join(import.meta.dirname, "..", "data");
const YT_ID = /(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})|^[\w-]{11}$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    try {
      if (!statSync(p).isDirectory()) {
        if (/\.json$/i.test(name)) out.push(p);
      } else walk(p, out);
    } catch {
      /* ficheiro fantasma Drive */
    }
  }
  return out;
}

function collectFromJson(obj, file, hits) {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach((v) => collectFromJson(v, file, hits));
    return;
  }
  const tipo = obj.tipo;
  const id = obj.id;
  const isYoutube =
    tipo === "youtube" ||
    (obj.video?.tipo === "youtube" && obj.video?.id) ||
    (typeof id === "string" && /^[\w-]{11}$/.test(id) && (tipo === "youtube" || obj.video?.tipo === "youtube"));

  if (obj.video?.tipo === "youtube" && obj.video?.id) {
    addHit(hits, obj.video.id, file, obj.video.embed, obj.titulo || obj.video.legenda);
  } else if (tipo === "youtube" && typeof id === "string" && /^[\w-]{11}$/.test(id)) {
    addHit(hits, id, file, obj.embed, obj.titulo);
  }

  for (const v of Object.values(obj)) collectFromJson(v, file, hits);
}

function addHit(hits, id, file, embed, title) {
  const rel = relative(join(import.meta.dirname, ".."), file).replace(/\\/g, "/");
  if (!hits.has(id)) hits.set(id, { id, title: title || "", files: new Set(), embedFlags: new Set() });
  const h = hits.get(id);
  if (title && !h.title) h.title = title;
  h.files.add(rel);
  if (embed === false) h.embedFlags.add("false");
  if (embed === true) h.embedFlags.add("true");
  if (embed === undefined) h.embedFlags.add("unset");
}

async function checkEmbed(id) {
  try {
    const res = await fetch(`https://www.youtube.com/embed/${id}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MapaIrunAudit/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    const blocked = /unavailable|UNPLAYABLE|LOGIN_REQUIRED|embedding disabled|Playback on other websites/i.test(html);
    return blocked ? "blocked" : "ok";
  } catch (e) {
    return `error:${e.message?.slice(0, 40)}`;
  }
}

const hits = new Map();
for (const file of walk(ROOT)) {
  try {
    collectFromJson(JSON.parse(readFileSync(file, "utf8")), file, hits);
  } catch {
    /* skip invalid */
  }
}

const ids = [...hits.keys()].sort();
console.log(`A auditar ${ids.length} vídeos YouTube únicos...\n`);

const results = [];
for (const id of ids) {
  const meta = hits.get(id);
  const status = await checkEmbed(id);
  results.push({ ...meta, files: [...meta.files], status });
  const icon = status === "ok" ? "OK" : status === "blocked" ? "BLOQ" : "ERR";
  process.stdout.write(`${icon} ${id}  ${(meta.title || "").slice(0, 50)}\n`);
  await new Promise((r) => setTimeout(r, 200));
}

const blocked = results.filter((r) => r.status === "blocked");
const ok = results.filter((r) => r.status === "ok");

console.log(`\n--- Resumo ---`);
console.log(`Total: ${results.length}`);
console.log(`Embed OK: ${ok.length}`);
console.log(`Embed bloqueado: ${blocked.length}`);

const reportPath = join(import.meta.dirname, "audit-youtube-embed.json");
writeFileSync(reportPath, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
console.log(`\nRelatório: ${reportPath}`);

console.log(`\n--- Bloqueados (precisam embed:false) ---`);
for (const r of blocked) {
  console.log(`  ${r.id}  ${r.title}`);
  console.log(`    ficheiros: ${r.files.join(", ")}`);
}
