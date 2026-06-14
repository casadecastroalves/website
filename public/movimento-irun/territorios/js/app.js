import { state, countRede, fichaById, tiById, fichasDoMunicipio, setSelected } from "./core/state.js";
import { loadAll } from "./core/store.js";
import { initRouter, parseRoute, goTerritorio, goFicha, goHome } from "./core/router.js";
import {
  initMap, getMap, setBaseMode, highlightTi, resetView, fitFichas,
  refreshTiStyles, loadRedeLayers, loadRoteiros,
} from "./map/map.js";
import { buildMarkers, setSelectedFicha, focusFicha, refreshVisibility, buildLegend } from "./map/markers.js";
import { renderSidebar, initSidebarKeyboard, openRedePanel } from "./ui/sidebar.js";
import { initSearch } from "./ui/search.js";
import { initShare } from "./ui/share.js";
import { applyThemeAttr, initTheme } from "./ui/theme.js";
import { initShell, openForContext, closeSheet, isMobile } from "./ui/shell.js";
import { initLightbox } from "./ui/lightbox.js";

function setChrome() {
  const c = state.config.app || {};
  document.getElementById("footer-text").textContent = c.footer || "";
  if (c.title) document.title = `${c.title} — ${c.subtitle || ""}`.trim();
}

function updateRedeBadge() {
  const el = document.getElementById("btn-rede-badge");
  if (el) el.textContent = `REDE ${countRede()}/${state.config.rede?.meta || state.territorios.length}`;
}

function initBrandHome() {
  // Voltar ao início = reset limpo: fecha popup, limpa filtros e volta ao mapa da Bahia.
  const go = () => {
    getMap()?.closePopup();
    if (state.filters.size) { state.filters = new Set(); refreshVisibility(); }
    goHome();
    openForContext();
  };
  document.querySelectorAll("[data-home]").forEach((el) => {
    el.addEventListener("click", go);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
    });
  });
}

function initMapModes() {
  document.querySelectorAll(".map-mode[data-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".map-mode[data-mode]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      setBaseMode(btn.dataset.mode);
    });
  });
}

function initPopupLinks() {
  getMap().getContainer().addEventListener("click", (ev) => {
    const ext = ev.target.closest('a[target="_blank"]');
    if (ext && isMobile()) closeSheet();
    const link = ev.target.closest("[data-ficha],[data-ti]");
    if (!link || link.tagName === "A") return;
    ev.preventDefault();
    if (link.dataset.ficha) goFicha(link.dataset.ficha);
    else if (link.dataset.ti) goTerritorio(link.dataset.ti);
    openForContext();
    getMap().closePopup();
  });
}

function handleRoute(route) {
  setSelected({ tiId: route.tiId, fichaId: route.fichaId, municipio: route.municipio });
  renderSidebar(route);

  if (route.view === "ficha" && route.fichaId) {
    const ficha = fichaById(route.fichaId);
    if (route.tiId) highlightTi(route.tiId);
    setSelectedFicha(route.fichaId);
    if (ficha) focusFicha(ficha);
    openForContext();
  } else if (route.view === "ti" && route.tiId) {
    highlightTi(route.tiId);
    setSelectedFicha(null);
    openForContext();
  } else if (route.view === "municipio" && route.municipio) {
    setSelectedFicha(null);
    fitFichas(fichasDoMunicipio(route.municipio));
    openForContext();
  } else {
    setSelectedFicha(null);
    resetView();
  }

  refreshTiStyles();
  updateRedeBadge();
}

async function main() {
  applyThemeAttr();
  await loadAll();
  setChrome();

  initShell();
  initLightbox();

  initMap("map", { onTiClick: (id) => goTerritorio(id) });
  await Promise.all([loadRedeLayers(), loadRoteiros()]);
  buildMarkers({});
  buildLegend(document.getElementById("map-legend"));

  initTheme();
  initSearch();
  initShare();
  initSidebarKeyboard();
  initMapModes();
  initBrandHome();
  document.getElementById("btn-rede-badge")?.addEventListener("click", openRedePanel);
  initPopupLinks();

  initRouter(handleRoute);
  setTimeout(() => getMap()?.invalidateSize(), 100);
}

main().catch((err) => {
  console.error(err);
  const el = document.getElementById("sidebar-content");
  if (el) el.innerHTML = `<p class="lead">Erro ao carregar o mapa. Verifique se está a usar um servidor HTTP (não abra via file://) e recarregue.</p>`;
});
