import { esc } from "../core/util.js";

let photos = [];
let index = 0;

export function initLightbox() {
  const lb = document.getElementById("lightbox");
  if (!lb) return;
  lb.querySelector(".lightbox-close")?.addEventListener("click", close);
  lb.querySelector(".lightbox-prev")?.addEventListener("click", () => step(-1));
  lb.querySelector(".lightbox-next")?.addEventListener("click", () => step(1));
  lb.addEventListener("click", (e) => { if (e.target === lb) close(); });
  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(1);
  });
}

export function openLightbox(list, i = 0) {
  if (!list?.length) return;
  photos = list;
  index = i;
  render();
  document.getElementById("lightbox")?.classList.add("open");
}

function close() {
  document.getElementById("lightbox")?.classList.remove("open");
}

function step(d) {
  index = (index + d + photos.length) % photos.length;
  render();
}

function render() {
  const lb = document.getElementById("lightbox");
  if (!lb) return;
  const p = photos[index];
  const src = typeof p === "string" ? p : p.src;
  const cap = typeof p === "string" ? "" : p.legenda || "";
  lb.querySelector(".lightbox-img").src = src;
  lb.querySelector(".lightbox-caption").innerHTML = esc(cap);
  const multi = photos.length > 1;
  lb.querySelector(".lightbox-prev").style.display = multi ? "" : "none";
  lb.querySelector(".lightbox-next").style.display = multi ? "" : "none";
}
