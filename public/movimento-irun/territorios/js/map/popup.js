import { escAttr, esc, slugify } from "../core/util.js";
import { state, isPontoCultura, isTeiaDosPovos } from "../core/state.js";
import { openLightbox } from "../ui/lightbox.js";

const YT = "rel=0&modestbranding=1&iv_load_policy=3";

function fichaOf(entry) {
  const id = entry.fichaId || entry.entidadeId;
  return id ? state.fichaById?.[id] : null;
}

function fichaYoutubeVideos(entry) {
  return (fichaOf(entry)?.sidebar?.videos || []).filter((v) => v.tipo === "youtube" && v.id);
}

function videoSlide(v, entry) {
  return {
    video: { tipo: "youtube", id: v.id, legenda: v.titulo || entry.nome },
  };
}

/* Ficha com vídeos → popup rico no pin (slides só com vídeo, sem texto). */
function mergeFichaVideos(entry) {
  const fromFicha = fichaYoutubeVideos(entry);
  if (!fromFicha.length) return entry.popup;

  const slides = entry.popup?.slides || [];
  const inPopup = new Set(slides.filter((s) => s.video?.id).map((s) => s.video.id));

  if (!slides.length) {
    return {
      contexto: entry.nome,
      slides: fromFicha.map((v) => videoSlide(v, entry)),
    };
  }

  if (!inPopup.size) {
    return {
      ...entry.popup,
      contexto: entry.popup.contexto || entry.nome,
      slides: [...slides, ...fromFicha.map((v) => videoSlide(v, entry))],
    };
  }

  const missing = fromFicha.filter((v) => !inPopup.has(v.id));
  if (!missing.length) return entry.popup;
  return {
    ...entry.popup,
    slides: [...slides, ...missing.map((v) => videoSlide(v, entry))],
  };
}

function withPopup(entry) {
  const popup = mergeFichaVideos(entry);
  if (!popup?.slides?.length) return entry;
  return { ...entry, popup };
}

export function hasRich(entry) {
  const popup = mergeFichaVideos(entry);
  return Array.isArray(popup?.slides) && popup.slides.length > 0;
}

/* Só liga "Ver ficha" quando faz sentido: nunca aponta um lugar distinto
   para a ficha de um município com outro nome (ex.: Casa das Rendeiras → Saubara). */
function fichaLinkId(entry) {
  const id = entry.fichaId || entry.entidadeId;
  if (!id) return null;
  const f = state.fichaById?.[id];
  if (!f) return null;
  // Bloqueia o link só quando o vínculo é implícito (entidadeId) e o nome do
  // pin difere do município. Um fichaId explícito é intencional e sempre liga.
  if (!entry.fichaId && f.tipo === "municipio" && slugify(f.meta?.nome || "") !== slugify(entry.nome || "")) return null;
  return id;
}

function entryBadges(entry) {
  const f = fichaOf(entry);
  return {
    pc: !!(entry.pontoCultura || isPontoCultura(entry, f)),
    teia: !!(entry.teiaDosPovos || isTeiaDosPovos(entry, f)),
  };
}

function popupTagsHtml(entry) {
  const { pc, teia } = entryBadges(entry);
  if (!pc && !teia) return "";
  const tags = [];
  if (pc) tags.push('<span class="popup-pc-tag">★ Ponto de Cultura</span>');
  if (teia) tags.push('<span class="popup-teia-tag">🕸 Teia dos Povos</span>');
  return `<div class="popup-tags">${tags.join("")}</div>`;
}

function bestLink(links = []) {
  const clean = links.filter((u) => !/designdialogico|googleusercontent|usercontent\.google\.com|gstatic|google\.com\/maps\/d\/.*embed/i.test(u));
  return clean.find((u) => /youtube\.com|youtu\.be|instagram\.com|\.net|\.com\.br/i.test(u)) || clean[0];
}

export function popupHtml(entry) {
  const e = withPopup(entry);
  if (hasRich(e)) return richPopupHtml(e);
  const link = bestLink(entry.links || []);
  const fichaId = fichaLinkId(entry);
  return `<div class="popup-title">${esc(entry.nome)}</div>
    ${popupTagsHtml(entry)}
    ${entry.resumo ? `<div class="popup-cod">${esc(entry.resumo)}</div>` : ""}
    ${link ? `<a class="popup-link" href="${escAttr(link)}" target="_blank" rel="noopener">Saiba mais →</a>` : ""}
    ${fichaId ? `<span class="popup-link" data-ficha="${escAttr(fichaId)}">Ver ficha →</span>` : ""}`;
}

