@echo off
cd /d "%~dp0"
title Casa de Castro Alves — Live Preview

echo.
echo  LIVE PREVIEW — reload automatico ao editar src/
echo  Usa este ficheiro enquanto trabalhas no site.
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: Node.js nao encontrado. Instala em https://nodejs.org
  pause
  exit /b 1
)

call npm.cmd run watch
