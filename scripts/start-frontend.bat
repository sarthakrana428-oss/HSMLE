@echo off
echo ===================================================
echo HSMLE India Corporation - Frontend Web Server
echo URL: http://localhost:5173
echo Serving from: ..\frontend
echo ===================================================
cd /d "%~dp0..\frontend"
python -m http.server 5173 --bind 127.0.0.1
pause
