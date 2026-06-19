import {
  state, tiById, fichaById, fichasDoTerritorio, fichasDoMunicipio,
  redeOrdenada, countRede, toggleFilter, listPontosCultura, listTeiaDosPovos,
  setPontoCulturaFilter, setTeiaDosPovosFilter, clearAllFilters, selectAllFilters,
} from "../core/state.js";
import { goHome, goTerritorio, goFicha, goMunicipio, goPontosCultura, goTeiaDosPovos, parseRoute } from "../core/router.js";
import { esc, escAttr, slugify } from "../core/util.js";
import { isMobile, openForContext, setDesktopCollapsed, closeSheet } from "./shell.js";
import { refreshVisibility, focusPonto } from "../map/markers.js";
import { focusRoteiro, focusRouteStop, getRoteiroParadas } from "../map/map.js";
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

function tipoLabel(tipo) {
  return ({ municipio: "Município", quilombo: "Quilombo", instituicao: "Instituição", projeto: "Projeto", comunidade: "Comunidade" })[tipo] || tipo;
}

function fichaBadge(f) {
  if (f.teiaDosPovos) return "Teia dos Povos";
  return tipoLabel(f.tipo);
}

function pinBadge(p) {
  const f = fichaById(p.fichaId || p.entidadeId);
  if (f?.teiaDosPovos) return "Teia dos Povos";
  if (p.categorias?.includes("municipios")) return "Município";
  if (p.categorias?.includes("quilombos")) return "Quilombo";
  if (p.categorias?.includes("instituicoes")) return "Instituição";
  if (p.categorias?.includes("projetos")) return "Projeto";
  return "Lugar";
}

/* Card de um ponto do mapa: sempre clicável (foca pin no mapa).
   Se tiver ficha compatível, no desktop navega também para a ficha. */
function pinCard(p) {
  const f = fichaById(p.fichaId || p.entidadeId);
  const nomesIguais = f && slugify(f.meta?.nome || "") === slugify(p.nome);
  const ligar = f && (f.tipo !== "municipio" || nomesIguais);
  const fichaAttr = ligar ? ` data-ficha="${escAttr(f.id)}"` : "";
  return `<li class="entity-card"${fichaAttr} data-ponto="${escAttr(p.id)}" tabindex="0" role="button">
    <span class="entity-badge">${esc(pinBadge(p))}</span>
    <span class="entity-name">${esc(p.nome)}</span>
    <span class="entity-arrow">→</span>
  </li>`;
}

/* Pontos cujo entidadeId/fichaId aponta para esta ficha. */
function pontosDaFicha(fichaId) {
  return state.pontos.filter((p) => (p.entidadeId || p.fichaId) === fichaId);
}

/* Territórios da REDE: lista explícita do config (ordem por código),
   com fallback para os territórios marcados como activos. */
function redeTerritorios() {
  const ids = state.config.rede?.territorios || [];
  const fromCfg = ids.map((id) => tiById(id)).filter(Boolean);
  const list = fromCfg.length ? fromCfg : state.territorios.filter((t) => t.redeAtiva);
  return [...list].sort((a, b) => Number(a.cod) - Number(b.cod));
}

/* Lugares mapeados de um território, sem repetir: fichas primeiro,
   depois pins (quilombos e municípios em destaque). */
function lugaresDoTerritorio(tiId) {
  const rank = (p) => (p.categorias?.includes("quilombos") ? 0 : p.categorias?.includes("municipios") ? 1 : 2);
  const pins = state.pontos.filter((p) => p.territorioId === tiId).sort((a, b) => rank(a) - rank(b));
  const nomes = [];
  const seen = new Set();
  const add = (n) => { const k = slugify(n || ""); if (!n || seen.has(k)) return; seen.add(k); nomes.push(n); };
  fichasDoTerritorio(tiId).forEach((f) => add(f.meta?.nome));
  pins.forEach((p) => add(p.nome));
  return nomes;
}

