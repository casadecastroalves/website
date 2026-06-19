@echo off
echo Iniciando servidor local para poder ver el mapa moderno...
start http://127.0.0.1:8080/index.html
python -m http.server 8080
