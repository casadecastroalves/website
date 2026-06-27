import { state, countRede, fichaById, tiById, fichasDoMunicipio, setSelected, setPontoCulturaFilter, setTeiaDosPovosFilter, clearAllFilters, selectAllFilters, TEIA_HUB_ID } from "./core/state.js";
import { loadAll } from "./core/store.js";
import { initRouter, parseRoute, goTerritorio, goFicha, goHome } from "./core/router.js";
import {
  initMap, getMap, setBaseMode, highlightTi, resetView, fitFichas,
  refreshTiStyles, loadRedeLayers, loadRoteiros,
} from "./map/map.js";
import { buildMarkers, setSelectedFicha, focusFicha, refreshVisibility, buildLegend, fitPontosCultura, showTeiaOnMap } from "./map/markers.js";
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
  if (!el) return;
  const tisAtivos = state.territorios.filter(t => t.redeAtiva).length;
  const fichasRede = state.fichas.filter(f => f.rede).length;
  const pontosRede = state.pontos.filter(p => p.entidadeId || p.fichaId).length;
  el.textContent = `REDE IRUN · ${tisAtivos} TIs · ${fichasRede} fichas · ${pontosRede} pontos`;
}

function applyDefaultFilters() {
  if (/[?&]f=/.test(window.location.hash)) return;
  if (isMobile()) selectAllFilters();
}

function initBrandHome() {
  const go = () => {
    getMap()?.closePopup();
    if (isMobile()) selectAllFilters();
    else clearAllFilters();
    refreshVisibility();
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
  /* Leaflet chama disableClickPropagation() no container de cada popup,
     o que bloqueia a propagação para o map container.
     Solução: adicionar o listener directamente no popup quando abre. */
  getMap().on("popupopen", (e) => {
    const container = e.popup._container;
    if (!container) return;
    container.addEventListener("click", (ev) => {
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
  });
}

/** Links http(s) abrem sempre noutro separador — o mapa fica aberto. */
function initExternalLinks() {
  document.getElementById("app")?.addEventListener("click", (ev) => {
    const a = ev.target.closest("a[href]");
    if (!a) return;
    const raw = a.getAttribute("href") || "";
    if (!raw || raw.startsWith("#") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return;
    let url;
    try { url = new URL(a.href, window.location.href); } catch { return; }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    a.rel = "noopener noreferrer";
    if (a.target !== "_blank") {
      ev.preventDefault();
      window.open(url.href, "_blank", "noopener,noreferrer");
    }
    if (isMobile()) closeSheet();
  }, true);
}

function exitTeiaMode() {
  setTeiaDosPovosFilter(false);
  getMap()?.closePopup();
  refreshVisibility();
}

function activateTeiaHub() {
  state.filters = new Set();
  state.filterPontoCultura = false;
  state.filterSomenteRoteiro = false;
  setTeiaDosPovosFilter(true);
  refreshVisibility();
  setSelectedFicha(TEIA_HUB_ID);
  getMap()?.closePopup();
  showTeiaOnMap();
  openForContext();
}

function handleRoute(route) {
  setSelected({ tiId: route.tiId, fichaId: route.fichaId, municipio: route.municipio });
  const sidebarRoute = (route.view === "ficha" && route.fichaId === TEIA_HUB_ID)
    ? { view: "teia-dos-povos", tiId: null, fichaId: null, municipio: null }
    : route;
  renderSidebar(sidebarRoute);

  if (route.view === "ficha" && route.fichaId === TEIA_HUB_ID) {
    activateTeiaHub();
  } else if (route.view === "ficha" && route.fichaId) {
    getMap()?.closePopup();
    const ficha = fichaById(route.fichaId);
    if (route.tiId) highlightTi(route.tiId);
    setSelectedFicha(route.fichaId);
    if (ficha) focusFicha(ficha);
    openForContext();
  } else if (route.view === "ti" && route.tiId) {
    exitTeiaMode();
    highlightTi(route.tiId);
    setSelectedFicha(null);
    openForContext();
  } else if (route.view === "municipio" && route.municipio) {
    exitTeiaMode();
    setSelectedFicha(null);
    fitFichas(fichasDoMunicipio(route.municipio));
    openForContext();
  } else if (route.view === "pontos-cultura") {
    exitTeiaMode();
    setSelectedFicha(null);
    setPontoCulturaFilter(true);
    refreshVisibility();
    resetView();
    setTimeout(() => fitPontosCultura(), 320);
    openForContext();
  } else if (route.view === "teia-dos-povos") {
    activateTeiaHub();
  } else {
    setSelectedFicha(null);
    if (state.filterPontoCultura) {
      setPontoCulturaFilter(false);
      refreshVisibility();
    }
    if (state.filterTeiaDosPovos) {
      exitTeiaMode();
    } else {
      getMap()?.closePopup();
    }
    resetView();
  }

  refreshVisibility();
  refreshTiStyles();
  updateRedeBadge();
}

function setBootStatus(html) {
  const el = document.getElementById("sidebar-content");
  if (el) el.innerHTML = html;
}

function setBootReady() {
  document.body.classList.remove("map-booting");
}

async function main() {
  document.body.classList.add("map-booting");
  setBootStatus(`<p class="lead map-boot-msg">A carregar mapa…</p>`);
  applyThemeAttr();

  await loadAll();
  applyDefaultFilters();
  setChrome();

  initShell();
  initLightbox();

  initMap("map", { onTiClick: (id) => goTerritorio(id) });
  buildMarkers({});
  buildLegend(document.getElementById("map-legend"));

  initTheme();
  initSearch();
  initShare();
  initSidebarKeyboard();
  initMapModes();
  initBrandHome();
  initExternalLinks();
  document.getElementById("btn-rede-badge")?.addEventListener("click", openRedePanel);
  initPopupLinks();

  initRouter(handleRoute);
  setBootReady();
  setTimeout(() => getMap()?.invalidateSize(), 100);

  /* Camadas REDE/roteiro em segundo plano — não bloqueiam legenda nem sidebar. */
  Promise.all([loadRedeLayers(), loadRoteiros()])
    .then(() => {
      refreshVisibility();
      refreshTiStyles();
    })
    .catch((err) => console.warn("Camadas REDE/roteiro:", err));
}

main().catch((err) => {
  console.error(err);
  setBootReady();
  setBootStatus(`<p class="lead">Erro ao carregar o mapa: ${err?.message || err}. Recarregue a página (Ctrl+Shift+R). Se persistir, verifique a ligação à internet.</p>`);
});
