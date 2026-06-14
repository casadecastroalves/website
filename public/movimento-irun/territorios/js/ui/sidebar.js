import {
  state, tiById, fichaById, fichasDoTerritorio, fichasDoMunicipio,
  redeOrdenada, countRede, toggleFilter,
} from "../core/state.js";
import { goHome, goTerritorio, goFicha, goMunicipio, parseRoute } from "../core/router.js";
import { esc, escAttr, slugify } from "../core/util.js";
import { isMobile, openForContext, setDesktopCollapsed, closeSheet } from "./shell.js";
import { refreshVisibility } from "../map/markers.js";
import { openLightbox } from "./lightbox.js";

const YT = "rel=0&modestbranding=1&iv_load_policy=3";

/* ── Helpers ── */
function tiList() { return state.territorios; }
function prevTi(id) { const i = tiList().findIndex((t) => t.id === id); return tiList()[(i - 1 + tiList().length) % tiList().length]; }
function nextTi(id) { const i = tiList().findIndex((t) => t.id === id); return tiList()[(i + 1) % tiList().length]; }

function fichaLabel(f) {
  const nome = f.meta?.nome || f.id;
  if (f.tipo === "municipio") return nome;
  const mun = f.meta?.municipio;
  return mun ? `${nome} · ${mun}` : nome;
}

function accordion(id, title, body, open = false) {
  return `<div class="accordion${open ? " open" : ""}" data-acc="${escAttr(id)}">
    <button type="button" class="accordion-trigger" aria-expanded="${open}">${esc(title)} <span class="chevron" aria-hidden="true">▾</span></button>
    <div class="accordion-panel"><div class="accordion-body">${body}</div></div>
  </div>`;
}

function subAccordion(id, title, body) {
  return `<div class="sub-accordion" data-sub="${escAttr(id)}">
    <button type="button" class="sub-trigger" aria-expanded="false">${esc(title)} <span class="chevron-sm" aria-hidden="true">›</span></button>
    <div class="sub-panel"><p>${body}</p></div>
  </div>`;
}

function verMais(href, label = "Ver mais no site →") {
  return href ? `<p class="ver-mais"><a href="${escAttr(href)}" target="_blank" rel="noopener">${esc(label)}</a></p>` : "";
}

/* ── Listas ── */
function renderTiList(activeId = null) {
  return `<ul class="ti-list">${tiList().map((t) => `
    <li class="ti-item${t.id === activeId ? " active" : ""}${t.redeAtiva ? " rede-active" : ""}" data-ti="${t.id}" tabindex="0" role="button">
      <span class="ti-cod">${esc(t.cod)}</span><span class="ti-nome">${esc(t.nome)}</span>
    </li>`).join("")}</ul>`;
}

function fichaCard(f, badge) {
  const sub = f.tipo !== "municipio" && f.meta?.municipio ? `<span class="entity-sub">${esc(f.meta.municipio)}</span>` : "";
  return `<li class="entity-card" data-ficha="${f.id}" tabindex="0" role="button">
    <span class="entity-badge">${esc(badge)}</span>
    <span class="entity-name">${esc(f.meta?.nome || f.id)}${sub}</span>
    <span class="entity-arrow">→</span>
  </li>`;
}

function renderRedeList() {
  const list = redeOrdenada();
  if (!list.length) return `<p class="empty-rede">Nenhum território mapeado ainda.</p>`;
  return `<ul class="entity-list">${list.map((f) => fichaCard(f, `TI ${tiById(f.territorioId)?.cod || "—"}`)).join("")}</ul>`;
}

