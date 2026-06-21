import JSZip from "https://cdn.jsdelivr.net/npm/jszip@3.10.1/+esm";

const EXPORT_EMAIL = "casadecastroalves@gmail.com";
const PHOTO_MAX = 10;
const PHOTO_BYTES = 2 * 1024 * 1024;
/** Fotos + PDF no ZIP — margem segura para anexo Gmail (~25 MB). */
const ATTACH_MAX = 18 * 1024 * 1024;

const $ = (id) => document.getElementById(id);

function slugify(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "nova-entidade";
}

function parseYouTubeId(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  return m ? m[1] : (/^[\w-]{11}$/.test(s) ? s : "");
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadSelects() {
  const [territoriosData, config] = await Promise.all([
    fetch("../data/territorios.json").then((r) => r.json()),
    fetch("../data/config.json").then((r) => r.json()),
  ]);

  const tiSel = $("territorioId");
  tiSel.innerHTML = territoriosData.territorios
    .map((t) => `<option value="${t.id}">${t.cod} — ${t.nome}</option>`)
    .join("");

  const cats = config.categorias || {};
  $("categorias").innerHTML = Object.entries(cats)
    .map(([k, v]) => `<label class="chip"><input type="checkbox" name="cat" value="${k}"> ${v.label}</label>`)
    .join("");

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", (e) => {
      if (e.target.tagName === "INPUT") return;
      const cb = chip.querySelector("input");
      cb.checked = !cb.checked;
      chip.classList.toggle("active", cb.checked);
    });
    chip.querySelector("input")?.addEventListener("change", () => {
      chip.classList.toggle("active", chip.querySelector("input").checked);
    });
  });
}

function readPhotos() {
  const input = $("fotos");
  return [...(input.files || [])];
}

function readPdf() {
  const f = $("pdf").files?.[0];
  return f || null;
}

function attachmentBytes(photos, pdf) {
  const photoTotal = photos.reduce((n, f) => n + f.size, 0);
  return photoTotal + (pdf?.size || 0);
}

function updateAttachBudget(photos, pdf, ok) {
  const el = $("attach-budget");
  if (!el) return;
  const used = attachmentBytes(photos, pdf);
  const pct = Math.min(100, Math.round((used / ATTACH_MAX) * 100));
  const over = used > ATTACH_MAX;
  const warn = !over && used > ATTACH_MAX * 0.85;
  const state = over || (!ok && used > 0) ? "bad" : warn ? "warn" : "";
  el.className = `attach-budget${state ? ` ${state}` : ""}`;
  el.innerHTML = `
    <div class="attach-budget-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${ATTACH_MAX}" aria-valuenow="${used}" aria-label="Espaço usado nos anexos">
      <span style="width:${pct}%"></span>
    </div>
    <p class="attach-budget-text">
      <strong>${pct}%</strong> · Anexos: <strong>${fmtBytes(used)}</strong> / ${fmtBytes(ATTACH_MAX)}
      ${over ? " — reduza fotos ou PDF" : warn ? " — perto do limite" : ""}
    </p>`;
}

function validateMedia() {
  const photos = readPhotos();
  const pdf = readPdf();
  const list = $("fotos-list");
  const pdfList = $("pdf-list");
  list.innerHTML = "";
  pdfList.innerHTML = "";

  let ok = true;

  if (photos.length > PHOTO_MAX) {
    list.innerHTML = `<li class="bad">Máximo ${PHOTO_MAX} imagens.</li>`;
    ok = false;
  } else {
    for (const f of photos) {
      const typeOk = /^image\//.test(f.type);
      const sizeOk = f.size <= PHOTO_BYTES;
      const good = typeOk && sizeOk;
      if (!good) ok = false;
      let note = "";
      if (!typeOk) note = " (só JPG, PNG ou WebP)";
      else if (!sizeOk) note = " (máx. 2 MB por foto)";
      list.innerHTML += `<li class="${good ? "ok" : "bad"}">${f.name} — ${fmtBytes(f.size)}${note}</li>`;
    }
  }

  if (pdf) {
    const typeOk = pdf.type === "application/pdf" || pdf.name.toLowerCase().endsWith(".pdf");
    if (!typeOk) ok = false;
    pdfList.innerHTML = `<li class="${typeOk ? "ok" : "bad"}">${pdf.name} — ${fmtBytes(pdf.size)}${typeOk ? "" : " (só PDF)"}</li>`;
  }

  const total = attachmentBytes(photos, pdf);
  if (total > ATTACH_MAX) ok = false;

  updateAttachBudget(photos, pdf, ok);

  return {
    ok,
    files: ok ? photos : [],
    file: ok ? pdf : null,
  };
}

function selectedCategories() {
  return [...document.querySelectorAll('input[name="cat"]:checked')].map((el) => el.value);
}

