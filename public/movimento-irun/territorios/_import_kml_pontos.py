"""Importa pontos do KML My Maps (5 territórios) para dados.js."""
import json
import re
import unicodedata
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"k": "http://www.opengis.net/kml/2.2"}
KML = Path(__file__).parent / "_kml_5territorios.kml"
DADOS = Path(__file__).parent / "dados.js"

FOLDER_TO_SLUG = {
    "RMS E ILHA DE ITAPARICA": "itaparica-rm",
    "BAIXO SUL": "baixo-sul",
    "LITORAL SUL": "serra-grande",
    "RECÔNCAVO": "reconcavo-saubara",
    "CHAPADA DIAMANTINA": "chapada-mucuge",
}

SKIP = {
    "itaparica",
    "vera cruz",
    "salvador",
    "valenca",
    "serra grande",
    "mucuge",
    "guine",
    "guine de baixo",
}

EXPLICIT = {
    "associacao beneficente 25 de junho": "projetos",
    "vamos navegar": "projetos",
    "mare de marco": "projetos",
    "comunidade terreiro caxute": "projetos",
    "revista ligente": "projetos",
    "museu de memoria viva dos quilombos do terere e maragojipinho": "projetos",
    "museu da costa do dende de cultura afro-indigena": "projetos",
    "associacao de artesaos de saubara": "instituicoes",
    "festa das rendeiras": "produtos",
    "hostel recanto da vila": "produtos",
    "sede dos caboclos de itaparica": "instituicoes",
    "sede cheganca dos marujos fragata brasileira": "instituicoes",
    "museu do arquivo": "instituicoes",
    "museu aberto de serra grande": "instituicoes",
}

YT_RE = re.compile(
    r"(?:youtube\.com/(?:embed/|watch\?v=)|youtu\.be/)([A-Za-z0-9_-]{11})"
)


def norm(s):
    s = unicodedata.normalize("NFKD", s.strip().lower())
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s)


def slug_id(name):
    s = norm(name)
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")[:48]


def camada(name):
    n = norm(name)
    if n in EXPLICIT:
        return EXPLICIT[n]
    if any(x in n for x in ("vamos navegar", "25 de junho", "mare de marco", "caxute", "revista ligente")):
        return "projetos"
    if "museu" in n:
        return "instituicoes"
    if any(x in n for x in ("quilombo", "povoado quilombo")):
        return "historia"
    if "festa" in n or "hostel" in n:
        return "produtos"
    if any(
        x in n
        for x in (
            "escola",
            "colegio",
            "secretaria",
            "gremio",
            "ponto de cultura",
            "associacao",
            "casa azul",
            "instituto",
            "sede",
        )
    ):
        return "instituicoes"
    return "instituicoes"


def coords(pm):
    el = pm.find(".//k:Point/k:coordinates", NS)
    if el is None or not el.text:
        return None
    lng, lat, *_ = el.text.strip().split(",")
    return [round(float(lat), 7), round(float(lng), 7)]


def plain_text(html):
    if not html:
        return ""
    t = re.sub(r"<[^>]+>", " ", html)
    t = re.sub(r"https?://\S+", "", t)
    return re.sub(r"\s+", " ", t).strip()


def extract_media(pm, titulo):
    fotos = []
    videos = []
    seen_img = set()
    seen_vid = set()

    desc_el = pm.find("k:description", NS)
    desc = desc_el.text if desc_el is not None and desc_el.text else ""

    def add_foto(url):
        url = url.strip()
        if not url or "img.youtube.com" in url or url in seen_img:
            return
        seen_img.add(url)
        fotos.append({"titulo": titulo, "src": url})

    def add_video(vid):
        if not vid or vid in seen_vid:
            return
        seen_vid.add(vid)
        videos.append(
            {
                "titulo": titulo,
                "url": "https://www.youtube.com/watch?v=" + vid,
            }
        )

    for data in pm.findall(".//k:Data", NS):
        name_el = data.find("k:name", NS)
        name = (name_el.text if name_el is not None and name_el.text else "").strip()
        val_el = data.find("k:value", NS)
        val = val_el.text if val_el is not None and val_el.text else ""
        if name != "gx_media_links" or not val:
            continue
        for token in re.split(r"\s+", val.strip()):
            if not token:
                continue
            yt = YT_RE.search(token)
            if yt:
                add_video(yt.group(1))
            elif "hostedimage" in token or "googleusercontent" in token:
                add_foto(token)

    for m in re.finditer(r'<img[^>]+src="([^"]+)"', desc, re.I):
        add_foto(m.group(1))

    for m in YT_RE.finditer(desc):
        add_video(m.group(1))

    for i, f in enumerate(fotos):
        if len(fotos) > 1:
            f["titulo"] = titulo + " — foto " + str(i + 1)
        else:
            f["titulo"] = titulo

    for i, v in enumerate(videos):
        if len(videos) > 1:
            v["titulo"] = titulo + " — vídeo " + str(i + 1)
        else:
            v["titulo"] = titulo

    return fotos, videos


