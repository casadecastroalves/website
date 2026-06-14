import { state, tiById } from "../core/state.js";
import { esc } from "../core/util.js";

const TILES = {
  voyager: { url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", opts: { subdomains: "abcd", attribution: "&copy; OSM &copy; CARTO" } },
  dark: { url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", opts: { subdomains: "abcd", attribution: "&copy; OSM &copy; CARTO" } },
  satellite: { url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", opts: { attribution: "Tiles &copy; Esri" } },
  labelsLight: { url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png", opts: { subdomains: "abcd" } },
  labelsDark: { url: "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png", opts: { subdomains: "abcd" } },
};

let map = null;
let canvasRenderer = null;
let baseLayer = null;
let labelsLayer = null;
let tiLayer = null;
let redeGroup = null;
let roteirosGroup = null;
const tiLayerById = {};
let onTiClick = null;

export function initMap(containerId, handlers = {}) {
  onTiClick = handlers.onTiClick;
  const cfg = state.config.map;

  map = L.map(containerId, {
    zoomControl: false,
    minZoom: cfg.minZoom,
    maxZoom: cfg.maxZoom,
    maxBounds: cfg.maxBounds,
    maxBoundsViscosity: 1.0,
    preferCanvas: true,
    zoomSnap: 0.25,
  }).setView(cfg.centerFallback, cfg.zoomInicial);

  map.createPane("labels");
  map.getPane("labels").style.zIndex = 450;
  map.getPane("labels").style.pointerEvents = "none";

  canvasRenderer = L.canvas({ padding: 0.5 });
  L.control.zoom({ position: "bottomright" }).addTo(map);

  applyBase();
  buildTerritorios();

  map.getContainer().setAttribute("tabindex", "0");
  return map;
}

function tileKey() {
  if (state.baseMode === "satellite") return "satellite";
  return state.theme === "dark" ? "dark" : "voyager";
}

export function applyBase() {
  if (!map) return;
  if (baseLayer) map.removeLayer(baseLayer);
  if (labelsLayer) { map.removeLayer(labelsLayer); labelsLayer = null; }

  const t = TILES[tileKey()];
  baseLayer = L.tileLayer(t.url, { ...t.opts, maxZoom: state.config.map.maxZoom }).addTo(map);

  if (state.baseMode === "satellite") {
    const l = state.theme === "dark" ? TILES.labelsDark : TILES.labelsLight;
    labelsLayer = L.tileLayer(l.url, { ...l.opts, pane: "labels", maxZoom: state.config.map.maxZoom }).addTo(map);
  }
}

export function setBaseMode(mode) {
  state.baseMode = mode;
  applyBase();
  refreshTiStyles();
}

export function refreshTheme() {
  applyBase();
  refreshTiStyles();
}

/* ── Territórios (bordas, sem preenchimento) ── */
function tiStyles() {
  const dark = state.theme === "dark";
  const sat = state.baseMode === "satellite";
  const borda = dark || sat ? "rgba(255,255,255,0.5)" : "rgba(40,40,40,0.7)";
  return {
    base: { color: borda, weight: 1, fill: true, fillOpacity: 0, fillColor: "#000" },
    hover: { color: "#f5c518", weight: 1.6, fillOpacity: 0 },
    rede: { color: "#f5c518", weight: 1.5, fillOpacity: 0 },
    active: (rede) => ({ color: rede ? "#f5c518" : dark || sat ? "#ffffff" : "#16181d", weight: rede ? 2.2 : 1.8, fillOpacity: 0.04, fillColor: "#f5c518" }),
  };
}

function styleFor(id) {
  const s = tiStyles();
  const rede = tiById(id)?.redeAtiva;
  if (state.selectedTiId === id) return s.active(rede);
  if (rede) return s.rede;
  return s.base;
}

function buildTerritorios() {
  const { propId, propNome, propCod } = state.config.geo;
  tiLayer = L.geoJSON(state.geo, {
    renderer: canvasRenderer,
    style: (f) => styleFor(f.properties[propId]),
    onEachFeature: (f, layer) => {
      const id = f.properties[propId];
      const nome = f.properties[propNome];
      const cod = f.properties[propCod];
      tiLayerById[id] = layer;
      layer.bindPopup(
        `<div class="popup-title">${esc(cod)} — ${esc(nome)}</div>
         <div class="popup-cod">Território de Identidade</div>
         <span class="popup-link" data-ti="${esc(id)}">Ver ficha →</span>`,
        { maxWidth: 260, className: "irun-popup" }
      );
      layer.on({
        mouseover: () => { if (state.selectedTiId !== id) layer.setStyle(tiStyles().hover); },
        mouseout: () => { if (state.selectedTiId !== id) layer.setStyle(styleFor(id)); },
        click: () => onTiClick?.(id),
      });
    },
  }).addTo(map);

  map.fitBounds(tiLayer.getBounds(), { padding: [24, 24], animate: false });
}

export function refreshTiStyles() {
  if (!tiLayer) return;
  tiLayer.eachLayer((layer) => {
    const id = layer.feature.properties[state.config.geo.propId];
    layer.setStyle(styleFor(id));
  });
}

export function highlightTi(tiId) {
  if (!tiLayer) return;
  refreshTiStyles();
  const layer = tiLayerById[tiId];
  if (layer) {
    layer.bringToFront();
    map.fitBounds(layer.getBounds(), { padding: [48, 48], maxZoom: 10 });
  }
}

export function fitFichas(fichas) {
  const pts = fichas.map((f) => f.meta?.coords).filter((c) => Array.isArray(c) && c.length === 2);
  if (!pts.length) { resetView(); return; }
  map.fitBounds(L.latLngBounds(pts), { padding: [80, 80], maxZoom: 12 });
}

export function resetView() {
  refreshTiStyles();
  if (tiLayer) map.fitBounds(tiLayer.getBounds(), { padding: [24, 24] });
}

/* ── Camadas REDE (polígonos participativos) e roteiros ── */
export async function loadRedeLayers() {
  if (!state.rede?.length) return;
  redeGroup = L.layerGroup().addTo(map);
  const active = state.rede.filter((l) => l.status === "active");
  const geos = await Promise.all(active.map((l) => fetch(`geo/${l.file.replace(/^geo\//, "")}`).then((r) => r.json()).catch(() => null)));
  active.forEach((l, i) => {
    const geo = geos[i];
    if (!geo) return;
    L.geoJSON(geo, {
      renderer: canvasRenderer,
      filter: (f) => f.geometry.type !== "Point",
      style: () => ({ color: "#f5c518", weight: 1.5, fillOpacity: 0, dashArray: "6 4" }),
    }).addTo(redeGroup);
  });
}

export async function loadRoteiros() {
  if (!state.roteiros?.length) return;
  roteirosGroup = L.layerGroup().addTo(map);
  for (const r of state.roteiros) {
    if (!r.file) continue;
    const geo = await fetch(r.file).then((res) => res.json()).catch(() => null);
    if (!geo) continue;
    L.geoJSON(geo, {
      renderer: canvasRenderer,
      filter: (f) => f.geometry.type === "LineString",
      style: () => ({ color: "#ff7a59", weight: 3, opacity: 0.85, dashArray: "8 6" }),
      onEachFeature: (f, layer) => layer.bindPopup(`<div class="popup-title">${esc(r.titulo)}</div><div class="popup-cod">Roteiro · Turismo</div>`),
    }).addTo(roteirosGroup);
  }
}

export function getMap() {
  return map;
}
