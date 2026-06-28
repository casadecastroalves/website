# 1. WEBSITES — Central de todos os websites
> Documento autoritativo. Válido para: qualquer IA, qualquer pessoa, qualquer computador.
> Última actualização: 23 Jun 2026
>
> **Entrada para IAs:** ler `LEIA-PRIMEIRO-IA.md` antes de tudo.
> Diagnóstico: `relatorio_auditoria.md` · Editores: `SETUP-EDITORES.md` · Branches: `BRANCHES.md` · Escalar: `ESCALA.md`
> Metadados: `sites.json` · Apos editar docs: `python scripts/sync_equipa_docs.py`

---

## PROTOCOLO DE CONCORRÊNCIA E LOCKS — OBRIGATÓRIO

O Google Drive **não** resolve conflitos de código. Antes de **qualquer** modificação num projecto, humano ou IA deve verificar o lock.

### Regra

1. **Ler** `TRABALHANDO.json` na raiz do projecto (ex: `sestepa-design/TRABALHANDO.json`)
2. Se **ocupado** por outro agente (heartbeat < 30 min) → **parar** e não editar
3. Se **livre** ou lock **órfão** (> 30 min sem heartbeat) → adquirir lock antes de trabalhar
4. Ao **terminar** → libertar o lock (`release`)

### Script automático

```powershell
cd "G:\Meu Drive\1. WEBSITES"

# Ver identidade desta máquina (usar no acquire e no pre-push)
python scripts/lock_manager.py agent-identity sestepa-design

# Configurar identidade fixa para uma IA (recomendado)
cd sestepa-design\codigo
git config websites.lockAgent "Cursor"

# Verificar se está livre
python ..\..\scripts\lock_manager.py check sestepa-design

# Trancar antes de trabalhar (automático — usa websites.lockAgent ou user.name)
cd "G:\Meu Drive\1. WEBSITES"
python scripts/lock_manager.py acquire-auto sestepa-design "Refatorar galeria"

# Libertar ao terminar (mesma identidade)
python scripts/lock_manager.py release sestepa-design

# Ver todos os locks activos
python scripts/lock_manager.py status
```

### Identidade do agente (obrigatório para push)

O nome no `TRABALHANDO.json` **tem de coincidir** com a identidade usada no hook `pre-push`. Ordem de prioridade:

1. Variável de ambiente `WEBSITES_LOCK_AGENT`
2. `git config websites.lockAgent` (no `codigo/` do projecto)
3. `git config user.name`

**Humanos:** normalmente basta o `user.name` já configurado.  
**IAs (Cursor, Antigravity, etc.):** configurar uma vez por repo — ou todos de uma vez:

```powershell
cd "G:\Meu Drive\1. WEBSITES"
python scripts/set_lock_agent.py Cursor              # todos os 4 repos
python scripts/set_lock_agent.py Antigravity castro-alves   # só um repo
python scripts/set_lock_agent.py --show              # ver identidades actuais
```

Equivalente manual:
```powershell
cd castro-alves\codigo
git config websites.lockAgent "Antigravity"
```

Depois usar sempre `acquire-auto` — nunca inventar outro nome no `acquire` manual.

### Barreira no Git (pre-push hook)

Cada `codigo/.git/hooks/pre-push` bloqueia `git push` se o lock pertencer a outro agente.

**Num computador novo**, instalar os hooks:

```powershell
cd "G:\Meu Drive\1. WEBSITES"
python scripts/install_hooks.py
```

O hook chama `lock_manager.py check` com a identidade resolvida automaticamente.

### Formato de `TRABALHANDO.json`

```json
{
  "projeto": "sestepa-design",
  "agente": "Nome_da_IA_ou_Humano",
  "timestamp_inicio": "2026-06-23T11:32:00-03:00",
  "timestamp_ultimo_heartbeat": "2026-06-23T11:35:00-03:00",
  "mensagem": "Refatorando a galeria de fotos."
}
```

### Timeout (locks órfãos)

Se `timestamp_ultimo_heartbeat` tiver **mais de 30 minutos**, o lock é considerado órfão (IA caiu ou humano esqueceu aberto). Um novo agente pode sobrescrever **após imprimir aviso** no terminal.

**Renovar durante trabalho longo:** correr `acquire` de novo com o mesmo nome de agente — actualiza o heartbeat.

---

## PARA QUALQUER COLABORADOR — LER PRIMEIRO

Esta pasta está em Google Drive (G:) e sincroniza automaticamente entre todos os computadores da equipa.