def walk(elem, folders):
    tag = elem.tag.split("}")[-1]
    if tag == "Folder":
        name = (elem.find("k:name", NS).text or "").strip()
        folders = folders + [name]
    if tag == "Placemark":
        name = (elem.find("k:name", NS).text or "").strip()
        c = coords(elem)
        if c and norm(name) not in SKIP:
            top = folders[0] if folders else ""
            slug = FOLDER_TO_SLUG.get(top)
            if slug:
                yield slug, name, c, elem
    for ch in elem:
        yield from walk(ch, folders)


def ponto_from_placemark(slug, name, c, pm):
    pid = slug_id(name)
    titulo = name
    if norm(name) == "associacao de artesaos de saubara":
        titulo = "Casa das Rendeiras"
        pid = "casa-rendeiras"
    if norm(name) == "associacao beneficente 25 de junho":
        titulo = "Associação Beneficente 25 de Junho"
        pid = "25-de-junho"
    if norm(name) == "mare de marco":
        titulo = "Maré de Março"
        pid = "mare-de-marco"
    if norm(name) == "vamos navegar":
        pid = "vamos-navegar"
    if norm(name) == "museu da costa do dende de cultura afro-indigena":
        pid = "museu-da-costa-do-dende-de-cultura-afro-indigena"
    if norm(name) == "museu de memoria viva dos quilombos do terere e maragojipinho":
        pid = "museu-de-memoria-viva-dos-quilombos-do-terere-e-"

    fotos, videos = extract_media(pm, titulo)
    desc_el = pm.find("k:description", NS)
    desc = desc_el.text if desc_el is not None and desc_el.text else ""
    resumo = plain_text(desc)

    p = {
        "id": pid,
        "titulo": titulo,
        "camada": camada(name),
        "coords": c,
        "resumo": resumo,
    }
    if fotos:
        p["fotos"] = fotos
    if videos:
        p["videos"] = videos
    return p


def main():
    text = DADOS.read_text(encoding="utf-8")
    data = json.loads(text.split("=", 1)[1].rsplit(";", 1)[0])

    lagoa_extra = []
    for t in data["territorios"]:
        if t["slug"] == "lagoa-grande":
            lagoa_extra = [
                p for p in t.get("pontos", []) if p["id"] not in ("aqcomaq",)
            ]

    by_slug = {s: [] for s in FOLDER_TO_SLUG.values()}
    root = ET.parse(KML).getroot()
    seen = set()
    for slug, name, c, pm in walk(root, []):
        p = ponto_from_placemark(slug, name, c, pm)
        key = (slug, p["id"])
        if key in seen:
            continue
        seen.add(key)
        by_slug[slug].append(p)

    by_slug["itaparica-rm"].append(
        {
            "id": "sede-caboclos",
            "titulo": "Sede dos Caboclos de Itaparica",
            "camada": "instituicoes",
            "coords": [-12.888, -38.678],
            "resumo": "Ponto de referência da tradição dos Caboclos na ilha.",
        }
    )
    by_slug["itaparica-rm"].append(
        {
            "id": "movimento-irun",
            "titulo": "Movimento Irun",
            "camada": "projetos",
            "coords": [-12.9696299, -38.5084013],
            "resumo": "Rua do Passo, 52, Salvador.",
        }
    )
    by_slug["reconcavo-saubara"].append(
        {
            "id": "sede-marujada",
            "titulo": "Sede — Chegança dos Marujos Fragata Brasileira",
            "camada": "instituicoes",
            "coords": [-12.7345, -38.7708],
            "resumo": "Marujada de Saubara — Rua Boca da Mata, 05, Centro.",
        }
    )

    by_slug["lagoa-grande"] = [
        {
            "id": "aqcomaq",
            "titulo": "AQCOMAQ",
            "camada": "instituicoes",
            "coords": [-12.136414, -38.989882],
            "resumo": "Associação Quilombola do território.",
        }
    ] + lagoa_extra

    for slug, pts in by_slug.items():
        out, ids = [], set()
        for p in pts:
            if p["id"] in ids:
                continue
            ids.add(p["id"])
            out.append(p)
        by_slug[slug] = sorted(out, key=lambda x: x["titulo"].lower())

    data["camadas"] = [
        {"id": "ambiente", "rotulo": "Ambiente", "cor": "#38bdf8"},
        {"id": "historia", "rotulo": "História", "cor": "#fbbf24"},
        {"id": "instituicoes", "rotulo": "Instituições", "cor": "#6ee7b7"},
        {"id": "produtos", "rotulo": "Produtos", "cor": "#fb923c"},
        {"id": "projetos", "rotulo": "Projetos", "cor": "#c084fc"},
    ]

    for t in data["territorios"]:
        if t["slug"] in by_slug:
            t["pontos"] = by_slug[t["slug"]]

    out = "/** Identidade e Memória — dados da Rede Movimento Irun */\nwindow.MI_DADOS = "
    out += json.dumps(data, ensure_ascii=False, indent=2)
    out += ";\n"
    DADOS.write_text(out, encoding="utf-8")

    media_count = 0
    for slug, pts in by_slug.items():
        n = sum(1 for p in pts if p.get("fotos") or p.get("videos"))
        media_count += n
        print(slug, len(pts), "pontos,", n, "com mídia")
    print("total com mídia:", media_count)


if __name__ == "__main__":
    main()