function buildSubmission() {
  const nome = $("nome").value.trim();
  const lat = parseFloat($("lat").value);
  const lng = parseFloat($("lng").value);
  const slug = slugify(nome);
  const categorias = selectedCategories();
  const videoId = parseYouTubeId($("video").value);
  const resumo = $("resumo").value.trim();
  const apresentacao = $("apresentacao").value.trim();

  if (!nome) throw new Error("Indique o nome do lugar.");
  if (Number.isNaN(lat) || Number.isNaN(lng)) throw new Error("Coordenadas inválidas (latitude e longitude).");
  if (lat < -35 || lat > 5 || lng < -55 || lng > -30) throw new Error("Coordenadas fora da Bahia — verifique lat/lng.");
  if (!categorias.length) throw new Error("Seleccione pelo menos uma categoria.");
  if (!$("autorizo").checked) throw new Error("Confirme que tem autorização para publicar estes conteúdos.");
  if ($("video").value.trim() && !videoId) throw new Error("Link do YouTube inválido.");

  const pontoCultura = $("pontoCultura").checked;
  const teiaDosPovos = $("teiaDosPovos").checked;
  const today = new Date().toISOString().slice(0, 10);

  const fotosMeta = [];
  const popupSlides = [];

  if (videoId) {
    popupSlides.push({
      titulo: nome,
      video: { tipo: "youtube", id: videoId, legenda: resumo || nome },
    });
  }

  const data = {
    submissionType: "proposta-mapa",
    submittedAt: new Date().toISOString(),
    id: slug,
    version: "1.0.0",
    territorioId: $("territorioId").value,
    tipo: $("tipo").value,
    rede: true,
    pontoCultura: pontoCultura || undefined,
    teiaDosPovos: teiaDosPovos || undefined,
    meta: {
      nome,
      coords: [lat, lng],
      municipio: $("municipio").value.trim(),
      uf: "BA",
      responsavel: $("responsavel").value.trim(),
      fonte: "Proposta via formulário — Mapa Movimento Irun",
      updatedAt: today,
    },
    sidebar: {
      apresentacao,
      videos: videoId ? [{ tipo: "youtube", id: videoId, titulo: nome }] : [],
      fotos: fotosMeta,
    },
    ponto: {
      id: slug,
      nome,
      coords: [lat, lng],
      categorias,
      resumo: resumo || apresentacao.slice(0, 140),
      entidadeId: slug,
      pontoCultura: pontoCultura || undefined,
      teiaDosPovos: teiaDosPovos || undefined,
      popup: popupSlides.length
        ? { contexto: nome, slides: popupSlides }
        : undefined,
    },
    contato: {
      email: $("email").value.trim(),
      telefone: $("telefone").value.trim(),
      instagram: $("instagram").value.trim(),
    },
    assets: { fotos: [], pdf: null },
  };

  return { slug, data };
}

async function exportZip() {
  $("err").textContent = "";

  const mediaCheck = validateMedia();
  if (!mediaCheck.ok) {
    throw new Error("Corrija os ficheiros antes de exportar (limite total de anexos: 18 MB).");
  }

  const { slug, data } = buildSubmission();
  const zip = new JSZip();

  mediaCheck.files.forEach((file, i) => {
    const ext = (file.name.match(/\.(jpe?g|png|webp|gif)$/i) || [,"jpg"])[1].toLowerCase().replace("jpeg", "jpg");
    const name = `foto-${String(i + 1).padStart(2, "0")}.${ext}`;
    const rel = `fotos/${name}`;
    zip.file(rel, file);
    data.sidebar.fotos.push({
      src: `assets/${slug}/${rel}`,
      legenda: file.name.replace(/\.[^.]+$/, ""),
    });
    data.assets.fotos.push(rel);
  });

  if (mediaCheck.file) {
    const pdfName = "documento.pdf";
    zip.file(`pdf/${pdfName}`, mediaCheck.file);
    data.sidebar.documentos = [{
      titulo: mediaCheck.file.name.replace(/\.pdf$/i, ""),
      href: `assets/${slug}/pdf/${pdfName}`,
      tipo: "pdf",
    }];
    data.assets.pdf = `pdf/${pdfName}`;
  }

  zip.file("submission.json", JSON.stringify(data, null, 2));

  const blob = await zip.generateAsync({ type: "blob" });
  const filename = `${slug}-proposta-${new Date().toISOString().slice(0, 10)}.zip`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);

  const subject = encodeURIComponent(`REDE MOVIMENTO IRUN — proposta ${slug}`);
  const body = encodeURIComponent(
    `Nova proposta para o mapa territorial.\n\n` +
    `Lugar: ${data.meta.nome}\n` +
    `Território: ${data.territorioId}\n` +
    `Coordenadas: ${data.meta.coords.join(", ")}\n` +
    `Ficheiro: ${filename}\n\n` +
    `Anexe o ZIP descarregado a este email.\n\n` +
    `— Formulário Mapa Movimento Irun`
  );
  window.location.href = `mailto:${EXPORT_EMAIL}?subject=${subject}&body=${body}`;

  return filename;
}

function bindPreview() {
  const refresh = () => validateMedia();
  $("fotos").addEventListener("change", refresh);
  $("pdf").addEventListener("change", refresh);
  refresh();
}

function bindExport() {
  $("btn-export").addEventListener("click", async () => {
    $("btn-export").disabled = true;
    try {
      const filename = await exportZip();
      $("err").innerHTML = `<span style="color:#1a7f37">ZIP descarregado: ${filename}. Complete o envio por email.</span>`;
    } catch (e) {
      $("err").textContent = e.message || String(e);
    } finally {
      $("btn-export").disabled = false;
    }
  });
}

loadSelects().catch((e) => { $("err").textContent = `Erro ao carregar dados: ${e.message}`; });
bindPreview();
bindExport();
