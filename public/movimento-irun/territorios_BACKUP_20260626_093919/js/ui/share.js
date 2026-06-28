import { state } from "../core/state.js";
import { buildHash, parseRoute } from "../core/router.js";

function basePath() {
  const local = `${window.location.origin}${window.location.pathname.replace(/\/$/, "") || ""}`;
  const isLocal = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
  if (isLocal) return local;
  const canonical = state.config?.app?.embedBase?.replace(/\/$/, "");
  if (canonical) {
    try { if (window.location.hostname === new URL(canonical).hostname) return local; } catch { /* ignore */ }
  }
  return canonical || local;
}

function viewHash() {
  return buildHash({ ...parseRoute(), filters: state.filters });
}

export function getShareUrl() {
  return `${basePath()}${viewHash()}`;
}

export function getEmbedUrl() {
  const url = new URL(getShareUrl());
  url.searchParams.set("embed", "1");
  return url.href;
}

export function getEmbedCode(w = "100%", h = "520") {
  return `<iframe src="${getEmbedUrl()}" width="${w}" height="${h}" style="border:0;border-radius:10px;max-width:100%" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin" title="MOVIMENTO IRUN — Mapa territorial"></iframe>`;
}

export function isEmbedMode() {
  return new URLSearchParams(window.location.search).get("embed") === "1";
}

function initEmbed() {
  if (!isEmbedMode()) return;
  document.body.classList.add("embed-mode");
}

function copyText(text, ok) {
  navigator.clipboard?.writeText(text).then(() => toast(ok)).catch(() => prompt("Copie:", text));
}

export function toast(msg) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2400);
}

function refreshFields() {
  const url = document.getElementById("share-url");
  const embed = document.getElementById("share-embed");
  if (url) url.value = getShareUrl();
  if (embed) embed.value = getEmbedCode();
}

function openPanel() {
  refreshFields();
  const o = document.getElementById("share-overlay");
  o?.classList.add("open");
  o?.setAttribute("aria-hidden", "false");
}

function closePanel() {
  const o = document.getElementById("share-overlay");
  o?.classList.remove("open");
  o?.setAttribute("aria-hidden", "true");
}

export function initShare() {
  initEmbed();
  document.getElementById("btn-share")?.addEventListener("click", openPanel);
  document.getElementById("share-close")?.addEventListener("click", closePanel);
  document.getElementById("share-overlay")?.addEventListener("click", (e) => { if (e.target.id === "share-overlay") closePanel(); });
  document.getElementById("share-copy-url")?.addEventListener("click", () => copyText(getShareUrl(), "Link copiado!"));
  document.getElementById("share-copy-embed")?.addEventListener("click", () => copyText(getEmbedCode(), "Código copiado!"));
  document.getElementById("share-native")?.addEventListener("click", () => {
    navigator.share?.({ title: "MOVIMENTO IRUN — Identidade e Território", url: getShareUrl() }).catch(() => copyText(getShareUrl(), "Link copiado!"));
  });
  if (navigator.share) document.getElementById("share-native")?.removeAttribute("hidden");
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closePanel(); });
  window.addEventListener("hashchange", () => { if (document.getElementById("share-overlay")?.classList.contains("open")) refreshFields(); });
}
