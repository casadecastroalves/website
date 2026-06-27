import { state, notify } from "../core/state.js";
import { getMap } from "../map/map.js";

const MOBILE_BP = 768;
let sheetOpen = false;

export function isMobile() {
  return window.innerWidth <= MOBILE_BP;
}

export function initShell() {
  document.getElementById("btn-menu")?.addEventListener("click", () => {
    if (isMobile()) toggleSheet();
    else setDesktopCollapsed(!state.sidebarCollapsed);
  });

  document.getElementById("btn-close-sidebar")?.addEventListener("click", () => {
    if (isMobile()) closeSheet();
    else setDesktopCollapsed(true);
  });

  document.getElementById("btn-reopen-desktop")?.addEventListener("click", () => setDesktopCollapsed(false));
  document.getElementById("sheet-peek")?.addEventListener("click", () => openSheet());

  initDrag();
  initMapTapToCloseSheet();

  window.addEventListener("resize", () => {
    if (!isMobile()) {
      document.getElementById("sidebar")?.classList.remove("open");
      sheetOpen = false;
      const sidebar = document.getElementById("sidebar");
      if (sidebar) sidebar.style.transform = "";
    }
    invalidate();
  });
}

function toggleSheet() {
  sheetOpen ? closeSheet() : openSheet();
}

export function openSheet() {
  const sidebar = document.getElementById("sidebar");
  if (!sidebar) return;
  sidebar.classList.add("open");
  sidebar.style.transform = "";
  sheetOpen = true;
  invalidate();
}

export function closeSheet(silent = false) {
  const sidebar = document.getElementById("sidebar");
  if (sidebar) sidebar.classList.remove("open");
  if (sidebar) sidebar.style.transform = "";
  sheetOpen = false;
  if (!silent) invalidate();
}

export function setDesktopCollapsed(collapsed) {
  state.sidebarCollapsed = collapsed;
  document.body.classList.toggle("sidebar-collapsed", collapsed);
  invalidate();
  notify();
}

/* Abre o painel no contexto certo (sheet no mobile, expandido no desktop) */
export function openForContext() {
  if (isMobile()) openSheet();
  else if (state.sidebarCollapsed) setDesktopCollapsed(false);
}

function invalidate() {
  setTimeout(() => getMap()?.invalidateSize(), 280);
}

function initMapTapToCloseSheet() {
  const map = getMap();
  if (!map) return;
  map.on("click", () => {
    if (sheetOpen) closeSheet();
  });
}

function initDrag() {
  const handle = document.getElementById("sheet-handle");
  const sidebar = document.getElementById("sidebar");
  if (!handle || !sidebar) return;

  let startY = 0;
  let startOffset = 0;
  let dragging = false;

  // Lê o translateY actual do DOM (funciona após qualquer mudança de estado)
  const readOffset = () => {
    const m = new DOMMatrix(getComputedStyle(sidebar).transform);
    return isNaN(m.m42) ? 0 : Math.max(0, m.m42);
  };

  const start = (e) => {
    if (!isMobile()) return;
    dragging = true;
    startY = e.touches ? e.touches[0].clientY : e.clientY;
    startOffset = readOffset();
    sidebar.classList.add("dragging");
  };

  const move = (e) => {
    if (!dragging) return;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    const newOffset = Math.max(0, startOffset + (y - startY));
    sidebar.style.transform = `translateY(${newOffset}px)`;
  };

  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    sidebar.classList.remove("dragging");
    const y = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const finalOffset = Math.max(0, startOffset + (y - startY));
    const sheetH = sidebar.offsetHeight || Math.round(window.innerHeight * 0.88);
    if (finalOffset > sheetH * 0.45) {
      // Arrastado mais de 45% → fechar
      closeSheet();
    } else {
      // Ficar na altura onde o utilizador largou
      sidebar.style.transform = `translateY(${finalOffset}px)`;
    }
  };

  handle.addEventListener("touchstart", start, { passive: true });
  window.addEventListener("touchmove", move, { passive: true });
  window.addEventListener("touchend", end);
  handle.addEventListener("mousedown", start);
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
}
