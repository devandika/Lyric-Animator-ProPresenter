@echo off
title ProPresenter Lyric Animator
cd /d "%~dp0"
echo Menjalankan ProPresenter Lyric Animator Standalone Window...
start "" "node_modules\electron\dist\electron.exe" "electron\main.cjs"
exit
