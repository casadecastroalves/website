@echo off
cd /d "%~dp0"
title Casa de Castro Alves — Preview (NAO FECHAR)

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo  ERRO: Node.js nao encontrado.
  echo  Instala em https://nodejs.org
  echo.
  pause
  exit /b 1
)

echo.
echo  ============================================================
echo   PREVIEW DO SITE — Casa de Castro Alves
echo  ============================================================
echo.
echo   1. Feche tabs antigas com "404: Not Found" no browser
echo   2. Aguarde aparecer "PRONTO" nesta janela (~2 min, 1.a vez)
echo   3. O browser abre sozinho — NAO abra manualmente antes
echo   4. NAO feche esta janela enquanto navega no site
echo   5. Parar: Ctrl+C
echo.
echo   NAO use "astro dev" — nao funciona no Google Drive
echo  ============================================================
echo.

node scripts/ver-site-live.mjs
set EXITCODE=%ERRORLEVEL%

if not "%EXITCODE%"=="0" (
  echo.
  echo  ============================================================
  echo   ERRO no preview. Leia a mensagem acima.
  echo   Depois: feche tabs 404 e execute este ficheiro de novo.
  echo  ============================================================
  echo.
  pause
)
