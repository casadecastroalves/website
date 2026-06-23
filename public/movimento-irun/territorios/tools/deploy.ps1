# =====================================================================
#  Deploy do mapa territorial -> casadecastroalves.com.br (Cloudflare Pages)
#  Comprime ficheiros grandes, commit e push no repo castro-alves.
#
#  IMPORTANTE: a pasta "admin/" (painel de administracao do site) e
#  SEMPRE preservada -- nunca e apagada por este script.
#
#  Uso (a partir de territorios/tools/):
#    pwsh -File deploy.ps1                 # deploy normal
#    pwsh -File deploy.ps1 -DryRun         # so mostra o que mudaria
#    pwsh -File deploy.ps1 -Message "..."  # mensagem de commit propria
# =====================================================================
param(
  [switch]$DryRun,
  [string]$Message
)

$ErrorActionPreference = "Stop"

$MapRoot = Split-Path $PSScriptRoot -Parent
$Repo    = (Resolve-Path (Join-Path $MapRoot "..\..\..\..")).Path

if (-not (Test-Path (Join-Path $MapRoot "index.html"))) {
  throw "Mapa nao encontrado em: $MapRoot"
}
if (-not (Test-Path (Join-Path $Repo ".git"))) {
  throw "Repositorio git nao encontrado em: $Repo"
}

if (-not (Test-Path (Join-Path $MapRoot "admin\index.html"))) {
  Write-Host "Aviso: admin/index.html nao encontrada no mapa (ok se ainda nao existir)." -ForegroundColor Yellow
}

if (-not $DryRun) {
  $compress = Join-Path $PSScriptRoot "compress-for-deploy.py"
  if (Test-Path $compress) {
    Write-Host "==> A comprimir ficheiros >24 MB (originais em originais/ ficam intactos)..." -ForegroundColor Cyan
    python $compress $MapRoot
    if ($LASTEXITCODE -ne 0) { throw "Compressao falhou — ver ficheiros acima do limite Cloudflare (25 MB)" }
    Write-Host "    Compressao OK." -ForegroundColor Green
  }
}

if ($DryRun) {
  Write-Host "==> DryRun: nenhuma alteracao publicada." -ForegroundColor Yellow
  return
}

Push-Location $Repo
try {
  git add -A
  $status = git status --porcelain
  if (-not $status) {
    Write-Host "==> Nada para publicar (site ja atualizado)." -ForegroundColor Yellow
    return
  }
  if (-not $Message) {
    $Message = "chore(mapa): atualizar mapa territorial Movimento Irun"
  }
  git commit -m $Message
  git push origin main
  Write-Host "==> Push para GitHub concluido." -ForegroundColor Green
  Write-Host ""
  Write-Host "Site: https://casadecastroalves.com.br/movimento-irun/territorios/" -ForegroundColor Cyan
}
finally {
  Pop-Location
}
