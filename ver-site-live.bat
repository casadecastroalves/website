@echo off
cd /d "%~dp0"
title Casa de Castro Alves — Preview

where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: Node.js nao encontrado. Instala em https://nodejs.org
  pause
  exit /b 1
)

node scripts/ver-site-live.mjs
