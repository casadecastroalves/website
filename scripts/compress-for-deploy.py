#!/usr/bin/env python3
"""Comprime ficheiros grandes numa pasta de deploy (nao altera a fonte se forem pastas distintas).

Uso:
  python tools/compress-for-deploy.py "C:\\path\\to\\public\\movimento-irun\\territorios"
  python tools/compress-for-deploy.py --dry-run .

Limite Cloudflare Pages: 25 MB por ficheiro. Margem por defeito: 24 MB.
Ignora pastas chamadas 'original' ou 'originais' (guardar masters ai).
"""
from __future__ import annotations

import argparse
import os
import shutil
import sys
import tempfile
from pathlib import Path

LIMIT_MB = 24.0
SKIP_DIRS = {"original", "originais", "node_modules", ".git"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}
PDF_EXT = {".pdf"}


def mb(size: int) -> float:
    return size / (1024 * 1024)


def should_skip(path: Path) -> bool:
    return any(part.lower() in SKIP_DIRS for part in path.parts)


def compress_pdf(path: Path, limit_bytes: int) -> bool:
    try:
        import fitz  # pymupdf
    except ImportError:
        print(f"  ! pymupdf nao instalado — pip install pymupdf", file=sys.stderr)
        return False

    for quality in (75, 60, 50, 40):
        tmp = path.with_suffix(path.suffix + ".tmp")
        doc = fitz.open(path)
        for i in range(len(doc)):
            for img in doc.get_page_images(i):
                xref = img[0]
                try:
                    pix = fitz.Pixmap(doc, xref)
                    if pix.n >= 4:
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    doc.update_stream(xref, pix.tobytes("jpeg", jpg_quality=quality))
                except Exception:
                    pass
        doc.save(tmp, garbage=4, deflate=True, clean=True)
        doc.close()
        if tmp.stat().st_size <= limit_bytes:
            tmp.replace(path)
            return True
        tmp.unlink(missing_ok=True)
    return path.stat().st_size <= limit_bytes


def compress_image(path: Path, limit_bytes: int) -> bool:
    try:
        from PIL import Image
    except ImportError:
        print(f"  ! Pillow nao instalado — pip install Pillow", file=sys.stderr)
        return False

    img = Image.open(path)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    for quality in (85, 75, 65, 55, 45):
        for scale in (1.0, 0.85, 0.7, 0.55):
            w, h = img.size
            resized = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
            fd, tmp_name = tempfile.mkstemp(suffix=path.suffix)
            os.close(fd)
            tmp = Path(tmp_name)
            try:
                save_kw = {"optimize": True}
                ext = path.suffix.lower()
                if ext in (".jpg", ".jpeg"):
                    save_kw["quality"] = quality
                    resized.save(tmp, "JPEG", **save_kw)
                elif ext == ".webp":
                    save_kw["quality"] = quality
                    resized.save(tmp, "WEBP", **save_kw)
                else:
                    resized.save(tmp, "PNG", optimize=True)
                if tmp.stat().st_size <= limit_bytes:
                    shutil.copy2(tmp, path)
                    return True
            finally:
                tmp.unlink(missing_ok=True)
    return path.stat().st_size <= limit_bytes


def process(root: Path, limit_bytes: int, dry_run: bool) -> int:
    failures: list[str] = []
    compressed: list[str] = []

    for path in sorted(root.rglob("*")):
        if not path.is_file() or should_skip(path):
            continue
        size = path.stat().st_size
        if size <= limit_bytes:
            continue

        rel = path.relative_to(root)
        print(f"> {rel} — {mb(size):.2f} MB (limite {mb(limit_bytes):.2f} MB)")
        if dry_run:
            continue

        ext = path.suffix.lower()
        ok = False
        if ext in PDF_EXT:
            ok = compress_pdf(path, limit_bytes)
        elif ext in IMAGE_EXT:
            ok = compress_image(path, limit_bytes)
        else:
            failures.append(f"{rel} — tipo {ext} nao comprimivel automaticamente")
            continue

        new_size = path.stat().st_size
        if ok:
            print(f"  OK: {mb(new_size):.2f} MB")
            compressed.append(str(rel))
        else:
            failures.append(f"{rel} — ainda {mb(new_size):.2f} MB apos compressao")

    if compressed:
        print(f"\nComprimidos: {len(compressed)}")
    if failures:
        print("\nFALHA — ficheiros ainda acima do limite ou nao suportados:", file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        return 1
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Comprime assets para deploy Cloudflare (<25 MB)")
    parser.add_argument("root", type=Path, nargs="?", default=Path("."))
    parser.add_argument("--limit-mb", type=float, default=LIMIT_MB)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    root = args.root.resolve()
    if not root.is_dir():
        print(f"Pasta nao encontrada: {root}", file=sys.stderr)
        return 1
    limit = int(args.limit_mb * 1024 * 1024)
    print(f"Scan: {root} (limite {args.limit_mb} MB)\n")
    return process(root, limit, args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
