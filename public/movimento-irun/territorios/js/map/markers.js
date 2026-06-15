import { state } from "../core/state.js";
import { getMap } from "./map.js";
import { popupHtml, popupOptions, initRichPopup } from "./popup.js";

const TIPO_CAT = {
  quilombo: "quilombos", assentamento: "quilombos", comunidade: "quilombos",
  municipio: "municipios", instituicao: "instituicoes", projeto: "projetos",
};

let group = null;
const markerByFichaId = {};
const markerByPontoId = {};
let onFichaOpen = null;

function categorias() {
  return state.config.categorias || {};
}

function catOf(entry) {
  const cats = entry.categorias || [];
  const known = cats.find((c) => categorias()[c]);
  return known || cats[0] || "quilombos";
}

function colorOf(entry) {
  return categorias()[catOf(entry)]?.cor || "#f5c518";
}

function icon(color, active) {
  return L.divIcon({
    className: "irun-pin",
    html: `<span class="irun-marker${active ? " active" : ""}" style="background:${color}"></span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 34],
    popupAnchor: [0, -30],
  });
}

function matchesFilters(cats = []) {
  if (!state.filters.size) return true;
  return cats.some((c) => state.filters.has(c));
}

function fichaIdOf(entry) {
  return entry.fichaId || entry.entidadeId || null;
}

function buildEntries() {
  const entries = state.pontos.map((p) => ({ ...p }));
  const referenced = new Set(entries.map(fichaIdOf).filter(Boolean));

  for (const f of state.fichas) {
    const coords = f.meta?.coords;
    if (!coords || referenced.has(f.id)) continue;
    entries.push({
      id: f.id,
      nome: f.meta?.nome || f.id,
      coords,
      categorias: [TIPO_CAT[f.tipo] || "quilombos"],
      fichaId: f.id,
      territorioId: f.territorioId,
      resumo: f.sidebar?.apresentacao?.slice(0, 140),
    });
  }
  return spreadOverlaps(entries);
}

/* Agrupa marcadores próximos (por distância, não por arredondamento) e
   abre-os em leque, para serem visíveis e tocáveis sem zoom extremo. */
function spreadOverlaps(entries) {
  const THRESHOLD = 0.0009; // ~100 m: marcadores mais perto que isto são agrupados
  const RADIUS = 0.0012;    // ~130 m: raio do leque
  const groups = [];
  for (const e of entries) {
    if (!Array.isArray(e.coords)) continue;
    const g = groups.find(
      (grp) =>
        Math.abs(e.coords[0] - grp.center[0]) < THRESHOLD &&
        Math.abs(e.coords[1] - grp.center[1]) < THRESHOLD
    );
    if (g) g.items.push(e);
    else groups.push({ center: [e.coords[0], e.coords[1]], items: [e] });
  }
  for (const g of groups) {
    if (g.items.length < 2) continue;
    g.items.forEach((e, i) => {
      const a = (2 * Math.PI * i) / g.items.length - Math.PI / 2;
      e.coords = [g.center[0] + RADIUS * Math.cos(a), g.center[1] + RADIUS * Math.sin(a)];
    });
  }
  return entries;
}

export function buildMarkers(handlers = {}) {
  onFichaOpen = handlers.onFichaOpen;
  const map = getMap();
  if (group) map.removeLayer(group);
  group = L.layerGroup().addTo(map);
  Object.keys(markerByFichaId).forEach((k) => delete markerByFichaId[k]);
  Object.keys(markerByPontoId).forEach((k) => delete markerByPontoId[k]);

  for (const entry of buildEntries()) {
    if (!Array.isArray(entry.coords)) continue;
    const marker = L.marker(entry.coords, { icon: icon(colorOf(entry), false), keyboard: false });
    marker._cats = entry.categorias || [];
    marker._fichaId = fichaIdOf(entry);
    marker._color = colorOf(entry);
    marker.bindPopup(popupHtml(entry), popupOptions(entry));
    marker.addTo(group);
    if (marker._fichaId) markerByFichaId[marker._fichaId] = marker;
    if (entry.id) markerByPontoId[entry.id] = marker;
  }

  map.on("popupopen", (e) => initRichPopup(e.popup.getElement()));
  refreshVisibility();
}

export function refreshVisibility() {
  if (!group) return;
  group.eachLayer((m) => {
    const visible = matchesFilters(m._cats);
    const el = m.getElement?.();
    if (el) {
      el.style.display = visible ? "" : "none";
      el.style.pointerEvents = visible ? "" : "none";
    }
  });
}

export function setSelectedFicha(fichaId) {
  Object.entries(markerByFichaId).forEach(([id, m]) => {
    m.setIcon(icon(m._color, id === fichaId));
  });
}

export function focusPonto(pontoId) {
  const m = markerByPontoId[pontoId];
  if (!m) return;
  const map = getMap();
  map.setView(m.getLatLng(), Math.max(map.getZoom(), 13), { animate: true });
  setTimeout(() => m.openPopup(), 280);
}

export function focusFicha(ficha) {
  const map = getMap();
  const coords = ficha?.meta?.coords;
  if (!coords) return;
  map.setView(coords, Math.max(map.getZoom(), 12), { animate: true });
  const m = markerByFichaId[ficha.id];
  if (m) setTimeout(() => m.openPopup(), 250);
}

export function buildLegend(container) {
  if (!container) return;
  const cats = categorias();
  const items = Object.entries(cats)
    .map(([k, v]) => `<div class="legend-item"><span class="legend-dot" style="background:${v.cor}"></span>${v.label}</div>`)
    .join("");
  container.innerHTML = `
    <div class="legend-head" role="button" tabindex="0">Legenda <span class="legend-toggle">▾</span></div>
    <div class="legend-items">${items}</div>`;
  const head = container.querySelector(".legend-head");
  head?.addEventListener("click", () => container.classList.toggle("collapsed"));
}
