# MAPA MELHORADO — Movimento Irun · Identidade e Território

Mapa territorial interativo, **leve e escalável**, construído em HTML + CSS + JavaScript puro (ES modules) com [Leaflet](https://leafletjs.com). **Sem build, sem `node_modules`** — ideal para Google Drive e para publicar como ficheiros estáticos.

## Como abrir localmente

Não abra o `index.html` com duplo-clique (`file://` não carrega módulos). Use um servidor HTTP:

```bash
cd "MAPA MELHORADO"
python -m http.server 8099
```

Depois abra `http://localhost:8099`.

## Estrutura

```
MAPA MELHORADO/
  index.html              # casca da página
  css/app.css             # estilos (tema claro/escuro)
  js/
    app.js                # arranque / orquestração
    core/                 # util, estado, carregamento de dados, rotas
    map/                  # mapa, marcadores, popups
    ui/                   # sidebar, pesquisa, partilha, tema, mobile, lightbox
  data/
    config.json           # configuração geral (título, sobre, categorias, filtros…)
    territorios.json      # lista dos Territórios de Identidade
    manifest.json         # regista quais fichas/pontos/roteiros carregar
    fichas/<id>.json      # uma ficha por quilombo/projeto/instituição/município
    pontos/ti-XX.json     # pins extra no mapa por território
  geo/
    base/territorios.geojson  # polígonos oficiais (SEI/SEPLAN)
    rede/ , roteiros/         # camadas participativas e roteiros
  assets/<id>/fotos/      # fotos da ficha (WebP/JPG otimizados)
  assets/<id>/pdf/        # PDFs/portfólios da ficha
```

## Como funciona (resumo)

- **`config.json`** controla quase tudo (nada de "Bahia/27" fixo no código). Dá para reusar este motor noutro estado/região.
- **`manifest.json`** diz que fichas e pontos carregar. Adicionar um território = adicionar a esta lista.
- Cada **ficha** é o conteúdo do painel lateral (apresentação, identidade, fotos, vídeos, portfólio, contactos…).
- Os **marcadores** do mapa vêm de uma só fonte (pontos + fichas com coordenadas), com **dispersão automática** quando há vários no mesmo lugar — sem pins escondidos.

## Mídia: vídeos e fotos

- **Vídeos:** sempre no **YouTube**. Guarde só o ID do vídeo (ex.: `dQw4w9WgXcQ`).
- **Fotos:** o **Google Drive é o arquivo de trabalho**; para publicar, exporte versões **otimizadas (WebP, ~150–300 KB)** para `assets/<id>/fotos/`. São carregadas só quando o utilizador abre a ficha (lazy), por isso não pesam na navegação.

> Evite usar links diretos do Google Drive como fonte ao vivo das imagens: o Google limita o tráfego e quebra os links quando o mapa tem visitas.

## Partilhar

O botão **Compartilhar** gera link e código de incorporação (iframe). O link guarda a vista atual: território, ficha, município ou filtros — por exemplo:

- `#/t/ti-06` → Território Baixo Sul
- `#/t/ti-06/tenonde` → ficha do Kilombo Tenondé
- `#/m/valenca` → tudo no município de Valença
- `#/f/terere` → ficha direta (deriva o território)

## Publicar (produção)

Repositório no GitHub de `casadecastroalves@gmail.com` → deploy automático via Cloudflare Pages. Copiar o conteúdo desta pasta para `public/territorios/` do site, fazer commit e push.

## Adicionar um novo território/quilombo

Ver **`COMO-ADICIONAR-TERRITORIO.md`**.
