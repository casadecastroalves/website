# Indicações do usuário sobre o mapa — registro consolidado

Documento para referência em novo chat ou próxima fase.  
**Modelo base:** `mapa.html` em `etapa1` (6 territórios Rede).  
**Experimento separado (não mexer por agora):** pasta `MAPA 27 TERRITORIOS DE IDENTIDADE CULTURAL DA BAHIA` / `identidade-e-memoria.html`.

---

## 1. Organização de arquivos

- Parar de duplicar pastas, versões e nomes (`mapa_v2`, `index`, cópias espalhadas).
- Pasta de trabalho: **TERRITORIOS** (evento junho — apresentação do mapa).
- Estrutura proposta por território:
  ```
  TERRITORIOS/
    mapa/                    ← um dashboard principal
    kml/territorios_identidade_bahia.kml
    {slug-territorio}/
      mapas/                 ← KML My Maps, roteiros
      imagens/
      texto/                 ← territorio, cultura, memoria (links YouTube, notas)
      videos/
  ```
- Mapa dos 27 TI deve ficar na pasta **MAPA 27 TERRITORIOS DE IDENTIDADE CULTURAL DA BAHIA**.

---

## 2. Nome e branding

**Nome do mapa:** Identidade e Memória  

**Ordem fixa (3 linhas):**
1. Movimento Irun nos Territórios de Identidade da Bahia  
2. Identidade e Memória  
3. Built by: IG + Comunidade  

- **Sem** Wikipedia visível (texto editado manualmente ou via formulário).
- **Sem** Design Dialógico visível por agora (consultar depois).
- Só **Movimento Irun** nos nomes das regiões.

**Arquivo HTML do mapa novo:** `identidade-e-memoria.html` (mesmo nome do mapa).  
**Entrada antiga:** `mapa.html` = modelo etapa1 (6 territórios).

---

## 3. Dois modos de mapa

| Modo | Comportamento |
|------|----------------|
| **Default — 27 TI** | Bahia com **todos os polígonos** (`territorios_identidade_bahia.kml`). Hover = nome. Clique = entra no território. **Sem** chips internos. Lateral = só conceitos (divisão dos TI, lista de 27 territórios, lista de municípios — texto). |
| **Rede — 6 territórios** | itaparica-rm, baixo-sul, chapada-mucuge, reconcavo-saubara, serra-grande, lagoa-grande. Pins/projetos do Movimento Irun. |

**Itaparica:** município na ilha; na BTS está no TI **RMS** (Região Metropolitana de Salvador). Na Rede continua como território do projeto.

**Visual polígonos:** brancos/contorno claro para destacar pins coloridos. Retângulo tracejado de referência — **remover**.

---

## 4. Menu superior (mapa.html / etapa1 — NÃO reinventar)

- **Rede:** botão abre **modal** com lista dos 6 territórios + pinos no mapa (como estava).
- **Não** mover Rede para menu inventado no canto direito.
- Modo 27 TI: botão para voltar ao mapa da Bahia (nome: Bahia / Mapa TI / Bolinha — a definir).
- **Compartilhar:** manter copiar link **+ incorporar** (`iframe`) da **visualização atual** (`?vista=ti`, `?territorio=slug`, etc.).

---

## 5. Menu lateral = conteúdo (muda por território)

| Aba | Conteúdo |
|-----|----------|
| **Território** | Resumo, história, dados — texto em parágrafos (manual). |
| **Cultura** | Texto narrativo (marujada, Marujos de Saubara, Caboclos de Itaparica). Link **“Ver no mapa”** → pin em Instituições. **Não** são pontos culturais no lateral. |
| **Galeria** | Fotos em grid organizado + **vídeos rodando inline** (YouTube embed); opcional abrir no YouTube. |
| **Memória** | Textos, links, blocos/seções. |
| **Roteiros** | Botões grandes por rota; pontos + linha (polyline). Recomendações, Instagram turismo comunitário. |

**Tirar do lateral:** Produtos (repetia chip Produção do mapa).

### Regra de visibilidade (implementada em `app.js`)

**Princípio:** tem conteúdo → a aba ou o chip **aparece**. Sem conteúdo → **esconde** (evita cliques vazios enquanto o mapa ainda está sendo preenchido).

| Elemento | Aparece quando… |
|----------|-----------------|
| **Território** | sempre |
| **Cultura** | existe item em `cultura[]` |
| **Galeria** | existe foto ou vídeo em `galeria` |
| **Memória** | existe item em `memoria[]` |
| **Roteiros** | existe item em `roteiros[]` |
| **Chip** (Ambiente, História, etc.) | existe pelo menos um ponto na camada em `pontos[]` |
| **Barra de chips** | some se nenhuma camada tiver ponto no território |

Ao trocar de território, o menu **recalcula** sozinho. Se a aba ativa ficar vazia, volta para **Território**.

**Formulário:** gera JSON de ponto → colar em `pontos[]` no `dados.js` → recarregar (`Ctrl+F5`). O chip da camada reaparece automaticamente. Abas (Cultura, Roteiros, etc.) reaparecem quando o conteúdo for colado no campo correspondente do `dados.js`.

