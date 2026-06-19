import {
  state, fichaById, tiById, listPontosCultura, listTeiaDosPovos, tipoLabel, setPontoCulturaFilter, setTeiaDosPovosFilter,
} from "../core/state.js";
import { goTerritorio, goFicha, goMunicipio, goPontosCultura, goTeiaDosPovos } from "../core/router.js";
import { openForContext, closeSheet, isMobile } from "./shell.js";
import { esc, slugify, debounce, matchSearch, searchNorm } from "../core/util.js";
import { focusPonto, refreshVisibility } from "../map/markers.js";

let index = [];
let results = [];
let active = -1;

const CAT_LABEL = {
  quilombos: "Quilombo",
  municipios: "Município",
  instituicoes: "Instituição",
  projetos: "Projeto",
  turismo: "Turismo",
  producao: "Produção",
  natureza: "Natureza",
};

function searchText(...parts) {
  return parts.filter(Boolean).join(" ");
}

function isPontosCulturaQuery(q) {
  const n = searchNorm(q);
  if (!n) return false;
  return (
    matchSearch("pontos de cultura ponto cultura", n)
    || (n.includes("ponto") && n.includes("cultura"))
    || n.includes("pontos cultura")
  );
}

function goPontoMap(p) {
  if (p.id) focusPonto(p.id);
  const fid = p.fichaId || p.entidadeId;
  if (fid) goFicha(fid, p.territorioId);
  else if (p.territorioId) goTerritorio(p.territorioId);
  if (isMobile()) closeSheet();
  openForContext();
}

function goTeiaItem(item) {
  setTeiaDosPovosFilter(true);
  refreshVisibility();
  if (item.pontoId) focusPonto(item.pontoId);
  if (item.fichaId) goFicha(item.fichaId, item.tiId);
  else if (item.tiId) goTerritorio(item.tiId);
  if (isMobile()) closeSheet();
  openForContext();
}

function goPcItem(item) {
  setPontoCulturaFilter(true);
  refreshVisibility();
  if (item.pontoId) focusPonto(item.pontoId);
  if (item.fichaId) goFicha(item.fichaId, item.tiId);
  else if (item.tiId) goTerritorio(item.tiId);
  if (isMobile()) closeSheet();
  openForContext();
}

function buildIndex() {
  index = [];

  index.push({
    type: "Coleção",
    cod: "★",
    name: "Pontos de Cultura",
    sub: `${listPontosCultura().length} lugares no mapa`,
    searchText: searchText("pontos de cultura ponto cultura rede cultura viva"),
    action: () => {
      setPontoCulturaFilter(true);
      refreshVisibility();
      goPontosCultura();
    },
    priority: 1,
  });

  index.push({
    type: "Coleção",
    cod: "🕸",
    name: "Teia dos Povos",
    sub: `${listTeiaDosPovos().length} lugares no mapa`,
    searchText: searchText("teia dos povos teia povos rede agroecologia"),
    action: () => {
      setTeiaDosPovosFilter(true);
      refreshVisibility();
      goTeiaDosPovos();
    },
    priority: 1,
  });

  state.territorios.forEach((t) => {
    index.push({
      type: "Território",
      cod: t.cod,
      name: t.nome,
      sub: `TI ${t.cod}`,
      searchText: searchText(t.cod, t.nome, "territorio territorio identidade regiao"),
      action: () => goTerritorio(t.id),
    });
  });

  const munSeen = new Set();
  state.fichas.forEach((f) => {
    const mun = f.meta?.municipio;
    if (!mun) return;
    const slug = slugify(mun);
    if (munSeen.has(slug)) return;
    munSeen.add(slug);
    index.push({
      type: "Município",
      cod: "",
      name: mun,
      sub: tiById(f.territorioId)?.nome || "",
      searchText: searchText(mun, "municipio cidade"),
      action: () => goMunicipio(slug),
    });
  });

  state.fichas.forEach((f) => {
    const ti = tiById(f.territorioId);
    index.push({
      type: tipoLabel(f.tipo),
      cod: f.rede ? "REDE" : "",
      name: f.meta?.nome || f.id,
      sub: [f.meta?.municipio, ti?.nome].filter(Boolean).join(" · "),
      searchText: searchText(
        f.meta?.nome,
        f.meta?.municipio,
        ti?.nome,
        f.tipo,
        f.sidebar?.apresentacao,
        f.pontoCultura ? "ponto de cultura" : "",
        f.teiaDosPovos ? "teia dos povos" : "",
      ),
      action: () => goFicha(f.id),
    });
  });

  listTeiaDosPovos().forEach((t) => {
    index.push({
      type: "Teia dos Povos",
      cod: "🕸",
      name: t.nome,
      sub: [t.municipio, t.tiNome].filter(Boolean).join(" · "),
      searchText: searchText(t.nome, t.municipio, t.tiNome, "teia dos povos"),
      action: () => goTeiaItem(t),
      priority: 2,
    });
  });

  listPontosCultura().forEach((pc) => {
    index.push({
      type: "Ponto de Cultura",
      cod: "★",
      name: pc.nome,
      sub: [pc.municipio, pc.tiNome].filter(Boolean).join(" · "),
      searchText: searchText(pc.nome, pc.municipio, pc.tiNome, "ponto de cultura ponto cultura"),
      action: () => goPcItem(pc),
      priority: 2,
    });
  });

  state.pontos.forEach((p) => {
    const ti = tiById(p.territorioId);
    const f = fichaById(p.fichaId || p.entidadeId);
    const cat = p.categorias?.find((c) => CAT_LABEL[c]) || p.categorias?.[0];
    const type = p.categorias?.includes("municipios")
      ? "Município"
      : (CAT_LABEL[cat] || "Lugar");
    index.push({
      type,
      cod: "",
      name: p.nome,
      sub: [f?.meta?.municipio, ti?.nome].filter(Boolean).join(" · "),
      searchText: searchText(
        p.nome,
        p.resumo,
        f?.meta?.nome,
        f?.meta?.municipio,
        ti?.nome,
        p.categorias?.join(" "),
        p.pontoCultura ? "ponto de cultura" : "",
      ),
      action: () => goPontoMap(p),
    });
  });
}

function scoreItem(item, q) {
  const n = searchNorm(q);
  if (!n) return item.priority || 0;
  const hay = searchNorm(item.searchText || item.name);
  if (hay.startsWith(n)) return 100 + (item.priority || 0);
  if (hay.includes(n)) return 80 + (item.priority || 0);
  if (matchSearch(item.searchText || item.name, q)) return 50 + (item.priority || 0);
  return -1;
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
  const term = q.trim();

  if (!term) {
    results = index.filter((i) => i.priority).slice(0, 8);
    if (!results.length) results = index.slice(0, 8);
  } else if (isPontosCulturaQuery(term)) {
    const coleção = index.find((i) => i.name === "Pontos de Cultura");
    const pcs = index.filter((i) => i.type === "Ponto de Cultura" && matchSearch(i.searchText || i.name, term));
    results = coleção ? [coleção, ...pcs] : pcs;
  } else {
    results = index
      .map((i) => ({ item: i, score: scoreItem(i, term) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30)
      .map((x) => x.item);
  }

  active = -1;
  if (!results.length) {
    box.innerHTML = `<p class="search-hint">Nenhum resultado para “${esc(term)}”. Tente território, município, quilombo ou <strong>pontos de cultura</strong>.</p>`;
    return;
  }

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

export function rebuildSearchIndex() {
  buildIndex();
}
