@echo off
cd /d "%~dp0"
echo.
echo  Mapa Movimento Irun — versao MAPA MELHORADO
echo  Abrindo http://127.0.0.1:8099
echo  (nao feche esta janela enquanto usar o mapa)
echo.
start http://127.0.0.1:8099/
python -m http.server 8099