export function popupOptions(entry) {
  const e = withPopup(entry);
  if (hasRich(e)) {
    return {
      maxWidth: 320,
      minWidth: 260,
      className: "irun-popup irun-popup-rich",
      autoPanPaddingTopLeft: L.point(14, 84),
      autoPanPaddingBottomRight: L.point(14, 84),
      keepInView: true,
    };
  }
  return {
    maxWidth: 260,
    className: "irun-popup",
    autoPanPaddingTopLeft: L.point(14, 84),
    autoPanPaddingBottomRight: L.point(14, 70),
    keepInView: true,
  };
}

function slideBody(slide, eager) {
  let html = "";
  if (slide.titulo) html += `<h3 class="popup-rich-title">${esc(slide.titulo)}</h3>`;
  if (slide.video?.tipo === "youtube" && slide.video.id) {
    html += eager
      ? `<div class="popup-rich-video"><iframe src="https://www.youtube-nocookie.com/embed/${escAttr(slide.video.id)}?${YT}" title="${escAttr(slide.video.legenda || slide.titulo)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
      : `<div class="popup-rich-video" data-yt-id="${escAttr(slide.video.id)}" data-yt-title="${escAttr(slide.video.legenda || slide.titulo)}"></div>`;
  }
  if (slide.texto) html += `<p class="popup-rich-text">${esc(slide.texto)}</p>`;
  if (slide.foto) html += `<button class="popup-rich-thumb" data-lb-src="${escAttr(slide.foto)}" data-lb-cap="${escAttr(slide.legenda || slide.titulo)}" type="button" aria-label="Ver foto em tela cheia"><img src="${escAttr(slide.foto)}" alt="${escAttr(slide.legenda || slide.titulo)}" loading="lazy" decoding="async"><span class="popup-rich-expand" aria-hidden="true">⛶</span></button>`;
  if (slide.legenda && !slide.foto) html += `<p class="popup-rich-caption">${esc(slide.legenda)}</p>`;
  return html;
}

export function richPopupHtml(entry) {
  const slides = entry.popup.slides;
  const ctx = entry.popup.contexto || entry.nome;
  const n = slides.length;
  const fichaId = fichaLinkId(entry);
  const subtitle = ctx && ctx !== entry.nome ? `<div class="popup-rich-ctx">${esc(ctx)}</div>` : "";
  return `<div class="irun-rich-popup" data-slides="${n}">
    <h3 class="popup-title popup-rich-head">${esc(entry.nome)}</h3>
    ${popupTagsHtml(entry)}
    ${subtitle}
    <div class="popup-rich-viewport">
      ${slides.map((s, i) => `<div class="popup-rich-slide${i === 0 ? " active" : ""}" data-idx="${i}">${slideBody(s, i === 0)}</div>`).join("")}
    </div>
    ${fichaId ? `<span class="popup-link" data-ficha="${escAttr(fichaId)}">Ver ficha →</span>` : ""}
    ${n > 1 ? `<div class="popup-rich-nav">
      <button type="button" class="popup-rich-btn popup-rich-prev" aria-label="Anterior">←</button>
      <span class="popup-rich-pos">1 de ${n}</span>
      <button type="button" class="popup-rich-btn popup-rich-next" aria-label="Próximo">→</button>
    </div>` : ""}
  </div>`;
}

function mountVideo(slideEl) {
  const box = slideEl?.querySelector(".popup-rich-video[data-yt-id]:not([data-ready])");
  if (!box) return;
  box.dataset.ready = "1";
  box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${box.dataset.ytId}?${YT}" title="${escAttr(box.dataset.ytTitle)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
}

export function initRichPopup(popupEl) {
  const root = popupEl?.querySelector(".irun-rich-popup");
  if (!root) return;
  L.DomEvent.disableClickPropagation(root);

  const slides = [...root.querySelectorAll(".popup-rich-slide")];
  if (!slides.length) return;
  const pos = root.querySelector(".popup-rich-pos");
  let idx = Math.max(0, slides.findIndex((s) => s.classList.contains("active")));

  const show = (i) => {
    idx = (i + slides.length) % slides.length;
    slides.forEach((s, j) => s.classList.toggle("active", j === idx));
    if (pos) pos.textContent = `${idx + 1} de ${slides.length}`;
    mountVideo(slides[idx]);
  };

  mountVideo(slides[idx]);

  root.querySelectorAll(".popup-rich-thumb").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const src = btn.dataset.lbSrc;
      const cap = btn.dataset.lbCap || "";
      if (src) openLightbox([{ src, legenda: cap }], 0);
    });
  });

  if (slides.length < 2) return;
  root.querySelector(".popup-rich-prev")?.addEventListener("click", (e) => { e.stopPropagation(); show(idx - 1); });
  root.querySelector(".popup-rich-next")?.addEventListener("click", (e) => { e.stopPropagation(); show(idx + 1); });
}
