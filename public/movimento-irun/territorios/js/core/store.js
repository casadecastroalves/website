import { state } from "./state.js";
import { fetchJSON } from "./util.js";

export async function loadAll() {
  const config = await fetchJSON("data/config.json");
  state.config = config;
  state.baseMode = config.map?.baseDefault || "mapa";

  const [territoriosData, manifest, geo, midia] = await Promise.all([
    fetchJSON("data/territorios.json"),
    fetchJSON("data/manifest.json"),
    fetchJSON(config.geo.territorios),
    fetchJSON("data/midia.json").catch(() => ({})),
  ]);

  state.manifest = manifest;
  state.territorios = territoriosData.territorios;
  state.geo = geo;
  state.roteiros = manifest.roteiros || [];
  state.rede = manifest.rede || [];

  const fichas = await Promise.all(
    (manifest.fichas || []).map((id) => fetchJSON(`data/fichas/${id}.json`).catch(() => null))
  );
  state.fichas = fichas.filter(Boolean);
  state.fichaById = Object.fromEntries(state.fichas.map((f) => [f.id, f]));

  const pontosFiles = await Promise.all(
    (manifest.pontos || []).map((id) => fetchJSON(`data/pontos/${id}.json`).catch(() => null))
  );
  const pins = [];
  for (const pf of pontosFiles) {
    if (!pf) continue;
    for (const p of pf.pontos || []) {
      pins.push({ ...p, territorioId: p.territorioId || pf.territorioId });
    }
  }
  state.pontos = pins;

  /* Mapa vazio por defeito — utilizador escolhe na legenda (Todos / categorias). */
  state.filters = new Set();
  state.filterPontoCultura = false;
  state.filterTeiaDosPovos = false;
  state.filterSomenteRoteiro = true;

  mergeMidia(midia);
  markRede();
  return state;
}

/* Funde data/midia.json (gerado por tools/atualizar-midia.mjs) nas fichas.
   As fotos/legendas escritas à mão na ficha têm prioridade; as descobertas
   no /assets são acrescentadas sem duplicar. PDFs vêm da pasta /pdf. */
function mergeMidia(midia) {
  if (!midia) return;
  state.fichas.forEach((f) => {
    const m = midia[f.id];
    if (!m) return;
    f.sidebar = f.sidebar || {};
    const manual = f.sidebar.fotos || [];
    const seen = new Set(manual.map((p) => (typeof p === "string" ? p : p.src)));
    const extra = (m.fotos || []).filter((p) => !seen.has(p.src));
    f.sidebar.fotos = [...manual, ...extra];
    if (m.pdfs?.length) f.sidebar.documentos = m.pdfs;
  });
}

function markRede() {
  const redeTis = new Set(state.config.rede?.territorios || []);
  state.fichas.forEach((f) => redeTis.add(f.territorioId));
  state.pontos.forEach((p) => {
    if (p.entidadeId || p.fichaId) redeTis.add(p.territorioId);
  });
  state.territorios.forEach((t) => {
    t.redeAtiva = redeTis.has(t.id);
  });
}
