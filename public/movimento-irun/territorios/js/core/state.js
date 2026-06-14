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
  const next = new Set(state.filters);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  state.filters = next;
  notify();
}

export function setSelected({ tiId = null, fichaId = null, municipio = null }) {
  state.selectedTiId = tiId;
  state.selectedFichaId = fichaId;
  state.selectedMunicipio = municipio;
  notify();
}
