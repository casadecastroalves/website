import { state, notify } from "../core/state.js";
import { refreshTheme } from "../map/map.js";
import { getMap } from "../map/map.js";

const KEY = "irun-theme";
const ICON_MOON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const ICON_SUN = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

export function applyThemeAttr() {
  const saved = localStorage.getItem(KEY);
  state.theme = saved === "dark" || saved === "light" ? saved : "light";
  document.documentElement.setAttribute("data-theme", state.theme);
}

export function initTheme() {
  updateButton();
  document.getElementById("btn-theme")?.addEventListener("click", () => {
    setTheme(state.theme === "light" ? "dark" : "light");
  });
}

export function setTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(KEY, theme);
  if (getMap()) refreshTheme();
  updateButton();
  notify();
}

function updateButton() {
  const btn = document.getElementById("btn-theme");
  if (!btn) return;
  const dark = state.theme === "dark";
  btn.innerHTML = dark ? ICON_SUN : ICON_MOON;
  btn.setAttribute("title", dark ? "Modo claro" : "Modo escuro");
}
