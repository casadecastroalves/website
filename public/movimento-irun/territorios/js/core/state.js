import { slugify } from "./util.js";

const listeners = new Set();

export const state = {
  config: null,
  manifest: null,
  territorios: [],
  fichas: [],
  fichaById: {},
  pontos: [],
  roteiros: [],
  rede: [],
  geo: null,
  selectedTiId: null,
  selectedFichaId: null,
  selectedMunicipio: null,
  filters: new Set(),
  filterPontoCultura: false,
  filterTeiaDosPovos: false,
  filterSomenteRoteiro: false,
  theme: "light",
  baseMode: "mapa",
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  listeners.forEach((fn) => fn(state));
}

export function tiById(id) {
  return state.territorios.find((t) => t.id === id) || null;
}

export function fichaById(id) {
  return state.fichaById[id] || null;
}

export function fichasDoTerritorio(tiId) {
  return state.fichas.filter((f) => f.territorioId === tiId);
}

export function fichasDoMunicipio(slug) {
  return state.fichas.filter((f) => slugify(f.meta?.municipio || "") === slug);
}

export function redeOrdenada() {
  return [...state.fichas.filter((f) => f.rede)].sort((a, b) => {
    const ca = Number(tiById(a.territorioId)?.cod || 99);
    const cb = Number(tiById(b.territorioId)?.cod || 99);
    return ca - cb;
  });
}

export function countRede() {
  return state.territorios.filter((t) => t.redeAtiva).length;
}

export function toggleFilter(key) {
  state.filterSomenteRoteiro = false;
  const next = new Set(state.filters);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  state.filters = next;
  notify();
}

export function clearAllFilters() {
  state.filters = new Set();
  state.filterPontoCultura = false;
  state.filterTeiaDosPovos = false;
  state.filterSomenteRoteiro = true;
  notify();
}

export function selectAllFilters() {
  state.filters = new Set(Object.keys(state.config?.categorias || {}));
  state.filterPontoCultura = true;
  state.filterTeiaDosPovos = true;
  state.filterSomenteRoteiro = false;
  notify();
}

export function togglePontoCulturaFilter() {
  state.filterSomenteRoteiro = false;
  state.filterPontoCultura = !state.filterPontoCultura;
  notify();
}

export function setPontoCulturaFilter(on) {
  if (on) state.filterSomenteRoteiro = false;
  state.filterPontoCultura = !!on;
  notify();
}

export function toggleTeiaDosPovosFilter() {
  state.filterSomenteRoteiro = false;
  state.filterTeiaDosPovos = !state.filterTeiaDosPovos;
  notify();
}

export function setTeiaDosPovosFilter(on) {
  if (on) state.filterSomenteRoteiro = false;
  state.filterTeiaDosPovos = !!on;
  notify();
}

export const TEIA_HUB_ID = "assentamento-terra-vista";

export function isTeiaDosPovos(ponto, ficha = null) {
  if (ponto?.teiaDosPovos) return true;
  const fid = ponto?.fichaId || ponto?.entidadeId;
  const f = ficha || (fid ? fichaById(fid) : null);
  return !!f?.teiaDosPovos;
}

function teiaPinRank(p, f) {
  if (p.popup?.slides?.length) return 0;
  if (f && slugify(p.nome) === slugify(f.meta?.nome || "")) return 1;
  if (p.categorias?.includes("quilombos")) return 2;
  if (p.categorias?.includes("instituicoes")) return 3;
  return 4;
}

function teiaItemFromPin(p, fid) {
  const f = fid ? fichaById(fid) : null;
  const ti = tiById(p.territorioId);
  return {
    pontoId: p.id,
    fichaId: fid,
    nome: f?.meta?.nome || p.nome,
    municipio: f?.meta?.municipio || "",
    tiId: p.territorioId,
    tiNome: ti?.nome || "",
  };
}

/** Lugares da nossa rede na Teia (uma entrada por entidade; exclui a sede Terra Vista). */
export function listTeiaDosPovos() {
  const items = [];
  const byEntity = new Map();

  for (const p of state.pontos) {
    if (!isTeiaDosPovos(p)) continue;
    const fid = p.fichaId || p.entidadeId || null;
    if (fid === TEIA_HUB_ID) continue;
    if (fid) {
      const f = fichaById(fid);
      const cur = byEntity.get(fid);
      if (!cur || teiaPinRank(p, f) < teiaPinRank(cur, f)) byEntity.set(fid, p);
      continue;
    }
    items.push(teiaItemFromPin(p, null));
  }

  for (const [fid, p] of byEntity) items.push(teiaItemFromPin(p, fid));

  for (const f of state.fichas) {
    if (!f.teiaDosPovos || f.id === TEIA_HUB_ID || !f.meta?.coords) continue;
    if (byEntity.has(f.id)) continue;
    const pin = state.pontos.find((p) => (p.fichaId || p.entidadeId) === f.id);
    if (pin) continue;
    const ti = tiById(f.territorioId);
    items.push({
      pontoId: null,
      fichaId: f.id,
      nome: f.meta?.nome || f.id,
      municipio: f.meta?.municipio || "",
      tiId: f.territorioId,
      tiNome: ti?.nome || "",
    });
  }

  return items.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

const TIPO_LABEL = {
  municipio: "Município",
  quilombo: "Quilombo",
  instituicao: "Instituição",
  projeto: "Projeto",
  comunidade: "Comunidade",
};

export function isPontoCultura(ponto, ficha = null) {
  if (ponto?.pontoCultura) return true;
  const fid = ponto?.fichaId || ponto?.entidadeId;
  const f = ficha || (fid ? fichaById(fid) : null);
  return !!f?.pontoCultura;
}

/** Lugares reconhecidos como Ponto de Cultura (pin ou ficha). */
export function listPontosCultura() {
  const items = [];
  const seen = new Set();

  for (const p of state.pontos) {
    if (!isPontoCultura(p)) continue;
    const fid = p.fichaId || p.entidadeId || null;
    const f = fid ? fichaById(fid) : null;
    const ti = tiById(p.territorioId);
    items.push({
      pontoId: p.id,
      fichaId: fid,
      nome: p.nome,
      municipio: f?.meta?.municipio || "",
      tiId: p.territorioId,
      tiNome: ti?.nome || "",
    });
    seen.add(p.id);
  }

  for (const f of state.fichas) {
    if (!f.pontoCultura || !f.meta?.coords) continue;
    const pin = state.pontos.find((p) => (p.fichaId || p.entidadeId) === f.id);
    if (pin && seen.has(pin.id)) continue;
    const ti = tiById(f.territorioId);
    items.push({
      pontoId: pin?.id || null,
      fichaId: f.id,
      nome: f.meta?.nome || f.id,
      municipio: f.meta?.municipio || "",
      tiId: f.territorioId,
      tiNome: ti?.nome || "",
    });
  }

  return items.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function tipoLabel(tipo) {
  return TIPO_LABEL[tipo] || tipo;
}

export function setSelected({ tiId = null, fichaId = null, municipio = null }) {
  state.selectedTiId = tiId;
  state.selectedFichaId = fichaId;
  state.selectedMunicipio = municipio;
  notify();
}
