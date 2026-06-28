#!/usr/bin/env node
/** Marca embed:false em todos os vídeos YouTube em data/fichas e data/pontos. */
import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const BASE = join(import.meta.dirname, "..", "data");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    try {
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.json$/i.test(name)) out.push(p);
    } catch { /* skip */ }
  }
  return out;
}

function patch(obj) {
  let n = 0;
  if (!obj || typeof obj !== "object") return n;
  if (Array.isArray(obj)) {
    for (const v of obj) n += patch(v);
    return n;
  }
  if (obj.tipo === "youtube" && obj.id && /^[\w-]{11}$/.test(obj.id)) {
    if (obj.embed !== true) {
      obj.embed = false;
      n++;
    }
  }
  if (obj.video?.tipo === "youtube" && obj.video?.id) {
    if (obj.video.embed !== true) {
      obj.video.embed = false;
      n++;
    }
  }
  for (const v of Object.values(obj)) n += patch(v);
  return n;
}

let total = 0;
for (const dir of ["fichas", "pontos"]) {
  for (const file of walk(join(BASE, dir))) {
    const raw = readFileSync(file, "utf8");
    const data = JSON.parse(raw);
    const n = patch(data);
    if (n) {
      writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
      console.log(`${n}  ${file.replace(/\\/g, "/").split("data/")[1]}`);
      total += n;
    }
  }
}
console.log(`\nTotal: ${total} vídeos marcados embed:false`);
