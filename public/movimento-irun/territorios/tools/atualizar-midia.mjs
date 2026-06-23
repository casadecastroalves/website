/*
 * atualizar-midia.mjs — Movimento Irun · Mapa Identidade e Território
 * --------------------------------------------------------------------
 * Varre as pastas de cada ficha em /assets e gera data/midia.json com a
 * lista de fotos e PDFs encontrados. O mapa lê esse ficheiro e mostra as
 * galerias e documentos automaticamente — SEM mexer no código.
 *
 * COMO USAR (a partir da pasta territorios/):
 *   node tools/atualizar-midia.mjs
 *
 * Estrutura esperada (exemplo):
 *   assets/tenonde/fotos/foto-01.jpg
 *   assets/tenonde/pdf/cartilha.pdf
 *
 * Basta largar ficheiros nas pastas e voltar a correr o comando.
 */
import { readdirSync, statSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const assetsDir = join(root, "assets");
const outFile = join(root, "data", "midia.json");

const IMG = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"]);
const PDF = new Set([".pdf"]);

function listFiles(dir, exts) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => !f.startsWith(".") && !/^leia[- ]?me/i.test(f))
    .filter((f) => exts.has(extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, "pt", { numeric: true, sensitivity: "base" }));
}

function tituloFrom(file) {
  return basename(file, extname(file))
    .replace(/[-_+]+/g, " ")
    .replace(/\s*,\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

if (!existsSync(assetsDir)) {
  console.error("Pasta /assets não encontrada. Corra o comando na pasta territorios/.");
  process.exit(1);
}

const midia = {};
let totalFotos = 0;
let totalPdfs = 0;

for (const id of readdirSync(assetsDir).sort()) {
  const dir = join(assetsDir, id);
  if (!statSync(dir).isDirectory()) continue;

  const fotos = listFiles(join(dir, "fotos"), IMG).map((f) => ({
    src: `assets/${id}/fotos/${f}`,
    legenda: "",
  }));
  const pdfs = listFiles(join(dir, "pdf"), PDF).map((f) => ({
    src: `assets/${id}/pdf/${f}`,
    titulo: tituloFrom(f),
  }));

  if (fotos.length || pdfs.length) {
    midia[id] = { fotos, pdfs };
    totalFotos += fotos.length;
    totalPdfs += pdfs.length;
  }
}

writeFileSync(outFile, JSON.stringify(midia, null, 2) + "\n", "utf8");
console.log(`✓ data/midia.json atualizado`);
console.log(`  ${Object.keys(midia).length} fichas com mídia · ${totalFotos} fotos · ${totalPdfs} PDFs`);
for (const [id, m] of Object.entries(midia)) {
  console.log(`  · ${id}: ${m.fotos.length} fotos, ${m.pdfs.length} pdf`);
}
