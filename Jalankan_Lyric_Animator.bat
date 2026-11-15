@echo off
title ProPresenter Lyric Animator
cd /d "%~dp0"

echo ========================================================
echo   ProPresenter Lyric Animator
echo   Sinkronisasi Otomatis Theme, Media ^& Animasi Teks
echo ========================================================
echo.
echo Memeriksa dan memperbarui file build aplikasi...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Proses kompilasi build gagal! Periksa pesan error di atas.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo Menjalankan aplikasi ProPresenter Lyric Animator...
if exist "node_modules\electron\dist\electron.exe" (
    start "" "node_modules\electron\dist\electron.exe" "electron\main.cjs"
) else (
    call npx electron .
)
exit
