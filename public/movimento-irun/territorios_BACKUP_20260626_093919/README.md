# Movimento Irun — Mapa Identidade e Território

Mapa territorial interativo, **leve e escalável**, construído em HTML + CSS + JavaScript puro (ES modules) com [Leaflet](https://leafletjs.com). **Sem build, sem `node_modules`** — ideal para Google Drive e para publicar como ficheiros estáticos.

**Localização canónica (única cópia de trabalho):**

```
G:\Meu Drive\1. WEBSITES\castro-alves\codigo\public\movimento-irun\territorios\
```

## Como abrir localmente

Não abra o `index.html` com duplo-clique (`file://` não carrega módulos). Use um servidor HTTP:

```powershell
cd "G:\Meu Drive\1. WEBSITES\castro-alves\codigo\public\movimento-irun\territorios"
python -m http.server 8099
```

Ou duplo-clique em `VER-MAPA.bat`. Depois abra `http://localhost:8099`.

## Estrutura

```
territorios/
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
  tools/                  # scripts de manutenção (mídia, deploy, compressão)
```

## Como funciona (resumo)

- **`config.json`** controla quase tudo (nada de "Bahia/27" fixo no código). Dá para reusar este motor noutro estado/região.
- **`manifest.json`** diz que fichas e pontos carregar. Adicionar um território = adicionar a esta lista.
- Cada **ficha** é o conteúdo do painel lateral (apresentação, identidade, fotos, vídeos, portfólio, contactos…).
- Os **marcadores** do mapa vêm de uma só fonte (pontos + fichas com coordenadas), com **dispersão automática** quando há vários no mesmo lugar — sem pins escondidos.

## Mídia: vídeos e fotos

- **Vídeos:** sempre no **YouTube**. Guarde só o ID do vídeo (ex.: `dQw4w9WgXcQ`).
- **Fotos:** exporte versões **otimizadas (WebP, ~150–300 KB)** para `assets/<id>/fotos/`. Originais grandes (>25 MB) vão para `castro-alves/originais-grandes/`, nunca para o deploy.

> Evite usar links directos do Google Drive como fonte ao vivo das imagens: o Google limita o tráfego e quebra os links quando o mapa tem visitas.

## Partilhar

O botão **Compartilhar** gera link e código de incorporação (iframe). O link guarda a vista actual: território, ficha, município ou filtros — por exemplo:

- `#/t/ti-06` → Território Baixo Sul
- `#/t/ti-06/tenonde` → ficha do Kilombo Tenondé
- `#/m/valenca` → tudo no município de Valença
- `#/f/terere` → ficha directa (deriva o território)

## Publicar (produção)

1. Editar nesta pasta (`territorios/`)
2. `git add` + `commit` + `push` no repo `castro-alves/codigo/`
3. Cloudflare Pages faz deploy automático (~2 min)

Script auxiliar: `tools/deploy.ps1` (comprime ficheiros grandes e faz push).

## Adicionar um novo território/quilombo

Ver **`COMO-ADICIONAR-TERRITORIO.md`**.
