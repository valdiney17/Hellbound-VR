@echo off
echo ========================================
echo   HTTPS Local para Quest 2 VR
echo ========================================
echo.

REM Verificar se mkcert esta instalado
where mkcert >nul 2>&1
if %errorlevel% neq 0 (
    echo Instalando mkcert...
    npm install -g mkcert
    mkcert -install
)

REM Gerar certificados
if not exist "certs\localhost.pem" (
    echo Gerando certificados...
    mkdir certs 2>nul
    cd certs
    mkcert -key-file key.pem -cert-file cert.pem localhost 127.0.0.1 ::1 192.168.5.54
    cd ..
)

echo.
echo Iniciando servidor HTTPS...
echo.
echo ========================================
echo   ABRA NO QUEST:
echo   https://localhost/fps
echo.
echo   OU PELO IP:
echo   https://192.168.5.54/fps
echo ========================================
echo.

npx --yes http-server . -p 443 --ssl -c-1 -a 0.0.0.0 --cert certs/cert.pem --key certs/key.pem
