@echo off
cd /d "%~dp0"
title Casa de Castro Alves — Visualizador

echo.
echo  Casa de Castro Alves — a abrir visualizador...
echo  (nao uses PowerShell para npm — usa este ficheiro ou o CMD)
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERRO: Node.js nao encontrado. Instala em https://nodejs.org
  pause
  exit /b 1
)

echo A construir e a servir em http://127.0.0.1:4321
echo.
echo Quando o terminal mostrar "Visualizador: http://127.0.0.1:4321"
echo abre no browser:  http://127.0.0.1:4321/shows/
echo.
echo Para parar: Ctrl+C nesta janela
echo.

call npm.cmd run view:build
