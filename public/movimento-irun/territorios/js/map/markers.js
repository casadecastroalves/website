import { state, toggleFilter, togglePontoCulturaFilter, toggleTeiaDosPovosFilter, isPontoCultura, isTeiaDosPovos, clearAllFilters, selectAllFilters } from "../core/state.js";
import { goHome, syncHash } from "../core/router.js";
import { getMap, refreshRoteiroVisibility } from "./map.js";
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

function isStub(entry) {
  if (entry.stub) return true;
  const fid = fichaIdOf(entry);
  return !!(fid && state.fichaById?.[fid]?.stub);
}

function icon(color, active, pontoCultura, stub, teiaDosPovos) {
  const dual = pontoCultura && teiaDosPovos;
  const cls = [
    "irun-marker",
    active && "active",
    pontoCultura && "pc",
    teiaDosPovos && "teia",
    dual && "pc-teia",
    stub && "stub",
  ].filter(Boolean).join(" ");
  let marks = "";
  if (pontoCultura) marks += '<span class="pc-star" aria-hidden="true">★</span>';
  return L.divIcon({
    className: "irun-pin",
    html: `<span class="${cls}" style="background:${color}">${marks}</span>`,
    iconSize: [40, 40],
    iconAnchor: [20, 34],
    popupAnchor: [0, -30],
  });
}

function matchesFilters(cats = [], pontoCultura = false, teiaDosPovos = false) {
  if (state.filterSomenteRoteiro) return false;

  const catKeys = Object.keys(state.config?.categorias || {});
  const hasCat = catKeys.some((k) => state.filters.has(k));
  const hasAny = hasCat || state.filterPontoCultura || state.filterTeiaDosPovos;
  if (!hasAny) return false;

  if (hasCat && cats.some((c) => state.filters.has(c))) return true;
  if (state.filterPontoCultura && pontoCultura) return true;
  if (state.filterTeiaDosPovos && teiaDosPovos) return true;
  return false;
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
      stub: f.stub || false,
      pontoCultura: !!f.pontoCultura,
      teiaDosPovos: !!f.teiaDosPovos,
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
    const fid = fichaIdOf(entry);
    const ficha = fid ? state.fichaById?.[fid] : null;
    const pc = isPontoCultura(entry, ficha);
    const teia = isTeiaDosPovos(entry, ficha);
    const stub = isStub(entry);
    const marker = L.marker(entry.coords, { icon: icon(colorOf(entry), false, pc, stub, teia), keyboard: false });
    marker._cats = entry.categorias || [];
    marker._fichaId = fichaIdOf(entry);
    marker._color = colorOf(entry);
    marker._pontoCultura = pc;
    marker._teiaDosPovos = teia;
    marker._stub = stub;
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
  const btn = document.getElementById("btn-pc-filter");
  if (btn) {
    btn.classList.toggle("active", state.filterPontoCultura);
    btn.setAttribute("aria-pressed", state.filterPontoCultura ? "true" : "false");
  }
  const btnTeia = document.getElementById("btn-teia-filter");
  if (btnTeia) {
    btnTeia.classList.toggle("active", state.filterTeiaDosPovos);
    btnTeia.setAttribute("aria-pressed", state.filterTeiaDosPovos ? "true" : "false");
  }
  document.querySelectorAll(".legend-item[data-cat]").forEach((el) => {
    const active = state.filters.has(el.dataset.cat);
    el.classList.toggle("active", active);
    el.setAttribute("aria-pressed", active ? "true" : "false");
  });
  group.eachLayer((m) => {
    const visible = matchesFilters(m._cats, m._pontoCultura, m._teiaDosPovos);
    const el = m.getElement?.();
    if (el) {
      el.style.display = visible ? "" : "none";
      el.style.pointerEvents = visible ? "" : "none";
    }
  });
  refreshRoteiroVisibility();
}

export function setSelectedFicha(fichaId) {
  Object.entries(markerByFichaId).forEach(([id, m]) => {
    m.setIcon(icon(m._color, id === fichaId, m._pontoCultura, m._stub, m._teiaDosPovos));
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

export function fitPontosCultura() {
  fitFilteredMarkers((m) => m._pontoCultura);
}

export function fitTeiaDosPovos() {
  fitFilteredMarkers((m) => m._teiaDosPovos);
}

function fitFilteredMarkers(pred) {
  const map = getMap();
  if (!map || !group) return;
  const latlngs = [];
  group.eachLayer((m) => {
    if (!pred(m)) return;
    const el = m.getElement?.();
    if (el && el.style.display === "none") return;
    latlngs.push(m.getLatLng());
  });
  if (!latlngs.length) return;
  if (latlngs.length === 1) {
    map.setView(latlngs[0], Math.max(map.getZoom(), 11), { animate: true });
    return;
  }
  map.fitBounds(L.latLngBounds(latlngs), { padding: [48, 48], maxZoom: 10, animate: true });
}

export function buildLegend(container) {
  if (!container) return;
  const cats = categorias();
  const catItems = Object.entries(cats)
    .map(([k, v]) => `<button type="button" class="legend-item" data-cat="${k}" aria-pressed="false">
      <span class="legend-check" aria-hidden="true"></span>
      <span class="legend-dot" style="background:${v.cor}"></span>
      <span class="legend-label">${v.label}</span>
    </button>`)
    .join("");
  container.innerHTML = `
    <div class="legend-head" role="button" tabindex="0">Legenda <span class="legend-toggle">▾</span></div>
    <div class="legend-items">${catItems}
      <button type="button" class="legend-item legend-item-teia" id="btn-teia-filter" aria-pressed="false">
        <span class="legend-check" aria-hidden="true"></span>
        <span class="legend-dot legend-dot-teia">🕸</span>
        <span class="legend-label">Teia dos Povos</span>
      </button>
      <button type="button" class="legend-item legend-item-pc" id="btn-pc-filter" aria-pressed="false">
        <span class="legend-check" aria-hidden="true"></span>
        <span class="legend-dot legend-dot-pc">★</span>
        <span class="legend-label">Pontos de Cultura</span>
      </button>
    </div>
    <div class="legend-actions">
      <button type="button" class="legend-action" id="btn-filter-none" title="Ocultar tudo no mapa">Nenhum</button>
      <button type="button" class="legend-action" id="btn-filter-all" title="Mostrar todos os pins">Todos</button>
    </div>`;
  const head = container.querySelector(".legend-head");
  head?.addEventListener("click", () => container.classList.toggle("collapsed"));
  container.querySelectorAll(".legend-item[data-cat]").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleFilter(btn.dataset.cat);
      refreshVisibility();
    });
  });
  document.getElementById("btn-filter-none")?.addEventListener("click", () => {
    clearAllFilters();
    refreshVisibility();
    goHome();
  });
  document.getElementById("btn-filter-all")?.addEventListener("click", () => {
    selectAllFilters();
    refreshVisibility();
    syncHash();
  });
  const btnPC = container.querySelector("#btn-pc-filter");
  btnPC?.addEventListener("click", () => {
    togglePontoCulturaFilter();
    refreshVisibility();
  });
  const btnTeia = container.querySelector("#btn-teia-filter");
  btnTeia?.addEventListener("click", () => {
    toggleTeiaDosPovosFilter();
    refreshVisibility();
  });
  refreshVisibility();
}