---

### PROTOCOLO DE INÍCIO DE SESSÃO — OBRIGATÓRIO

**1. Google Drive sincronizado** (ícone sem seta a girar).

**2. Identidade desta ferramenta** — no início de CADA sessão:

```powershell
cd "G:\Meu Drive\1. WEBSITES"
python scripts/set_lock_agent.py Cursor    # ou Claude-Code, Antigravity — NUNCA assumir Antigravity
python scripts/set_lock_agent.py --show
```

**3. Lock antes de editar:** `python scripts/lock_manager.py acquire-auto <projecto> "tarefa"`

**4. Branch correcta no push** — ver `BRANCHES.md` (castro-alves = `main`, resto = `master`).

Helper: `python scripts/push_site.py <projecto> "mensagem"`

```powershell
# Verificar se o Drive está sincronizado — correr antes de começar
$ultimo_local = (Get-ChildItem "G:\Meu Drive\1. WEBSITES" -Recurse -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1)
Write-Output "Último ficheiro modificado localmente: $($ultimo_local.Name) — $($ultimo_local.LastWriteTime)"
# Se a data for muito antiga face ao esperado, pedir sync ao humano
```

**Sinais de Drive não sincronizado:**
- Ícone do Google Drive com seta a girar há muito tempo
- Ficheiros com data muito antiga comparado com o que foi editado recentemente

**Regra:** em caso de dúvida, não trabalhar — pedir ao humano para verificar o sync primeiro.

---

### Setup inicial num computador novo (5 minutos)

```
1. Instalar Google Drive Desktop
2. Conectar com a conta Google da equipa
3. Clicar com botão direito em "1. WEBSITES" → Disponível offline
4. Abrir qualquer pasta de projecto — a IA lê o ONDE-ESTA-TUDO.md e sabe o que fazer
5. Para sites Astro: cd codigo/ → npm install  (uma vez por máquina)
6. Pronto — editar, git push, o site actualiza automaticamente
```

**Não é preciso mais nada.** Não há servidores, não há configurações especiais.

---

## FILOSOFIA

- **Tudo em G:** — source code sincronizado via Google Drive, disponível em qualquer computador
- **node_modules nunca aqui** — regenerar com `npm install` em cada máquina (são centenas de mil ficheiros, destroem o sync)
- **Git é o backup** — cada projecto tem repo GitHub, cada commit é um ponto de restauro
- **Nomes sem caracteres especiais** — sem apóstrofes, espaços mínimos, bom para SEO e para as IAs
- **Crescimento organizado** — adicionar novo website = criar nova pasta aqui com o mesmo padrão
- **Ficheiros > 25MB nunca no código** — Cloudflare recusa deploy. Ver regra abaixo.

---

## LIMITES DAS CONTAS GRATUITAS — MONITORIZAR

Todas as contas são gratuitas. A IA avisa quando um limite se aproximar.

| Serviço | Limite | Estado actual | Aviso quando |
|---|---|---|---|
| **Cloudflare Pages** | 500 builds/mês | — | >400 builds/mês |
| **Cloudflare Pages** | 20.000 ficheiros/deploy | sestepa ~600 OK | >15.000 ficheiros |
| **Cloudflare Pages** | 25MB por ficheiro | OK | qualquer ficheiro >20MB |
| **GitHub repos** | 1GB recomendado por repo | sestepa 346MB OK · castro 347MB OK · ines 354MB OK | >800MB num repo |
| **Netlify** (inesgrimaux) | 100GB bandwidth/mês | — | monitorizar se tráfego crescer |

**Se um limite se aproximar:** a IA para, avisa e propõe solução antes de continuar.

---

## DISCO J: — NUNCA TOCAR

**O disco J: é da empresa S'Estepa. Nenhuma IA nem colaborador externo deve ler, escrever, mover ou apagar ficheiros do disco J:.**

- J: contém ficheiros originais da empresa (projectos, renders, documentos internos)
- É um disco de rede ou externo partilhado pela equipa presencial
- Qualquer acesso ao J: requer autorização explícita de Sofia / equipa S'Estepa
- Se uma tarefa parecer requerer ficheiros do J:, parar e perguntar ao humano responsável

---

## WEBSITES ACTIVOS

