# Acesso ao Google Drive — obrigatorio para operar

## Clone GitHub sozinho NAO basta

Este repositorio contem **codigo e documentacao do site**, mas o sistema da equipa (locks, hooks, scripts partilhados) vive em:

```
G:\Meu Drive\1. WEBSITES\scripts\
```

## O que consegues SEM o Drive

- Ler e editar codigo localmente (clone)
- Ver `docs/EQUIPA.md` e `docs/equipa/INSTRUCOES.md` (copias no repo)

## O que EXIGE o Drive

| Accao | Script / ficheiro |
|---|---|
| Trancar projecto | `G:\...\scripts\lock_manager.py` |
| Identidade da IA | `G:\...\scripts\set_lock_agent.py` |
| Instalar hooks | `G:\...\scripts\install_hooks.py` |
| Manual completo | `G:\...\LEIA-PRIMEIRO-IA.md` |
| Metadados sites | `G:\...\sites.json` |

## Inicio de sessao (qualquer IA)

```powershell
cd "G:\Meu Drive\1. WEBSITES"
python scripts/set_lock_agent.py Cursor          # NAO usar Antigravity se fores Cursor
python scripts/set_lock_agent.py --show
python scripts/lock_manager.py acquire-auto <pasta-projecto> "tarefa"
```

## Branch deste repo

Ver `docs/EQUIPA.md` ou `G:\Meu Drive\1. WEBSITES\BRANCHES.md` — **nao assumir master**.