/* Lista clicável para a ficha do território: pins + fichas só com coords (stubs novos). */
function lugaresCardsDoTerritorio(tiId) {
  const rank = (p) => (p.categorias?.includes("quilombos") ? 0 : p.categorias?.includes("municipios") ? 1 : 2);
  const pins = state.pontos.filter((p) => p.territorioId === tiId).sort((a, b) => rank(a) - rank(b));
  const referenced = new Set(pins.map((p) => p.fichaId || p.entidadeId).filter(Boolean));
  const cards = [];

  fichasDoTerritorio(tiId).forEach((f) => {
    if (!f.meta?.coords || referenced.has(f.id)) return;
    cards.push(fichaCard(f, fichaBadge(f)));
  });
  pins.forEach((p) => cards.push(pinCard(p)));
  return cards;
}

function redeTerritorioCard(t) {
  const lugares = lugaresDoTerritorio(t.id);
  const shown = lugares.slice(0, 6).join(" · ");
  const extra = lugares.length > 6 ? ` +${lugares.length - 6}` : "";
  const sub = lugares.length
    ? `<span class="rede-ti-lugares">${esc(shown)}${esc(extra)}</span>`
    : `<span class="rede-ti-lugares muted">Mapeamento em curso</span>`;
  return `<li class="entity-card rede-ti-card" data-ti="${t.id}" tabindex="0" role="button">
    <span class="entity-badge">TI ${esc(t.cod)}</span>
    <span class="entity-name">${esc(t.nome)}${sub}</span>
    <span class="entity-arrow">→</span>
  </li>`;
}

function renderRedeList() {
  const list = redeTerritorios();
  if (!list.length) return `<p class="empty-rede">Nenhum território mapeado ainda.</p>`;
  return `<ul class="entity-list">${list.map(redeTerritorioCard).join("")}</ul>`;
}

