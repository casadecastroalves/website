export function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

export function escAttr(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function slugify(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Texto normalizado para busca (sem acentos, minúsculas). */
export function searchNorm(s) {
  return slugify(s).replace(/-/g, " ").trim();
}

function editDistance(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const row = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = i - 1;
    row[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = row[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + cost);
      prev = tmp;
    }
  }
  return row[n];
}

/** Busca tolerante a erros de escrita e palavras parciais. */
export function matchSearch(haystack, query) {
  const q = searchNorm(query);
  if (!q) return true;
  const hay = searchNorm(haystack);
  const compact = hay.replace(/\s+/g, "");
  const qCompact = q.replace(/\s+/g, "");
  if (compact.includes(qCompact) || hay.includes(q)) return true;

  const qTokens = q.split(/\s+/).filter((t) => t.length >= 2);
  if (!qTokens.length) return hay.includes(q);

  const hTokens = hay.split(/\s+/).filter(Boolean);
  return qTokens.every((qt) => {
    if (hay.includes(qt)) return true;
    return hTokens.some((ht) => {
      if (ht.startsWith(qt) || ht.includes(qt)) return true;
      if (qt.length < 4 || ht.length < 3) return false;
      const maxDist = qt.length <= 5 ? 1 : 2;
      return editDistance(qt, ht.slice(0, qt.length + 1)) <= maxDist;
    });
  });
}

export async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Falha ao carregar ${url} (${res.status})`);
  return res.json();
}

export function debounce(fn, ms = 120) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
