@echo off
cd /d "%~dp0"
title Casa de Castro Alves — Preview

where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: Node.js nao encontrado. Instala em https://nodejs.org
  pause
  exit /b 1
)

echo.
echo  UNICO caminho para ver o site localmente:
echo  Aguarda "PRONTO" no terminal (~2 min na 1.a vez)
echo  NAO uses "astro dev" — nao funciona no Google Drive
echo.

node scripts/ver-site-live.mjs
