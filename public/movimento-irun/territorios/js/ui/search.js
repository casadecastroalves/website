import { state } from "../core/state.js";
import { goTerritorio, goFicha } from "../core/router.js";
import { openForContext } from "./shell.js";
import { esc, slugify, debounce } from "../core/util.js";

let index = [];
let results = [];
let active = -1;

function buildIndex() {
  index = [];
  state.territorios.forEach((t) => index.push({ type: "Território", cod: t.cod, name: t.nome, action: () => goTerritorio(t.id), key: slugify(`${t.cod} ${t.nome}`) }));
  state.fichas.forEach((f) => index.push({ type: f.tipo, cod: "", name: f.meta?.nome || f.id, sub: f.meta?.municipio || "", action: () => goFicha(f.id), key: slugify(`${f.meta?.nome} ${f.meta?.municipio} ${f.tipo}`) }));
  state.pontos.forEach((p) => {
    if (p.fichaId || p.entidadeId) return;
    index.push({ type: "Lugar", cod: "", name: p.nome, action: () => { const ti = state.territorios.find((t) => t.id === p.territorioId); if (ti) goTerritorio(ti.id); }, key: slugify(p.nome) });
  });
}

function open() {
  document.getElementById("search-overlay")?.classList.add("open");
  document.getElementById("search-overlay")?.setAttribute("aria-hidden", "false");
  const input = document.getElementById("search-input");
  if (input) { input.value = ""; setTimeout(() => input.focus(), 50); }
  render("");
}

function close() {
  document.getElementById("search-overlay")?.classList.remove("open");
  document.getElementById("search-overlay")?.setAttribute("aria-hidden", "true");
}

function render(q) {
  const box = document.getElementById("search-results");
  if (!box) return;
  const term = slugify(q);
  results = !term ? index.slice(0, 8) : index.filter((i) => i.key.includes(term)).slice(0, 30);
  active = -1;
  if (!results.length) { box.innerHTML = ""; return; }
  box.innerHTML = results.map((r, i) => `
    <button type="button" class="search-result" data-i="${i}">
      ${r.cod ? `<span class="search-result-cod">${esc(r.cod)}</span>` : `<span class="search-result-cod"></span>`}
      <span class="search-result-name">${esc(r.name)}${r.sub ? ` <span class="muted">· ${esc(r.sub)}</span>` : ""}</span>
      <span class="search-result-type">${esc(r.type)}</span>
    </button>`).join("");
  box.querySelectorAll(".search-result").forEach((btn) => {
    btn.addEventListener("click", () => choose(Number(btn.dataset.i)));
  });
}

function choose(i) {
  const r = results[i];
  if (!r) return;
  close();
  r.action();
  openForContext();
}

function highlight() {
  document.querySelectorAll(".search-result").forEach((b, i) => b.classList.toggle("active", i === active));
}

export function initSearch() {
  buildIndex();
  const input = document.getElementById("search-input");
  input?.addEventListener("input", debounce((e) => render(e.target.value), 100));

  document.querySelectorAll("[data-open-search]").forEach((b) => b.addEventListener("click", open));
  document.getElementById("search-close")?.addEventListener("click", close);
  document.getElementById("search-overlay")?.addEventListener("click", (e) => { if (e.target.id === "search-overlay") close(); });

  document.addEventListener("keydown", (e) => {
    const overlay = document.getElementById("search-overlay");
    const isOpen = overlay?.classList.contains("open");
    if ((e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) || (e.key.toLowerCase() === "k" && (e.ctrlKey || e.metaKey))) {
      e.preventDefault(); open(); return;
    }
    if (!isOpen) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, results.length - 1); highlight(); }
    if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); highlight(); }
    if (e.key === "Enter") choose(active < 0 ? 0 : active);
  });
}