**Estado atual (6 territórios Rede):**

| Território | Abas visíveis | Chips visíveis |
|---|---|---|
| RMS | Território, Cultura, Roteiros | História, Instituições, Projetos |
| Baixo Sul | Território | História, Projetos |
| Chapada Diamantina | Território | História, Instituições, Produtos |
| Recôncavo | Território, Cultura | Instituições, Produtos |
| Litoral Sul | Território | História, Instituições, Projetos |
| Portal do Sertão | todas | Instituições |

**Quilombo Lagoa Grande — piloto de conteúdo:**
- Texto Território (parágrafos Palmares, Sabores do Quilombo, etc.)
- 21–22 fotos em `imagens/`
- 3 vídeos YouTube reais
- AQCOMAQ: `-12.136414, -38.989882` (Instituições)
- Instagram @mov.lagoagrande
- Timeline: 2013, 2016, 2022
- 7 subregiões (KML mapa social)
- Tirar frase “Histórias coletivas — sem localização de pessoas”

---

## 6. Menu interno (chips) = pontos no mapa

Ordem **alfabética:**
- **Ambiente** (substitui Água) — patrimônio natural
- **História** — patrimônio histórico
- **Instituições** — gov., ensino, ONG, Ponto/Pontão de Cultura, 25 de Junho (Plataforma/Salvador), Sede Caboclos Itaparica
- **Produtos** (substitui Produção)

**Roteiros:** no **lateral**, não nos chips — mistura tipos (instituição + ambiente + história).

**Pontos mal localizados:** revisar KML dos 5 territórios vs mapa.html. Faltam pontos em **Saubara** e **Serra Grande**.

---

## 7. Roteiros — Fase 1

- Piloto real: **Contra Costa — Ilha de Itaparica** (KML na pasta Itaparica).
- Pontos ordenados + **linha** no mapa (polyline).
- Sem rota formatada: bolinhas + texto “visite X, Y”.
- Meta futura: ~10 roteiros principais por região.
- Fase 2+: rotas calculadas estilo Google (OSRM/API) — **não** para junho.

---

## 8. Compartilhar e incorporar

- Copiar link (como está no mapa.html antigo).
- **+ Incorporar:** snippet iframe da vista atual (27 TI, RMS, Lagoa Grande, etc.).
- Mesmo mapa, mesmas informações; só muda parâmetro na URL.

---

## 9. Offline / internet / escala

- Internet: tiles, fotos, vídeos.
- Offline parcial: polígonos, textos, cliques em polígonos.
- Aviso: “Para ver imagens e vídeos, conecte à internet.”
- Fotos: Drive (conta casadecastroalves@gmail.com) ou thumbnails locais para offline.
- Vídeos: só YouTube (nunca MP4 no projeto).
- Carregar conteúdo **só do território ativo** (escala 27 TI).

---

## 10. Formulário (oficina segunda-feira)

- **`formulario.html`** — página HTML bonita (preferida a Google Form).
- Campos: território, camada, título, endereço, lat/lng (colar), descrição, link, foto opcional.
- Envio: **gerar JSON para copiar** (sem backend na v1).
- Oficina: My Maps (1 mapa/território, **5 layers** = nomes dos chips) → export KML → IG integra.

---

## 11. Responsividade

- Mapa **visível no celular** (WhatsApp, teste offline).
- Problema reportado: sidebar/painel comia altura do mapa no mobile.

---

## 12. Feedback pós-implementação identidade-e-memoria.html (o que deu errado)

- Layout “horroroso” — não reinventar UI do mapa.html.
- Rede movida para menu superior direito — **errado**; voltar ao modal/lista original.
- Compartilhar: ficou só “copiar link”; faltou incorporar funcionando.
- Galeria: bagunça de fotos; vídeos deveriam rodar inline no menu.
- Roteiro: linhas bagunçadas, faltam pontos; Contra Costa incompleto.
- Pontos mal ubicados / faltando em Saubara e Serra Grande.
- **Estratégia:** restaurar mapa.html antigo; avaliar o que serve em identidade-e-memoria; evoluir **em cima do modelo etapa1**, uma mudança por vez.

---

## 13. mapa.html etapa1 — spec original (6 territórios)

- Entrada: `mapa.html` (não index.html).
- UTF-8 em todos os arquivos.
- 6 slugs: itaparica-rm, baixo-sul, chapada-mucuge, reconcavo-saubara, serra-grande, lagoa-grande.
- `?territorio=` na URL.
- Botão **Rede** → modal + mapa com 6 pinos.
- 5 abas lateral: Território, Produtos, Galeria, Roteiros, Memória.
- Chips: Instituições, Memória, Água, Cultura, Produção (versão antiga).
- Timeline no rodapé, contadores reais.
- Lagoa Grande: polígonos MI_LAGOAS_GEO, timeline 2013/2016/2022, Instagram.
- Compartilhar: copiar link / share nativo.

---

*Gerado em 29/05/2026 para continuidade do trabalho.*
