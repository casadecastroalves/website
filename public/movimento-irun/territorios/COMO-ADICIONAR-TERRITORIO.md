# Como adicionar uma nova ficha (quilombo · projeto · instituição · município)

Tudo se faz com **3 a 4 passos** e ficheiros de texto (JSON). Não é preciso mexer no código.

---

## Passo 1 — Criar o ficheiro da ficha

Crie `data/fichas/<id>.json` (use um `id` curto, sem espaços nem acentos, ex.: `quilombo-novo`).

Modelo mínimo:

```json
{
  "id": "quilombo-novo",
  "territorioId": "ti-06",
  "tipo": "quilombo",
  "rede": true,
  "meta": {
    "nome": "Quilombo Novo",
    "coords": [-13.3231, -39.2532],
    "municipio": "Valença",
    "uf": "BA"
  },
  "sidebar": {
    "apresentacao": "Texto de apresentação da comunidade…",
    "identidade": [
      { "id": "historia", "titulo": "História e memória", "conteudo": "…" },
      { "id": "cultura", "titulo": "Cultura", "conteudo": "…" }
    ],
    "fotos": [
      { "src": "assets/quilombo-novo/fotos/01.webp", "legenda": "Festa da comunidade" }
    ],
    "videos": [
      { "tipo": "youtube", "id": "ABC123xyz", "titulo": "Documentário" }
    ],
    "portfolio": [
      { "titulo": "Portfólio 2026", "href": "assets/quilombo-novo/pdf/portfolio.pdf", "tipo": "pdf" }
    ],
    "contato": { "organizacao": "Associação…", "email": "contato@exemplo.org" },
    "externo": { "site": "https://exemplo.org" }
  }
}
```

- **`tipo`**: `quilombo`, `assentamento`, `comunidade`, `projeto`, `instituicao` ou `municipio` (define a cor do pin).
- **`coords`**: `[latitude, longitude]`. Tire do Google Maps (clique direito → copiar coordenadas).
- **`rede: true`** marca o território como "REDE ativa".
- Campos vazios podem ser omitidos. Só `apresentacao` é essencial.

## Passo 2 — Registar no manifesto

Em `data/manifest.json`, acrescente o `id` à lista `fichas`:

```json
"fichas": [ "tenonde", "terere", "quilombo-novo" ]
```

Pronto — já aparece no mapa (pin nas coordenadas) e na pesquisa, sidebar e REDE.

## Passo 3 — Fotos e PDFs (automático)

Não é preciso listar nada à mão. O fluxo é **largar ficheiros → 1 comando**:

1. Copie as **fotos** para `assets/<id>/fotos/` (ex.: `foto-01.jpg`, `foto-02.jpg`…).
   - Recomendado: WebP ou JPG, lado maior ~1600px, ~150–300 KB cada (mais leve = mais rápido).
2. Copie os **PDFs** para `assets/<id>/pdf/` (use nomes claros — viram o título no mapa).
3. Na pasta do mapa (`territorios/`), corra **uma vez**:

```bash
node tools/atualizar-midia.mjs
```

Isto regenera `data/midia.json` varrendo todas as pastas. O mapa passa a mostrar a
galeria de **Fotos** e a secção **Documentos (PDF)** na ficha — sem tocar no código.

> Para **remover** uma foto/PDF: apague o ficheiro da pasta e volte a correr o comando.
> Legendas (opcional): edite `data/midia.json` e preencha o campo `legenda` de cada foto.

> **Vídeos**: copie só o ID do YouTube (a parte depois de `v=` no link) para `sidebar.videos`.

## Passo 4 (opcional) — Pins extra no mapa

Para marcar **lugares adicionais** de um território (sem ficha completa), edite `data/pontos/ti-XX.json`:

```json
{
  "territorioId": "ti-06",
  "pontos": [
    {
      "id": "feira-quilombola",
      "nome": "Feira Quilombola",
      "coords": [-13.30, -39.25],
      "categorias": ["projetos"],
      "fichaId": "quilombo-novo"
    }
  ]
}
```

- `fichaId` (opcional) liga o pin à ficha (botão "Ver ficha" no popup).
- `popup.slides` (opcional) cria um popup rico com vídeos/fotos diretamente no mapa.

---

## Adicionar um novo TERRITÓRIO de Identidade (avançado)

Os 27 territórios já vêm em `data/territorios.json` e `geo/base/territorios.geojson`. Para um mapa de **outra região/estado**, basta trocar esses dois ficheiros e ajustar `data/config.json` (centro, rótulos, fonte). O motor adapta-se sozinho ao número de territórios.

---

## Checklist rápido

- [ ] `data/fichas/<id>.json` criado
- [ ] `id` adicionado em `data/manifest.json`
- [ ] coordenadas corretas (`[lat, lng]`)
- [ ] fotos em `assets/<id>/fotos/` e PDFs em `assets/<id>/pdf/`
- [ ] correr `node tools/atualizar-midia.mjs` (atualiza fotos e documentos)
- [ ] IDs de vídeos do YouTube
- [ ] testar local (`python -m http.server`) antes de publicar
