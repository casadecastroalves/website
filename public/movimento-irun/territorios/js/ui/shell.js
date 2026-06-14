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

  window.addEventListener("resize", () => {
    if (!isMobile()) {
      document.getElementById("sidebar")?.classList.remove("open");
      sheetOpen = false;
    }
    invalidate();
  });
}

function toggleSheet() {
  sheetOpen ? closeSheet() : openSheet();
}

export function openSheet() {
  document.getElementById("sidebar")?.classList.add("open");
  sheetOpen = true;
}

export function closeSheet(silent = false) {
  document.getElementById("sidebar")?.classList.remove("open");
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

function initDrag() {
  const handle = document.getElementById("sheet-handle");
  const sidebar = document.getElementById("sidebar");
  if (!handle || !sidebar) return;
  let startY = 0;
  let dy = 0;
  let dragging = false;

  const start = (e) => {
    if (!isMobile()) return;
    dragging = true;
    startY = (e.touches ? e.touches[0].clientY : e.clientY);
    sidebar.classList.add("dragging");
  };
  const move = (e) => {
    if (!dragging) return;
    dy = (e.touches ? e.touches[0].clientY : e.clientY) - startY;
    if (dy > 0) sidebar.style.transform = `translateY(${dy}px)`;
  };
  const end = () => {
    if (!dragging) return;
    dragging = false;
    sidebar.classList.remove("dragging");
    sidebar.style.transform = "";
    if (dy > 120) closeSheet();
    dy = 0;
  };

  handle.addEventListener("touchstart", start, { passive: true });
  window.addEventListener("touchmove", move, { passive: true });
  window.addEventListener("touchend", end);
  handle.addEventListener("mousedown", start);
  window.addEventListener("mousemove", move);
  window.addEventListener("mouseup", end);
}
