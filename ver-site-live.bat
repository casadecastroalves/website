@echo off
cd /d "%~dp0"
title Casa de Castro Alves — Live Preview

echo.
echo  LIVE PREVIEW — alteracoes em src/ aparecem ao guardar
echo  Usa Ctrl+C para parar.
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: Node.js nao encontrado. Instala em https://nodejs.org
  pause
  exit /b 1
)

call npm.cmd run dev -- --host 127.0.0.1 --port 4321
