# Branches Git — 1. WEBSITES

> **Regra:** nunca assumir `master`. Consultar esta tabela antes de `git push`.

| Pasta | Branch | Remoto | Notas |
|---|---|---|---|
| `sestepa-design` | `master` | `origin/master` | Cloudflare Pages |
| `ines-grimaux` | `master` | `origin/master` | Netlify |
| `grimaux-net` | `master` | `origin/master` | Cloudflare Pages |
| `castro-alves` | **`main`** | `origin/main` | Unico repo com `main` — deploy Cloudflare configurado assim |

## Porque castro-alves usa main?

O repositório `casadecastroalves/website` foi criado com branch default `main`. Migrar para `master` exigiria alterar GitHub + Cloudflare em producao. Os outros tres sites ja estavam em `master`.

**Para IAs:** ao fazer push em castro-alves:

```powershell
git push origin main
```

Nos outros:

```powershell
git push origin master
```

## Helper automatico

```powershell
python scripts/push_site.py castro-alves "chore: atualizar docs"
python scripts/push_site.py sestepa-design "content: novo projecto"
```

O script detecta a branch correcta via `sites.json`.
