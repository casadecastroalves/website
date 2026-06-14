@echo off
cd /d "%~dp0"
title Casa de Castro Alves — Visualizador (rapido)

echo.
echo  Visualizador rapido (usa build existente em dist/)
echo  Se nao vir alteracoes recentes, corre ver-site.bat
echo.
echo  Quando aparecer "Visualizador: http://127.0.0.1:4321" abre no browser:
echo    http://127.0.0.1:4321/shows/
echo.
echo  Para parar: Ctrl+C
echo.

call npm.cmd run view
