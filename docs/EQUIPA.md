# castro-alves — guia rápido para agentes

> **AVISO IA:** No inicio de CADA sessao: `python scripts/set_lock_agent.py Cursor` (ou a tua ferramenta). **Nao assumir Antigravity.**
> **Branch deste repo: `main`** (nao master). Push: `git push origin main` ou `python scripts/push_site.py castro-alves "msg"`
> **Drive obrigatorio:** ver `docs/equipa/PARA-CLONE-SEM-DRIVE.md`

| | |
|---|---|
| **Pasta Drive** | `castro-alves` |
| **Domínio** | https://casadecastroalves.com.br |
| **GitHub** | casadecastroalves/website |
| **Branch** | `main` |
| **Mapa territórios** | `public/movimento-irun/territorios/` |

## Identidade (obrigatório)

```powershell
python "G:\Meu Drive\1. WEBSITES\scripts\set_lock_agent.py" Cursor castro-alves
python "G:\Meu Drive\1. WEBSITES\scripts\set_lock_agent.py" --show
```

| Ferramenta | Nome |
|---|---|
| Cursor | `Cursor` |
| Claude Code | `Claude-Code` |
| Antigravity | `Antigravity` |

## Fluxo de trabalho

```powershell
cd "G:\Meu Drive\1. WEBSITES"
python scripts\lock_manager.py acquire-auto castro-alves "descrição"
cd castro-alves\codigo
git add -A && git commit -m "mensagem" && git push origin main
python "G:\Meu Drive\1. WEBSITES\scripts\lock_manager.py" release castro-alves
```

## Documentação completa

| Ficheiro | Local |
|---|---|
| Manual operativo | `docs/equipa/INSTRUCOES.md` |
| Setup editores | `docs/equipa/SETUP-EDITORES.md` |
| Drive | `G:\Meu Drive\1. WEBSITES\INSTRUCOES.md` |
