import { escAttr, esc, slugify } from "../core/util.js";
import { state } from "../core/state.js";
import { openLightbox } from "../ui/lightbox.js";

const YT = "rel=0&modestbranding=1&iv_load_policy=3";

export function hasRich(entry) {
  return Array.isArray(entry.popup?.slides) && entry.popup.slides.length > 0;
}

/* Só liga "Ver ficha" quando faz sentido: nunca aponta um lugar distinto
   para a ficha de um município com outro nome (ex.: Casa das Rendeiras → Saubara). */
function fichaLinkId(entry) {
  const id = entry.fichaId || entry.entidadeId;
  if (!id) return null;
  const f = state.fichaById?.[id];
  if (!f) return null;
  if (f.tipo === "municipio" && slugify(f.meta?.nome || "") !== slugify(entry.nome || "")) return null;
  return id;
}

function bestLink(links = []) {
  const clean = links.filter((u) => !/designdialogico|googleusercontent|usercontent\.google\.com|gstatic/i.test(u));
  return clean.find((u) => /youtube\.com|youtu\.be|instagram\.com|\.net|\.com\.br/i.test(u)) || clean[0];
}

export function popupHtml(entry) {
  if (hasRich(entry)) return richPopupHtml(entry);
  const link = bestLink(entry.links || []);
  const fichaId = fichaLinkId(entry);
  return `<div class="popup-title">${esc(entry.nome)}</div>
    ${entry.pontoCultura ? `<span class="popup-pc-tag">★ Ponto de Cultura</span>` : ""}
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

function slideBody(slide, eager) {
  let html = `<h3 class="popup-rich-title">${esc(slide.titulo)}</h3>`;
  if (slide.texto) html += `<p class="popup-rich-text">${esc(slide.texto)}</p>`;
  if (slide.foto) html += `<button class="popup-rich-thumb" data-lb-src="${escAttr(slide.foto)}" data-lb-cap="${escAttr(slide.legenda || slide.titulo)}" type="button" aria-label="Ver foto em tela cheia"><img src="${escAttr(slide.foto)}" alt="${escAttr(slide.legenda || slide.titulo)}" loading="lazy" decoding="async"><span class="popup-rich-expand" aria-hidden="true">⛶</span></button>`;
  if (slide.video?.tipo === "youtube" && slide.video.id) {
    html += eager
      ? `<div class="popup-rich-video"><iframe src="https://www.youtube-nocookie.com/embed/${escAttr(slide.video.id)}?${YT}" title="${escAttr(slide.video.legenda || slide.titulo)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`
      : `<div class="popup-rich-video" data-yt-id="${escAttr(slide.video.id)}" data-yt-title="${escAttr(slide.video.legenda || slide.titulo)}"></div>`;
  }
  if (slide.legenda && !slide.foto) html += `<p class="popup-rich-caption">${esc(slide.legenda)}</p>`;
  return html;
}

export function richPopupHtml(entry) {
  const slides = entry.popup.slides;
  const ctx = entry.popup.contexto || entry.nome;
  const n = slides.length;
  const fichaId = fichaLinkId(entry);
  return `<div class="irun-rich-popup" data-slides="${n}">
    <div class="popup-rich-ctx">${esc(ctx)}${entry.pontoCultura ? `<span class="popup-pc-tag">★</span>` : ""}</div>
    <div class="popup-rich-viewport">
      ${slides.map((s, i) => `<div class="popup-rich-slide${i === 0 ? " active" : ""}" data-idx="${i}">${slideBody(s, i === 0)}</div>`).join("")}
    </div>
    ${fichaId ? `<span class="popup-link" data-ficha="${escAttr(fichaId)}">Ver ficha completa →</span>` : ""}
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
