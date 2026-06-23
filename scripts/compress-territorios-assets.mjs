/**
 * Rede de seguranca no build Cloudflare Pages:
 * - comprime imagens >24 MB (sharp)
 * - falha o build se algum PDF/outro ficheiro >25 MB (limite Cloudflare)
 *
 * Os originais grandes ficam em territorios/**/originais/; o deploy comprime antes do push.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..", "public", "movimento-irun", "territorios");
const LIMIT = 24 * 1024 * 1024;
const HARD_LIMIT = 25 * 1024 * 1024;
const SKIP = new Set(["original", "originais", "node_modules", ".git"]);
const IMAGE = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (SKIP.has(name.toLowerCase())) continue;
      walk(p, out);
    } else {
      out.push({ p, size: st.size });
    }
  }
  return out;
}

async function compressImage(filePath, sharp) {
  const ext = path.extname(filePath).toLowerCase();
  const buf = fs.readFileSync(filePath);
  let img = sharp(buf);
  const meta = await img.metadata();
  for (const quality of [85, 75, 65, 55]) {
    for (const scale of [1, 0.85, 0.7, 0.55]) {
      let pipeline = sharp(buf);
      if (scale < 1 && meta.width && meta.height) {
        pipeline = pipeline.resize(Math.round(meta.width * scale), Math.round(meta.height * scale), { fit: "inside" });
      }
      const out =
        ext === ".png"
          ? await pipeline.png({ compressionLevel: 9, effort: 10 }).toBuffer()
          : await pipeline.jpeg({ quality, mozjpeg: true }).toBuffer();
      if (out.length <= LIMIT) {
        fs.writeFileSync(filePath, out);
        return out.length;
      }
    }
  }
  return fs.statSync(filePath).size;
}

async function main() {
  const files = walk(ROOT);
  const big = files.filter((f) => f.size > LIMIT);
  if (!big.length) {
    console.log("compress-territorios: nenhum ficheiro >24 MB");
    return;
  }

  let sharp;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    sharp = null;
  }

  const failures = [];
  for (const { p, size } of big) {
    const rel = path.relative(ROOT, p);
    const ext = path.extname(p).toLowerCase();
    console.log(`> ${rel} — ${(size / 1024 / 1024).toFixed(2)} MB`);

    if (IMAGE.has(ext) && sharp) {
      const newSize = await compressImage(p, sharp);
      console.log(`  imagem: ${(newSize / 1024 / 1024).toFixed(2)} MB`);
      if (newSize > HARD_LIMIT) failures.push(rel);
    } else if (ext === ".pdf") {
      failures.push(`${rel} (PDF — comprimir: python public/movimento-irun/territorios/tools/compress-for-deploy.py)`);
    } else {
      failures.push(`${rel} (tipo nao suportado no build)`);
    }
  }

  if (failures.length) {
    console.error("\nBuild bloqueado — ficheiros acima do limite Cloudflare (25 MB):");
    failures.forEach((f) => console.error(`  - ${f}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
