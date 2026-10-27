@echo off
REM Abre o Panorama Brasil num servidor local (precisa do Node.js instalado)
cd /d "%~dp0"
start "" http://localhost:8080
node server.js 8080
