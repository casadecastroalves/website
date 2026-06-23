# Setup de editores e agentes — 1. WEBSITES

> Padrões partilhados no Google Drive. **Não** sincronizar settings globais entre Cursor, Claude Code e Antigravity.

---

## Princípio

| Integrar | Não integrar |
|---|---|
| Formatação no repo (`.editorconfig`, `.gitattributes`) | Atalhos de IA (chat, composer, agente) |
| Regras operativas (`INSTRUCOES.md`, locks) | Credenciais, MCP, API keys |
| Identidade por ferramenta (`websites.lockAgent`) | Perfis globais do utilizador |

---

## Ficheiros no Drive (todos respeitam)

| Ficheiro | Onde | Função |
|---|---|---|
| `.editorconfig` | `1. WEBSITES/` | Indentação, UTF-8, LF — lido por qualquer editor |
| `.vscode/settings.json` | `1. WEBSITES/` | Exclusões, EOL — ao abrir a pasta central |
| `.gitattributes` | cada `codigo/` | Git normaliza LF nos commits |
| `INSTRUCOES.md` | `1. WEBSITES/` | Locks, deploy, limites |
| `scripts/lock_manager.py` | `1. WEBSITES/scripts/` | Concorrência multi-agente |
| `scripts/set_lock_agent.py` | `1. WEBSITES/scripts/` | Definir `websites.lockAgent` por ferramenta |
| `docs/EQUIPA.md` | cada `codigo/docs/` | Guia rápido (também no GitHub) |
| `docs/equipa/INSTRUCOES.md` | cada `codigo/docs/equipa/` | Cópia do manual para clone remoto |

**Nota:** se abrires só `projecto/codigo/` no editor, o `.editorconfig` do pai ainda aplica. Para settings VS Code, preferir abrir `1. WEBSITES` ou `projecto/` como workspace.

---

## Por ferramenta

### Cursor (IDE)

1. Abrir `G:\Meu Drive\1. WEBSITES` (ou pasta do projecto)
2. `python scripts/install_hooks.py` (primeira vez)
3. `python scripts/set_lock_agent.py Cursor` (todos os repos — **não** usar `Antigravity` se trabalhas no Cursor)
4. Antes de editar: `python scripts/lock_manager.py acquire-auto sestepa-design "tarefa"`
5. Ao terminar: `python scripts/lock_manager.py release sestepa-design`

### Claude Code (CLI)

1. Trabalhar a partir de paths no `G:\Meu Drive\1. WEBSITES\...`
2. Mesmos hooks e locks que Cursor
3. Identidade recomendada:
   ```powershell
   python scripts/set_lock_agent.py Claude-Code
   ```
4. Respeitar `.editorconfig` em todas as edições de ficheiro

### Antigravity (agente autónomo)

1. Lê/escreve ficheiros directamente no `G:\` — sem GUI
2. **Deve** seguir `INSTRUCOES.md`, locks e `.editorconfig`
3. Identidade recomendada:
   ```powershell
   python scripts/set_lock_agent.py Antigravity
   ```
   Em máquinas paralelas: `python scripts/set_lock_agent.py Antigravity-Notebook castro-alves`
4. Usar `acquire-auto` antes de modificar; `release` ao concluir

### Humanos

- Normalmente basta `git config user.name` já configurado
- Ou definir `websites.lockAgent` com o nome preferido
- Instalar Google Drive Desktop + hooks + `npm install` nos sites Astro

---

## Identidades de lock (convenção)

| Agente | `websites.lockAgent` |
|---|---|
| Cursor | `Cursor` |
| Claude Code | `Claude-Code` |
| Antigravity | `Antigravity` (ou `Antigravity-<máquina>`) |
| Humano | `git config user.name` ou nome escolhido |

O hook `pre-push` usa a mesma identidade — sem coincidência, o push é bloqueado.

---

## Primeira vez num computador novo

```
1. Google Drive Desktop → sincronizar 1. WEBSITES
2. python scripts/install_hooks.py
3. Por cada site Astro: cd projecto/codigo → npm install
4. git config websites.lockAgent "<sua-ferramenta>" em cada codigo/
5. Ler ONDE-ESTA-TUDO.md do projecto alvo
```

---

## O que não fazer

- Não copiar `settings.json` global entre Cursor e Claude Code
- Não colocar `node_modules` no Google Drive
- Não editar sem lock quando outro agente está activo
- Não ignorar `.gitattributes` — evita ruído CRLF nos commits
