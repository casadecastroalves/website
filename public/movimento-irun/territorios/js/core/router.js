import { state, fichaById } from "./state.js";

export function parseRoute() {
  const raw = window.location.hash.replace(/^#\/?/, "");
  const [path, query] = raw.split("?");
  const parts = path.split("/").filter(Boolean);

  const f = new URLSearchParams(query || "").get("f");
  if ((query || "").includes("f=")) {
    state.filters = new Set((f || "").split(",").filter(Boolean));
    state.filterSomenteRoteiro = state.filters.size === 0;
  }

  const params = new URLSearchParams(query || "");
  state.viewer = params.get("all") === "1" ? "embed" : "normal";

  if (!parts.length) return { view: "home", tiId: null, fichaId: null, municipio: null };

  if (parts[0] === "t" && parts[1]) {
    return { view: parts[2] ? "ficha" : "ti", tiId: parts[1], fichaId: parts[2] || null, municipio: null };
  }
  if (parts[0] === "f" && parts[1]) {
    const ficha = fichaById(parts[1]);
    return { view: "ficha", tiId: ficha?.territorioId || null, fichaId: parts[1], municipio: null };
  }
  if (parts[0] === "m" && parts[1]) {
    return { view: "municipio", tiId: null, fichaId: null, municipio: parts[1] };
  }
  if (parts[0] === "pontos-cultura") {
    return { view: "pontos-cultura", tiId: null, fichaId: null, municipio: null };
  }
  if (parts[0] === "teia-dos-povos") {
    return { view: "teia-dos-povos", tiId: null, fichaId: null, municipio: null };
  }
  return { view: "home", tiId: null, fichaId: null, municipio: null };
}

export function buildHash({ view, tiId, fichaId, municipio, filters, viewer }) {
  let path = "/";
  if (view === "ti" && tiId) path = `/t/${tiId}`;
  else if (view === "ficha" && tiId && fichaId) path = `/t/${tiId}/${fichaId}`;
  else if (view === "ficha" && fichaId) path = `/f/${fichaId}`;
  else if (view === "municipio" && municipio) path = `/m/${municipio}`;
  else if (view === "pontos-cultura") path = "/pontos-cultura";
  else if (view === "teia-dos-povos") path = "/teia-dos-povos";

  const f = filters && filters.size ? Array.from(filters).join(",") : "";
  const v = viewer === "embed" ? "&all=1" : "";
  const query = f ? `?f=${f}${v}` : v ? "?all=1" : "";
  return `#${path}${query}`;
}

function navigate(route) {
  const hash = buildHash({ ...route, filters: state.filters, viewer: state.viewer });
  if (window.location.hash !== hash) window.location.hash = hash;
}

export function setViewer(mode) {
  state.viewer = mode;
}

export function getViewer() {
  return state.viewer || "normal";
}

export function isEmbedViewer() {
  return getViewer() === "embed";
}

export function goBack() {
  if (window.history.length > 1) window.history.back();
  else goHome();
}

export function goHome() {
  navigate({ view: "home" });
}

export function goTerritorio(tiId) {
  navigate({ view: "ti", tiId });
}

export function goFicha(fichaId, tiId) {
  const ti = tiId || fichaById(fichaId)?.territorioId || null;
  navigate({ view: "ficha", tiId: ti, fichaId });
}

export function goMunicipio(slug) {
  navigate({ view: "municipio", municipio: slug });
}

export function goPontosCultura() {
  navigate({ view: "pontos-cultura" });
}

export function goTeiaDosPovos() {
  navigate({ view: "teia-dos-povos" });
}

export function syncHash() {
  navigate(parseRoute());
}

export function refreshRoute() {
  navigate(parseRoute());
}

export function initRouter(onRoute) {
  const handle = () => onRoute(parseRoute());
  window.addEventListener("hashchange", handle);
  handle();
}