| Pasta | Domínio | Branch | Hosting | GitHub | Tipo |
|---|---|---|---|---|---|
| `sestepa-design/` | design.sestepa.com | `master` | Cloudflare | sestepadesign/WEBSITE | Astro |
| `ines-grimaux/` | inesgrimaux.com | `master` | Netlify | inesgrimaux/portfolio | HTML estático |
| `grimaux-net/` | grimaux.net | `master` | Cloudflare | Grimaux/grimaux-net | HTML estático |
| `castro-alves/` | casadecastroalves.com.br | **`main`** | Cloudflare | casadecastroalves/website | Astro |

---

## ESTRUTURA PADRÃO DE CADA PASTA

```
nome-do-site/
├── ONDE-ESTA-TUDO.md          ← ler primeiro — instruções completas para qualquer IA
├── codigo/                    ← source code (git aqui dentro)
└── originais-grandes/         ← ficheiros > 25MB (não vão para git nem para deploy)
```

Para sites Astro, o fluxo é sempre:
```
EDITAR → codigo/src/
DEV    → npm run dev     (preview local — http://localhost:4321)
BUILD  → Cloudflare faz automaticamente no push (npm run build → dist/)
PUSH   → git push → deploy automático em ~2 min
```

**Política de branches:** trabalho directo na branch de produção. **Sem feature branches.**

| Pasta | Branch |
|---|---|
| sestepa-design, ines-grimaux, grimaux-net | `master` |
| castro-alves | **`main`** |

Detalhe: `BRANCHES.md` · helper: `python scripts/push_site.py <projecto> "msg"`

---

## REGRA — FICHEIROS GRANDES (Cloudflare limite 25MB)

**Cloudflare Pages recusa deploy se qualquer ficheiro for maior que 25MB.**  
Isto causa falhas silenciosas difíceis de diagnosticar — horas perdidas.

### Protocolo obrigatório antes de qualquer git push

```powershell
# Verificar ficheiros > 25MB no projecto
Get-ChildItem "codigo" -Recurse -File |
  Where-Object { $_.Length -gt 25MB } |
  Select-Object FullName, @{N="MB";E={[math]::Round($_.Length/1MB,1)}}
```

**Se existirem ficheiros > 25MB:**
1. Mover para `originais-grandes/` (fora do git)
2. Adicionar ao `.gitignore` se necessário
3. Guardar versão reduzida/comprimida dentro de `codigo/`

### O que vai para `originais-grandes/`

- PDFs originais de alta resolução
- Vídeos originais (usar link YouTube/Vimeo no site)
- Renders 3D originais, ficheiros PSD/AI grandes
- Qualquer ficheiro > 25MB que precise de ser preservado mas não deployado

**Esta pasta sincroniza via Google Drive mas nunca vai para GitHub nem Cloudflare.**

---

## COMO ADICIONAR UM WEBSITE NOVO

1. Copiar estrutura de `_TEMPLATE/` → `novo-site/`
2. Preencher `novo-site/ONDE-ESTA-TUDO.md` (modelo em `_TEMPLATE/ONDE-ESTA-TUDO.md`)
3. Criar `novo-site/codigo/` e fazer `git clone` do repo
4. Copiar `_TEMPLATE/gitattributes.txt` → `codigo/.gitattributes`
5. Actualizar tabela "WEBSITES ACTIVOS" e `sites.json`
6. `python scripts/install_hooks.py`
7. Nunca colocar `node_modules` dentro de `G:\Meu Drive\`

---

## CONTAS — CADA PROJECTO TEM A SUA CONTA SEPARADA

| Site | GitHub | Deploy | Email |
|---|---|---|---|
| sestepa-design | sestepadesign | Cloudflare | sestepadesign@gmail.com |
| grimaux-net | Grimaux | Cloudflare | grimaux@gmail.com |
| castro-alves | casadecastroalves | Cloudflare | casadecastroalves@gmail.com |
| ines-grimaux | inesgrimaux | Netlify | inesgrimaux@gmail.com |

### Mudar conta GitHub no terminal
```powershell
gh auth switch --user sestepadesign      # sestepa
gh auth switch --user Grimaux            # grimaux.net
gh auth switch --user casadecastroalves  # castro alves
# inesgrimaux — adicionar com: gh auth login
```

---

## NOTA — sestepa-design

Migração concluída em 23 Jun 2026. Código fonte agora em:
`G:\Meu Drive\1. WEBSITES\sestepa-design\codigo\`

A pasta `sestepa-design/` aqui é uma referência — ver o `ONDE-ESTA-TUDO.md` dentro para instruções completas.
O código não foi duplicado para não criar confusão.