function renderFilters() {
  const cats = state.config.categorias || {};
  const chips = (state.config.filtros || []).map((g) => `
    <div class="filter-group">
      <div class="filter-label">${esc(g.label)}</div>
      <div class="filter-chips">${g.items.map((k) => {
        const c = cats[k] || {};
        return `<button type="button" class="chip${state.filters.has(k) ? " active" : ""}" data-filter="${escAttr(k)}">
          <span class="chip-dot" style="background:${c.cor || "#999"}"></span>${esc(c.label || k)}</button>`;
      }).join("")}</div>
    </div>`).join("");
  return `${chips}
    <div class="filter-actions">
      <button type="button" class="chip chip-muted" data-filter-none>Desmarcar tudo</button>
      <button type="button" class="chip chip-muted" data-filter-all>Marcar tudo</button>
    </div>`;
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

function renderApresentacao(s, ext) {
  const logo = s.logo?.src
    ? `<img class="ficha-logo" src="${escAttr(s.logo.src)}" alt="${escAttr(s.logo.alt || "")}" loading="lazy" decoding="async">`
    : "";
  const text = s.apresentacao ? `<p class="lead">${esc(s.apresentacao)}</p>` : "";
  return `${logo}${text}${ext.about ? verMais(ext.about, "Ler mais no site →") : ""}`;
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

function roteiroCard(roteiroId, titulo) {
  const paradas = getRoteiroParadas(roteiroId)
    .slice()
    .sort((a, b) => (a.properties.ordem || 99) - (b.properties.ordem || 99));
  const paradasHtml = paradas.length
    ? `<ul class="entity-list paradas-list">${paradas.map((p) => `<li class="entity-card" data-stop="${escAttr(p.properties.id)}" tabindex="0" role="button">
        <span class="entity-badge">Parada ${p.properties.ordem || "·"}</span>
        <span class="entity-name">${esc(p.properties.nome)}</span>
        <span class="entity-arrow">→</span>
      </li>`).join("")}</ul>`
    : "";
  return `<ul class="entity-list"><li class="entity-card" data-roteiro="${escAttr(roteiroId)}" tabindex="0" role="button">
    <span class="entity-badge">Roteiro</span>
    <span class="entity-name">${esc(titulo)}</span>
    <span class="entity-arrow">→</span>
  </li></ul>${paradasHtml}`;
}

function renderList(items, key = "nome") {
  if (!items?.length) return `<p class="empty-rede">Conteúdo em breve.</p>`;
  const out = [];
  const cards = [];
  const rest = [];
  items.forEach((i) => {
    const nome = i[key] || i.titulo || i.nome || "";
    if (i.roteiroId) {
      out.push(roteiroCard(i.roteiroId, nome));
    } else if (i.pontoId) {
      cards.push(pontoCard(i.pontoId, nome));
    } else {
      rest.push(`<li>${esc(nome)}${i.descricao ? ` — <span class="muted">${esc(i.descricao)}</span>` : ""}</li>`);
    }
  });
  return `${out.join("")}${cards.length ? `<ul class="entity-list">${cards.join("")}</ul>` : ""}${rest.length ? `<ul class="content-list">${rest.join("")}</ul>` : ""}`;
}

function pontoCard(pontoId, titulo) {
  return `<li class="entity-card" data-ponto="${escAttr(pontoId)}" tabindex="0" role="button">
    <span class="entity-badge">Ver no mapa</span>
    <span class="entity-name">${esc(titulo)}</span>
    <span class="entity-arrow">→</span>
  </li>`;
}

function renderProjetos(items) {
  if (!items?.length) return `<p class="empty-rede">Nenhum projeto mapeado ainda.</p>`;
  const out = [];
  const cards = [];
  const rest = [];
  items.forEach((p) => {
    const f = p.fichaId ? fichaById(p.fichaId) : null;
    if (f) cards.push(fichaCard(f, fichaBadge(f)));
    else if (p.roteiroId) out.push(roteiroCard(p.roteiroId, p.titulo));
    else if (p.pontoId) cards.push(pontoCard(p.pontoId, p.titulo));
    else rest.push(`<li><strong>${esc(p.titulo)}</strong>${p.descricao ? `<br><span class="muted">${esc(p.descricao)}</span>` : ""}</li>`);
  });
  if (!cards.length && !rest.length && !out.length) return `<p class="empty-rede">Nenhum projeto mapeado ainda.</p>`;
  return `${out.join("")}${cards.length ? `<ul class="entity-list">${cards.join("")}</ul>` : ""}${rest.length ? `<ul class="content-list">${rest.join("")}</ul>` : ""}`;
}

function renderLinks(items) {
  if (!items?.length) return "";
  return `<ul class="link-list">${items.map((i) => `<li><a href="${escAttr(i.href)}" target="_blank" rel="noopener">${esc(i.titulo || i.handle || i.href)}</a></li>`).join("")}</ul>`;
}

function renderPortfolio(items) {
  if (!items?.length) return `<p class="empty-rede">Portfólio em breve.</p>`;
  return `<ul class="link-list">${items.map((i) => `<li><a href="${escAttr(i.href)}" target="_blank" rel="noopener" class="pdf-link">${esc(i.titulo)} ↗</a></li>`).join("")}</ul>`;
}

function renderPesquisas(items) {
  if (!items?.length) return "";
  return `<ul class="link-list">${items.map((i) => {
    const meta = [i.autores, i.ano].filter(Boolean).join(" · ");
    return `<li><a href="${escAttr(i.href)}" target="_blank" rel="noopener" class="pdf-link">${esc(i.titulo)} ↗</a>${meta ? `<span class="pesquisa-meta">${esc(meta)}</span>` : ""}</li>`;
  }).join("")}</ul>`;
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
  if (c?.instagram) {
    const ig = typeof c.instagram === "string" ? { href: c.instagram, handle: "Instagram" } : c.instagram;
    if (ig?.href) html += `<p><a href="${escAttr(ig.href)}" target="_blank" rel="noopener">${esc(ig.handle || "Instagram")} →</a></p>`;
  }
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
  const rede = redeTerritorios();
  const pcs = listPontosCultura();
  const teia = listTeiaDosPovos();
  const pcList = pcs.length
    ? `<p class="lead">Lugares reconhecidos pelo programa Ponto de Cultura. Toque para ver no mapa.</p>
       <ul class="entity-list">${pcs.map(pcCard).join("")}</ul>
       <p class="ver-mais-wrap"><button type="button" class="link-btn" data-nav="pontos-cultura">Ver todos (${pcs.length}) →</button></p>`
    : `<p class="empty-rede">Mapeamento em curso.</p>`;
  const teiaList = teia.length
    ? `<p class="lead">Rede de comunidades tradicionais, quilombos e povos originários. Toque para ver no mapa.</p>
       <ul class="entity-list">${teia.map(teiaCard).join("")}</ul>
       <p class="ver-mais-wrap"><button type="button" class="link-btn" data-nav="teia-dos-povos">Ver todos (${teia.length}) →</button></p>`
    : `<p class="empty-rede">Mapeamento em curso.</p>`;
  return `
    ${accordion("sobre", state.config.sobre?.titulo || "Sobre o Mapa", renderSobre(), true)}
    ${accordion("pontos-cultura", `Pontos de Cultura (${pcs.length})`, pcList, false)}
    ${accordion("teia-dos-povos", `Teia dos Povos (${teia.length})`, teiaList, false)}
    ${accordion("territorios", `${tiList().length} Territórios de Identidade`, renderTiList(), false)}
    ${accordion("rede", `${redeLabel} (${countRede()}/${meta})`, `<p class="lead">Territórios da rede com mapeamento participativo. Toque para abrir cada território e ver os lugares no mapa.</p>${renderRedeList()}`, rede.length > 0)}
    ${accordion("filtros", "Filtros", renderFilters(), false)}
  `;
}

function pcCard(pc) {
  const sub = [pc.municipio, pc.tiNome].filter(Boolean).join(" · ");
  const attrs = [
    pc.pontoId ? `data-ponto="${escAttr(pc.pontoId)}"` : "",
    pc.fichaId ? `data-ficha="${escAttr(pc.fichaId)}"` : "",
    `data-pc="1"`,
  ].filter(Boolean).join(" ");
  return `<li class="entity-card" ${attrs} tabindex="0" role="button">
    <span class="entity-badge">★ PC</span>
    <span class="entity-name">${esc(pc.nome)}${sub ? `<span class="entity-sub">${esc(sub)}</span>` : ""}</span>
    <span class="entity-arrow">→</span>
  </li>`;
}

function teiaCard(item) {
  const sub = [item.municipio, item.tiNome].filter(Boolean).join(" · ");
  const attrs = [
    item.pontoId ? `data-ponto="${escAttr(item.pontoId)}"` : "",
    item.fichaId ? `data-ficha="${escAttr(item.fichaId)}"` : "",
    `data-teia="1"`,
  ].filter(Boolean).join(" ");
  return `<li class="entity-card" ${attrs} tabindex="0" role="button">
    <span class="entity-badge">🕸 Teia</span>
    <span class="entity-name">${esc(item.nome)}${sub ? `<span class="entity-sub">${esc(sub)}</span>` : ""}</span>
    <span class="entity-arrow">→</span>
  </li>`;
}

function renderTeiaDosPovos() {
  const teia = listTeiaDosPovos();
  const list = teia.length
    ? `<ul class="entity-list">${teia.map(teiaCard).join("")}</ul>`
    : `<p class="empty-rede">Nenhum lugar da Teia mapeado ainda.</p>`;
  return `
    <nav class="nav-pager"><button type="button" class="nav-pager-btn nav-pager-back" data-nav="home">← Início</button></nav>
    <div class="ti-header-cod">🕸 Teia dos Povos</div>
    <h2 class="ti-header-title">Teia dos Povos no mapa</h2>
    <p class="lead">Rede de povos indígenas, quilombolas, terreiros e comunidades tradicionais. Toque para focar no mapa.</p>
    ${accordion("lista-teia", `Lugares (${teia.length})`, list, true)}
  `;
}

function renderPontosCultura() {
  const pcs = listPontosCultura();
  const list = pcs.length
    ? `<ul class="entity-list">${pcs.map(pcCard).join("")}</ul>`
    : `<p class="empty-rede">Nenhum Ponto de Cultura mapeado ainda.</p>`;
  return `
    <nav class="nav-pager"><button type="button" class="nav-pager-btn nav-pager-back" data-nav="home">← Início</button></nav>
    <div class="ti-header-cod">★ Ponto de Cultura</div>
    <h2 class="ti-header-title">Pontos de Cultura no mapa</h2>
    <p class="lead">Programa de fomento à cultura viva. Toque num lugar para o mapa focar o pin — no telemóvel o painel fecha e mostra o vídeo ou a ficha no popup.</p>
    ${accordion("lista-pc", `Lugares (${pcs.length})`, list, true)}
  `;
}

function renderTerritorio(ti) {
  const cards = lugaresCardsDoTerritorio(ti.id);
  const lugares = cards.length
    ? `<ul class="entity-list">${cards.join("")}</ul>`
    : `<p class="empty-rede">Sem lugares mapeados ainda.</p>`;
  return `
    ${tiPager(ti.id, "home", "Início")}
    <div class="ti-header-cod">${esc(ti.cod)} — Território de Identidade</div>
    <h2 class="ti-header-title">${esc(ti.nome)}</h2>
    <p class="lead">Território oficial de planejamento do Estado da Bahia (SEI/SEPLAN · SecultBA).</p>
    ${accordion("identidade", "Identidade do Território", `<p class="section-title">Dimensões</p><p class="lead">${(state.config.dimensoes || []).join(" · ")}</p>`, true)}
    ${accordion("lugares", `Lugares no mapa (${cards.length})`, lugares, true)}
    ${accordion("territorios-nav", "Ir para outro território", renderTiList(ti.id), false)}
  `;
}

function renderFichaSemTerritorio(f) {
  const s = f.sidebar || {};
  const mun = f.meta?.municipio || "";
  const uf = f.meta?.uf ? ` — ${esc(f.meta.uf)}` : "";
  return `
    <nav class="nav-pager"><button type="button" class="nav-pager-btn nav-pager-back" data-nav="home">← Início</button></nav>
    <div class="ti-header-cod">${esc(tipoLabel(f.tipo))}</div>
    <h2 class="ti-header-title">${esc(f.meta?.nome || f.id)}</h2>
    ${mun ? `<p class="lead">${esc(mun)}${uf}</p>` : ""}
    ${s.apresentacao ? accordion("apresentacao", "Apresentação", esc(s.apresentacao), true) : ""}
  `;
}

function renderFicha(f, ti) {
  const s = f.sidebar || {};
  const ext = s.externo || {};
  const out = [];
  out.push(accordion("apresentacao", "Apresentação", renderApresentacao(s, ext), true));
  if (s.projetos?.length) out.push(accordion("projetos", `Projetos e lugares (${s.projetos.length})`, renderProjetos(s.projetos), f.tipo === "municipio"));
  out.push(accordion("identidade", "Identidade", renderIdentidade(s.identidade), false));
  if (s.fotos?.length) out.push(accordion("fotos", `Fotos (${s.fotos.length})`, renderFotos(s.fotos), false));
  if (s.videos?.length) out.push(accordion("videos", `Vídeos (${s.videos.length})`, renderVideos(s.videos), false));
  if (s.documentos?.length && !s.portfolio?.length && !s.pesquisas?.length) out.push(accordion("documentos", `Documentos (${s.documentos.length})`, renderDocumentos(s.documentos), false));
  if (s.produtos?.length || ext.produtos) out.push(accordion("produtos", "Produtos", `${renderList(s.produtos || [])}${verMais(ext.produtos, "Ver todos os produtos →")}`, false));
  if (s.roteiros?.length || ext.reservas) out.push(accordion("roteiros", "Turismo e vivências", `${renderList(s.roteiros || [], "titulo")}${verMais(ext.reservas, "Reservar →")}`, false));
  if (s.portfolio?.length) out.push(accordion("portfolio", "Portfólio", renderPortfolio(s.portfolio), false));
  if (s.pesquisas?.length) out.push(accordion("pesquisas", `Pesquisas e Artigos (${s.pesquisas.length})`, renderPesquisas(s.pesquisas), false));
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
  const lugarPins = pontosDaFicha(f.id);
  if (lugarPins.length) out.push(accordion("lugares", `Lugares no mapa (${lugarPins.length})`, `<ul class="entity-list">${lugarPins.map(pinCard).join("")}</ul>`, true));
  out.push(accordion("contato", "Contato", renderContato(s.contato, ext), false));

  const mun = f.meta?.municipio || "";
  const uf = f.meta?.uf ? ` — ${esc(f.meta.uf)}` : "";
  const leadHtml = mun
    ? (f.tipo !== "municipio"
        ? `<a href="#/m/${slugify(mun)}" class="link-mun">${esc(mun)}</a>${uf}`
        : `${esc(mun)}${uf}`)
    : "";

  return `
    ${tiPager(ti.id, "ti", "Território")}
    ${redePager(f.id)}
    <div class="ti-header-cod">REDE · ${esc(tipoLabel(f.tipo))}</div>
    <h2 class="ti-header-title">${esc(f.meta?.nome || f.id)}</h2>
    ${f.pontoCultura ? `<p class="ficha-pc-badge"><span class="ficha-pc-star">★</span> Ponto de Cultura${typeof f.pontoCultura === "string" ? ` ${esc(f.pontoCultura)}` : ""}</p>` : ""}
    ${f.teiaDosPovos ? `<p class="ficha-teia-badge"><span class="ficha-teia-mark">🕸</span> Teia dos Povos</p>` : ""}
    ${f.pontoCultura ? `<p class="lead"><button type="button" class="link-btn" data-nav="pontos-cultura">Ver todos os Pontos de Cultura no mapa →</button></p>` : ""}
    ${f.teiaDosPovos ? `<p class="lead"><button type="button" class="link-btn" data-nav="teia-dos-povos">Ver todos os lugares da Teia dos Povos →</button></p>` : ""}
    <p class="lead">${leadHtml}</p>
    <p class="ti-header-sub"><a href="#/ti/${escAttr(ti.id)}" class="link-territorio">← ${esc(ti.cod)} · ${esc(ti.nome)}</a></p>
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
    ${accordion("mun-fichas", `Fichas REDE (${fichas.length})`, fichas.length ? `<ul class="entity-list">${fichas.map((f) => fichaCard(f, fichaBadge(f))).join("")}</ul>` : `<p class="empty-rede">Nenhuma ficha neste município.</p>`, true)}
    ${pontos.length ? accordion("mun-lugares", `Lugares (${pontos.length})`, `<ul class="entity-list">${pontos.map(pinCard).join("")}</ul>`, false) : ""}
  `;
}

/* ── Render principal ── */
export function renderSidebar(route) {
  const el = document.getElementById("sidebar-content");
  if (!el) return;
  if (route.view === "ficha" && route.fichaId) {
    const f = fichaById(route.fichaId);
    const ti = tiById(f?.territorioId);
    el.innerHTML = f ? (ti ? renderFicha(f, ti) : renderFichaSemTerritorio(f)) : renderHome();
  } else if (route.view === "ti" && route.tiId) {
    const ti = tiById(route.tiId);
    el.innerHTML = ti ? renderTerritorio(ti) : renderHome();
  } else if (route.view === "municipio" && route.municipio) {
    el.innerHTML = renderMunicipio(route.municipio);
  } else if (route.view === "pontos-cultura") {
    el.innerHTML = renderPontosCultura();
  } else if (route.view === "teia-dos-povos") {
    el.innerHTML = renderTeiaDosPovos();
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

  /* Fichas e territórios puros (sem pin de mapa associado) */
  el.querySelectorAll(".entity-card[data-ficha]:not([data-ponto]), .entity-card[data-ti]").forEach((card) => {
    const go = () => {
      if (card.dataset.ficha) goFicha(card.dataset.ficha);
      else if (card.dataset.ti) goTerritorio(card.dataset.ti);
      else return;
      openForContext();
    };
    card.addEventListener("click", go);
    card.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });

  /* Todos os items com data-ponto: foca o pin no mapa.
     Mobile → fecha o sidebar.
     Desktop → se tiver ficha, navega também para a ficha no sidebar. */
  el.querySelectorAll("[data-ponto]").forEach((item) => {
    const go = () => {
      focusPonto(item.dataset.ponto);
      if (isMobile()) {
        closeSheet();
      } else if (item.dataset.ficha) {
        goFicha(item.dataset.ficha);
        openForContext();
      }
    };
    item.addEventListener("click", go);
    item.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });

  /* data-roteiro: enquadra o mapa na rota inteira. Mobile fecha sidebar. */
  el.querySelectorAll("[data-roteiro]").forEach((item) => {
    const go = () => {
      focusRoteiro(item.dataset.roteiro);
      if (isMobile()) closeSheet();
    };
    item.addEventListener("click", go);
    item.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });

  /* data-stop: foca uma parada do roteiro no mapa. Mobile fecha sidebar. */
  el.querySelectorAll("[data-stop]").forEach((item) => {
    const go = () => {
      focusRouteStop(item.dataset.stop);
      if (isMobile()) closeSheet();
    };
    item.addEventListener("click", go);
    item.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });

  el.querySelectorAll("[data-filter]").forEach((chip) => {
    chip.addEventListener("click", () => {
      toggleFilter(chip.dataset.filter);
      refreshVisibility();
      renderSidebar(route);
    });
  });
  el.querySelector("[data-filter-none]")?.addEventListener("click", () => {
    clearAllFilters();
    refreshVisibility();
    focusRoteiro("contra-costa");
    renderSidebar(route);
  });
  el.querySelector("[data-filter-all]")?.addEventListener("click", () => {
    selectAllFilters();
    refreshVisibility();
    renderSidebar(route);
  });

  el.querySelectorAll("[data-pc]").forEach((item) => {
    const go = () => {
      setPontoCulturaFilter(true);
      refreshVisibility();
      if (item.dataset.ponto) focusPonto(item.dataset.ponto);
      if (item.dataset.ficha) goFicha(item.dataset.ficha);
      if (isMobile()) closeSheet();
    };
    item.addEventListener("click", go);
    item.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });

  el.querySelectorAll("[data-teia]").forEach((item) => {
    const go = () => {
      setTeiaDosPovosFilter(true);
      refreshVisibility();
      if (item.dataset.ponto) focusPonto(item.dataset.ponto);
      if (item.dataset.ficha) goFicha(item.dataset.ficha);
      if (isMobile()) closeSheet();
    };
    item.addEventListener("click", go);
    item.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
  });

  el.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const nav = btn.dataset.nav;
      if (nav === "home") goHome();
      else if (nav === "pontos-cultura") { setPontoCulturaFilter(true); refreshVisibility(); goPontosCultura(); openForContext(); }
      else if (nav === "teia-dos-povos") { setTeiaDosPovosFilter(true); refreshVisibility(); goTeiaDosPovos(); openForContext(); }
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
