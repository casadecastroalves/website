import { escAttr, esc, slugify } from "../core/util.js";
import { state, isPontoCultura, isTeiaDosPovos, TEIA_HUB_ID } from "../core/state.js";
import { openLightbox } from "../ui/lightbox.js";

const YT = "rel=0&modestbranding=1&iv_load_policy=3&playsinline=1&color=white";

function fichaOf(entry) {
  const id = entry.fichaId || entry.entidadeId;
  return id ? state.fichaById?.[id] : null;
}

function fichaYoutubeVideos(entry) {
  return (fichaOf(entry)?.sidebar?.videos || []).filter((v) => v.tipo === "youtube" && v.id);
}

function fichaPhotos(entry) {
  const f = fichaOf(entry);
  if (!f || f.tipo === "municipio") return [];
  return (f.sidebar?.fotos || []).filter((p) => {
    const src = typeof p === "string" ? p : p?.src;
    return !!src;
  });
}

function videoSlide(v, entry) {
  return {
    video: {
      tipo: "youtube",
      id: v.id,
      legenda: v.titulo || entry.nome,
      embed: v.embed,
    },
  };
}

function photoSlide(photo, entry) {
  const src = typeof photo === "string" ? photo : photo.src;
  const legenda = typeof photo === "string" ? entry.nome : (photo.legenda || entry.nome);
  return { foto: src, legenda, titulo: legenda };
}

/* Separa slides com vídeo dos restantes — vídeos sempre primeiro. */
function partitionSlides(slides = []) {
  const videos = [];
  const rest = [];
  for (const s of slides) {
    if (s.video?.id) videos.push(s);
    else rest.push(s);
  }
  return { videos, rest };
}

/* Ficha com vídeos/fotos → popup rico no pin (vídeos primeiro, depois fotos). */
function mergeFichaMedia(entry) {
  const fromVideos = fichaYoutubeVideos(entry);
  const fromPhotos = fichaPhotos(entry);
  const slides = entry.popup?.slides || [];
  const { videos: pointVideos, rest: pointRest } = partitionSlides(slides);
  const seenVideoIds = new Set(pointVideos.map((s) => s.video.id));

  const extraVideos = fromVideos
    .filter((v) => !seenVideoIds.has(v.id))
    .map((v) => videoSlide(v, entry));

  const inPopupPhotos = new Set(
    [...pointRest, ...pointVideos].filter((s) => s.foto).map((s) => s.foto),
  );
  const extraPhotos = fromPhotos
    .map((p) => photoSlide(p, entry))
    .filter((s) => !inPopupPhotos.has(s.foto));

  const merged = [...pointVideos, ...extraVideos, ...pointRest, ...extraPhotos];
  if (!merged.length) return entry.popup;

  return {
    ...(entry.popup || {}),
    contexto: entry.popup?.contexto || entry.nome,
    slides: merged,
  };
}

function resolvePopup(entry) {
  return mergeFichaMedia(entry);
}

export function hasRich(entry) {
  const popup = resolvePopup(entry);
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

function labelRepeats(a, b) {
  const x = slugify(a || "");
  const y = slugify(b || "");
  if (!x || !y) return false;
  if (x === y) return true;
  return x.includes(y) || y.includes(x);
}

function popupTagsHtml(entry) {
  const { pc, teia } = entryBadges(entry);
  if (!pc && !teia) return "";
  const tags = [];
  if (pc) tags.push('<span class="popup-pc-tag">★ Ponto de Cultura</span>');
  if (teia) tags.push(`<button type="button" class="popup-teia-tag" data-ficha="${escAttr(TEIA_HUB_ID)}">🕸 Teia dos Povos</button>`);
  return `<div class="popup-tags">${tags.join("")}</div>`;
}

function bestLink(links = []) {
  const clean = links.filter((u) => !/designdialogico|googleusercontent|usercontent\.google\.com|gstatic|google\.com\/maps\/d\/.*embed/i.test(u));
  return clean.find((u) => /youtube\.com|youtu\.be|instagram\.com|\.net|\.com\.br/i.test(u)) || clean[0];
}

export function popupHtml(entry) {
  const popup = resolvePopup(entry);
  if (popup?.slides?.length) return richPopupHtml({ ...entry, popup });
  const link = bestLink(entry.links || []);
  const fichaId = fichaLinkId(entry);
  return `<div class="popup-title">${esc(entry.nome)}</div>
    ${popupTagsHtml(entry)}
    ${entry.resumo ? `<div class="popup-cod">${esc(entry.resumo)}</div>` : ""}
    ${link ? `<a class="popup-link" href="${escAttr(link)}" target="_blank" rel="noopener">Saiba mais →</a>` : ""}
    ${fichaId ? `<span class="popup-link" data-ficha="${escAttr(fichaId)}">Ver ficha →</span>` : ""}`;
}

export function popupOptions(entry) {
  if (hasRich(entry)) {
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

function slideBody(slide, eager, entry, ctx) {
  let html = "";
  const skipTitle = slide.titulo && (labelRepeats(slide.titulo, entry?.nome) || labelRepeats(slide.titulo, ctx));
  if (slide.titulo && !skipTitle) html += `<h3 class="popup-rich-title">${esc(slide.titulo)}</h3>`;
  if (slide.video?.tipo === "youtube" && slide.video.id) {
    const title = slide.video.legenda || slide.titulo || "";
    html += eager
      ? `<div class="popup-rich-video"><iframe src="https://www.youtube-nocookie.com/embed/${escAttr(slide.video.id)}?${YT}" title="${escAttr(title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
      : `<div class="popup-rich-video" data-yt-id="${escAttr(slide.video.id)}" data-yt-title="${escAttr(title)}"></div>`;
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
  const subtitle = ctx && !labelRepeats(ctx, entry.nome) ? `<div class="popup-rich-ctx">${esc(ctx)}</div>` : "";
  return `<div class="irun-rich-popup" data-slides="${n}">
    <h3 class="popup-title popup-rich-head">${esc(entry.nome)}</h3>
    ${popupTagsHtml(entry)}
    ${subtitle}
    <div class="popup-rich-viewport">
      ${slides.map((s, i) => `<div class="popup-rich-slide${i === 0 ? " active" : ""}" data-idx="${i}">${slideBody(s, i === 0, entry, ctx)}</div>`).join("")}
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
  box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${box.dataset.ytId}?${YT}" title="${escAttr(box.dataset.ytTitle)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
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

  const photoList = slides.flatMap((slideEl) => {
    const btn = slideEl.querySelector(".popup-rich-thumb");
    if (!btn) return [];
    return [{ src: btn.dataset.lbSrc, legenda: btn.dataset.lbCap || "" }];
  });

  root.querySelectorAll(".popup-rich-thumb").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = photoList.findIndex((p) => p.src === btn.dataset.lbSrc);
      openLightbox(photoList, Math.max(0, idx));
    });
  });

  if (slides.length < 2) return;
  root.querySelector(".popup-rich-prev")?.addEventListener("click", (e) => { e.stopPropagation(); show(idx - 1); });
  root.querySelector(".popup-rich-next")?.addEventListener("click", (e) => { e.stopPropagation(); show(idx + 1); });
}