function renderFilters() {
  const cats = state.config.categorias || {};
  return (state.config.filtros || []).map((g) => `
    <div class="filter-group">
      <div class="filter-label">${esc(g.label)}</div>
      <div class="filter-chips">${g.items.map((k) => {
        const c = cats[k] || {};
        return `<button type="button" class="chip${state.filters.has(k) ? " active" : ""}" data-filter="${escAttr(k)}">
          <span class="chip-dot" style="background:${c.cor || "#999"}"></span>${esc(c.label || k)}</button>`;
      }).join("")}</div>
    </div>`).join("");
}

/* ── Mídia ── */
function renderFotos(fotos) {
  if (!fotos?.length) return "";
  const thumbs = fotos.map((p, i) => {
    const src = typeof p === "string" ? p : p.src;
    const cap = typeof p === "string" ? "" : p.legenda || "";
    return `<button type="button" class="media-thumb" data-photo data-src="${escAttr(src)}" data-legenda="${escAttr(cap)}" data-idx="${i}" aria-label="Ampliar foto">
      <img src="${escAttr(src)}" alt="${escAttr(cap)}" loading="lazy" decoding="async"></button>`;
  }).join("");
  return `<div class="media-grid">${thumbs}</div>`;
}

function renderVideos(videos) {
  if (!videos?.length) return `<p class="empty-rede">Vídeos em breve.</p>`;
  return videos.map((v) => {
    if (v.tipo === "youtube" && v.id) {
      return `<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${escAttr(v.id)}?${YT}" title="${escAttr(v.titulo)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe><p class="video-title">${esc(v.titulo)}</p></div>`;
    }
    return v.href ? `<p><a href="${escAttr(v.href)}" target="_blank" rel="noopener">${esc(v.titulo)}</a></p>` : "";
  }).join("");
}

function renderList(items, key = "nome") {
  if (!items?.length) return `<p class="empty-rede">Conteúdo em breve.</p>`;
  return `<ul class="content-list">${items.map((i) => `<li>${esc(i[key] || i.titulo || i.nome || "")}${i.descricao ? ` — <span class="muted">${esc(i.descricao)}</span>` : ""}</li>`).join("")}</ul>`;
}

function renderProjetos(items) {
  if (!items?.length) return `<p class="empty-rede">Nenhum projeto mapeado ainda.</p>`;
  const cards = [];
  const rest = [];
  items.forEach((p) => {
    if (p.fichaId && fichaById(p.fichaId)) cards.push(fichaCard(fichaById(p.fichaId), "Projeto"));
    else rest.push(`<li><strong>${esc(p.titulo)}</strong>${p.descricao ? `<br><span class="muted">${esc(p.descricao)}</span>` : ""}</li>`);
  });
  if (!cards.length && !rest.length) return `<p class="empty-rede">Nenhum projeto mapeado ainda.</p>`;
  return `${cards.length ? `<ul class="entity-list">${cards.join("")}</ul>` : ""}${rest.length ? `<ul class="content-list">${rest.join("")}</ul>` : ""}`;
}

function renderLinks(items) {
  if (!items?.length) return "";
  return `<ul class="link-list">${items.map((i) => `<li><a href="${escAttr(i.href)}" target="_blank" rel="noopener">${esc(i.titulo || i.handle || i.href)}</a></li>`).join("")}</ul>`;
}

function renderPortfolio(items) {
  if (!items?.length) return `<p class="empty-rede">Portfólio em breve.</p>`;
  return `<ul class="link-list">${items.map((i) => `<li><a href="${escAttr(i.href)}" target="_blank" rel="noopener" class="pdf-link">${esc(i.titulo)} ↗</a></li>`).join("")}</ul>`;
}

function renderDocumentos(docs) {
  if (!docs?.length) return "";
  return `<ul class="link-list">${docs.map((d) => {
    const src = typeof d === "string" ? d : d.src;
    const titulo = typeof d === "string" ? "Documento" : (d.titulo || "Documento");
    return `<li><a href="${escAttr(src)}" target="_blank" rel="noopener" class="pdf-link">${esc(titulo)} ↗</a></li>`;
  }).join("")}</ul>`;
}

function renderIdentidade(dims) {
  if (!dims?.length) return `<p class="lead">${(state.config.dimensoes || []).join(" · ")}</p>`;
  return dims.map((d) => subAccordion(d.id, d.titulo, esc(d.conteudo))).join("");
}

function renderContato(c, ext) {
  if (!c && !ext?.contato) return "";
  let html = "";
  if (c?.organizacao) html += `<p class="lead">${esc(c.organizacao)}</p>`;
  if (c?.gestores?.length) html += `<p class="section-title">Gestão</p><ul class="content-list">${c.gestores.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>`;
  if (c?.email) html += `<p><a href="mailto:${escAttr(c.email)}">${esc(c.email)}</a></p>`;
  if (c?.endereco) html += c?.maps ? `<p><a href="${escAttr(c.maps)}" target="_blank" rel="noopener">${esc(c.endereco)}</a></p>` : `<p>${esc(c.endereco)}</p>`;
  if (c?.whatsapp) html += `<p><a href="${escAttr(c.whatsapp)}" target="_blank" rel="noopener">WhatsApp →</a></p>`;
  if (c?.maps && !c?.endereco) html += `<p><a href="${escAttr(c.maps)}" target="_blank" rel="noopener">Google Maps →</a></p>`;
  if (ext?.contato) html += verMais(ext.contato, "Contacto no site →");
  return html;
}

/* ── Pagers ── */
function tiPager(tiId, backView = "home", backLabel = "Início") {
  const cur = tiById(tiId);
  if (!cur) return "";
  const p = prevTi(tiId); const n = nextTi(tiId);
  return `<nav class="nav-pager" aria-label="Navegar territórios">
    <button type="button" class="nav-pager-btn" data-nav="ti" data-ti="${p.id}" title="${escAttr(p.nome)}"><span class="nav-arrow">←</span><span class="nav-label">${esc(p.nome)}</span></button>
    <button type="button" class="nav-pager-btn nav-pager-back" data-nav="${backView}"${backView === "ti" ? ` data-ti="${tiId}"` : ""}>← ${esc(backLabel)}</button>
    <button type="button" class="nav-pager-btn" data-nav="ti" data-ti="${n.id}" title="${escAttr(n.nome)}"><span class="nav-label">${esc(n.nome)}</span><span class="nav-arrow">→</span></button>
  </nav>`;
}

function redePager(fichaId) {
  const list = redeOrdenada();
  if (list.length < 2) return "";
  const i = list.findIndex((f) => f.id === fichaId);
  const prev = list[(i - 1 + list.length) % list.length];
  const next = list[(i + 1) % list.length];
  return `<nav class="nav-rede-pager" aria-label="Navegar REDE">
    <button type="button" class="nav-pager-btn" data-nav="ficha" data-ficha="${prev.id}"><span class="nav-arrow">←</span><span class="nav-label">${esc(prev.meta?.nome || prev.id)}</span></button>
    <button type="button" class="nav-rede-pos" data-nav="rede-list" title="Ver lista REDE">REDE ${i + 1}/${list.length}</button>
    <button type="button" class="nav-pager-btn" data-nav="ficha" data-ficha="${next.id}"><span class="nav-label">${esc(next.meta?.nome || next.id)}</span><span class="nav-arrow">→</span></button>
  </nav>`;
}

/* ── Vistas ── */
function renderSobre() {
  const s = state.config.sobre || {};
  let html = "";
  if (s.heading) html += `<p class="lead sobre-heading">${esc(s.heading)}</p>`;
  (s.paragrafos || []).forEach((p) => html += `<p class="lead">${esc(p)}</p>`);
  if (s.secao) html += `<p class="section-title">${esc(s.secao.titulo)}</p><p class="lead">${esc(s.secao.texto)}</p>`;
  if (s.cursos) html += `<p class="lead">${esc(s.cursos.intro)}</p>${verMais(s.cursos.href, `${s.cursos.label} →`)}`;
  html += `<p class="section-title">Fonte geográfica</p><p class="lead">${esc(state.config.fonte?.geografica || "")}</p>`;
  return html;
}

function renderHome() {
  const meta = state.config.rede?.meta || tiList().length;
  const redeLabel = state.config.rede?.label || "REDE";
  const rede = redeOrdenada();
  return `
    ${accordion("sobre", state.config.sobre?.titulo || "Sobre o Mapa", renderSobre(), true)}
    ${accordion("territorios", `${tiList().length} Territórios de Identidade`, renderTiList(), false)}
    ${accordion("rede", `${redeLabel} (${countRede()}/${meta})`, `<p class="lead">Territórios com mapeamento participativo activo.</p>${renderRedeList()}`, rede.length > 0)}
    ${accordion("filtros", "Filtros", renderFilters(), false)}
  `;
}

function renderTerritorio(ti) {
  const fichas = fichasDoTerritorio(ti.id);
  const pontos = state.pontos.filter((p) => p.territorioId === ti.id);
  const lugares = pontos.length
    ? `<ul class="content-list">${pontos.map((p) => `<li>${esc(p.nome)}</li>`).join("")}</ul>`
    : `<p class="empty-rede">Sem lugares mapeados ainda.</p>`;
  return `
    ${tiPager(ti.id, "home", "Início")}
    <div class="ti-header-cod">${esc(ti.cod)} — Território de Identidade</div>
    <h2 class="ti-header-title">${esc(ti.nome)}</h2>
    <p class="lead">Território oficial de planejamento do Estado da Bahia (SEI/SEPLAN · SecultBA).</p>
    ${accordion("identidade", "Identidade do Território", `<p class="section-title">Dimensões</p><p class="lead">${(state.config.dimensoes || []).join(" · ")}</p>`, true)}
    ${accordion("rede-ti", `REDE neste território (${fichas.length})`, fichas.length ? `<ul class="entity-list">${fichas.map((f) => fichaCard(f, "REDE")).join("")}</ul>` : `<p class="empty-rede">Nenhuma ficha mapeada aqui ainda.</p>`, fichas.length > 0)}
    ${accordion("lugares", `Lugares no mapa (${pontos.length})`, lugares, false)}
    ${accordion("territorios-nav", "Ir para outro território", renderTiList(ti.id), false)}
  `;
}

function renderFicha(f, ti) {
  const s = f.sidebar || {};
  const ext = s.externo || {};
  const out = [];
  out.push(accordion("apresentacao", "Apresentação", `<p class="lead">${esc(s.apresentacao || "")}</p>${ext.about ? verMais(ext.about, "Ler mais no site →") : ""}`, true));
  if (s.projetos?.length) out.push(accordion("projetos", `Projetos e lugares (${s.projetos.length})`, renderProjetos(s.projetos), f.tipo === "municipio"));
  out.push(accordion("identidade", "Identidade", renderIdentidade(s.identidade), false));
  if (s.fotos?.length) out.push(accordion("fotos", `Fotos (${s.fotos.length})`, renderFotos(s.fotos), false));
  if (s.videos?.length) out.push(accordion("videos", `Vídeos (${s.videos.length})`, renderVideos(s.videos), false));
  if (s.documentos?.length) out.push(accordion("documentos", `Documentos (${s.documentos.length})`, renderDocumentos(s.documentos), false));
  if (s.produtos?.length || ext.produtos) out.push(accordion("produtos", "Produtos", `${renderList(s.produtos || [])}${verMais(ext.produtos, "Ver todos os produtos →")}`, false));
  if (s.roteiros?.length || ext.reservas) out.push(accordion("roteiros", "Turismo e vivências", `${renderList(s.roteiros || [], "titulo")}${verMais(ext.reservas, "Reservar →")}`, false));
  if (s.portfolio?.length) out.push(accordion("portfolio", "Portfólio", renderPortfolio(s.portfolio), false));
  if (s.festas?.length || ext.eventos) out.push(accordion("festas", "Festas e eventos", `${renderList(s.festas || [])}${verMais(ext.eventos, "Ver eventos →")}`, false));
  if (s.noticias?.length) out.push(accordion("noticias", "Notícias", renderLinks(s.noticias.map((n) => ({ href: n.href, titulo: n.titulo }))), false));
  if (s.redes?.length || s.links?.length || ext.site) {
    const links = [
      ...(ext.site ? [{ href: ext.site, titulo: "Site oficial" }] : []),
      ...(s.redes?.map((r) => ({ href: r.href, titulo: `${r.rede}: ${r.handle}` })) || []),
      ...(s.links || []),
    ];
    out.push(accordion("redes", "Redes e links", renderLinks(links), false));
  }
  out.push(accordion("contato", "Contato", renderContato(s.contato, ext), false));

  const mun = f.meta?.municipio || "";
  const uf = f.meta?.uf ? ` — ${esc(f.meta.uf)}` : "";
  const leadHtml = mun
    ? (f.tipo !== "municipio"
        ? `<a href="#/m/${slugify(mun)}" class="link-mun">${esc(mun)}</a>${uf}`
        : `${esc(mun)}${uf}`)
    : "";

  return `
    ${tiPager(ti.id, "ti", ti.nome)}
    ${redePager(f.id)}
    <div class="ti-header-cod">${esc(ti.cod)} · REDE · ${esc(f.tipo)}</div>
    <h2 class="ti-header-title">${esc(f.meta?.nome || f.id)}</h2>
    <p class="lead">${leadHtml}</p>
    ${out.join("")}
  `;
}

function renderMunicipio(slug) {
  const fichas = fichasDoMunicipio(slug);
  const nome = fichas[0]?.meta?.municipio || slug.replace(/-/g, " ");
  const pontos = state.pontos.filter((p) => slugify(p.nome) === slug || fichas.some((f) => (p.fichaId || p.entidadeId) === f.id));
  return `
    <nav class="nav-pager"><button type="button" class="nav-pager-btn nav-pager-back" data-nav="home">← Início</button></nav>
    <div class="ti-header-cod">Município</div>
    <h2 class="ti-header-title">${esc(nome)}</h2>
    ${accordion("mun-fichas", `Fichas REDE (${fichas.length})`, fichas.length ? `<ul class="entity-list">${fichas.map((f) => fichaCard(f, `TI ${tiById(f.territorioId)?.cod || "—"}`)).join("")}</ul>` : `<p class="empty-rede">Nenhuma ficha neste município.</p>`, true)}
    ${pontos.length ? accordion("mun-lugares", `Lugares (${pontos.length})`, `<ul class="content-list">${pontos.map((p) => `<li>${esc(p.nome)}</li>`).join("")}</ul>`, false) : ""}
  `;
}

/* ── Render principal ── */
export function renderSidebar(route) {
  const el = document.getElementById("sidebar-content");
  if (!el) return;
  if (route.view === "ficha" && route.fichaId) {
    const f = fichaById(route.fichaId);
    const ti = tiById(f?.territorioId);
    el.innerHTML = f && ti ? renderFicha(f, ti) : renderHome();
  } else if (route.view === "ti" && route.tiId) {
    const ti = tiById(route.tiId);
    el.innerHTML = ti ? renderTerritorio(ti) : renderHome();
  } else if (route.view === "municipio" && route.municipio) {
    el.innerHTML = renderMunicipio(route.municipio);
  } else {
    el.innerHTML = renderHome();
  }
  el.scrollTop = 0;
  bindEvents(el, route);
}

function bindEvents(el, route) {
  el.querySelectorAll(".accordion-trigger").forEach((btn) => {
    btn.addEventListener("click", () => {
      const acc = btn.closest(".accordion");
      const open = acc.classList.contains("open");
      el.querySelectorAll(":scope > .accordion.open").forEach((a) => {
        if (a !== acc) { a.classList.remove("open"); a.querySelector(".accordion-trigger")?.setAttribute("aria-expanded", "false"); }
      });
      acc.classList.toggle("open", !open);
      btn.setAttribute("aria-expanded", String(!open));
    });
  });

  el.querySelectorAll(".sub-trigger").forEach((btn) => {
    btn.addEventListener("click", () => {
      const sub = btn.closest(".sub-accordion");
      const open = sub.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
    });
  });

  el.querySelectorAll(".ti-item").forEach((item) => {
    const go = () => { goTerritorio(item.dataset.ti); openForContext(); };
    item.addEventListener("click", go);
    item.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });

  el.querySelectorAll(".entity-card").forEach((card) => {
    const go = () => { goFicha(card.dataset.ficha); openForContext(); };
    card.addEventListener("click", go);
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });

  el.querySelectorAll("[data-filter]").forEach((chip) => {
    chip.addEventListener("click", () => {
      toggleFilter(chip.dataset.filter);
      refreshVisibility();
      renderSidebar(route);
    });
  });

  el.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nav = btn.dataset.nav;
      if (nav === "home") goHome();
      else if (nav === "ti") { goTerritorio(btn.dataset.ti); openForContext(); }
      else if (nav === "ficha") { goFicha(btn.dataset.ficha); openForContext(); }
      else if (nav === "rede-list") openRedePanel();
    });
  });

  el.querySelectorAll(".media-thumb[data-photo]").forEach((thumb) => {
    thumb.addEventListener("click", () => {
      const grid = thumb.closest(".media-grid");
      const list = [...grid.querySelectorAll(".media-thumb")].map((t) => ({ src: t.dataset.src, legenda: t.dataset.legenda }));
      openLightbox(list, Number(thumb.dataset.idx) || 0);
    });
  });

  el.querySelectorAll('a[target="_blank"]').forEach((a) => {
    a.addEventListener("click", () => { if (isMobile()) closeSheet(); });
  });
}

export function expandAccordion(id) {
  const el = document.getElementById("sidebar-content");
  const acc = el?.querySelector(`.accordion[data-acc="${id}"]`);
  if (!acc) return;
  el.querySelectorAll(":scope > .accordion.open").forEach((a) => {
    if (a !== acc) { a.classList.remove("open"); a.querySelector(".accordion-trigger")?.setAttribute("aria-expanded", "false"); }
  });
  acc.classList.add("open");
  acc.querySelector(".accordion-trigger")?.setAttribute("aria-expanded", "true");
  acc.querySelector(".accordion-trigger")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

export function openRedePanel() {
  openForContext();
  if (parseRoute().view !== "home") goHome();
  setTimeout(() => expandAccordion("rede"), 60);
}

export function initSidebarKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (!e.target.closest?.(".sidebar-content")) return;
    const triggers = [...document.querySelectorAll(".sidebar-content .accordion-trigger")];
    const idx = triggers.indexOf(document.activeElement);
    if (e.key === "ArrowDown" && idx >= 0 && idx < triggers.length - 1) { e.preventDefault(); triggers[idx + 1].focus(); }
    if (e.key === "ArrowUp" && idx > 0) { e.preventDefault(); triggers[idx - 1].focus(); }
  });
}
