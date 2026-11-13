@echo off
echo ===================================================
echo HSMLE India Corporation - Frontend Web Server
echo URL: http://localhost:5173
echo Serving from: ..\frontend
echo ===================================================
cd /d "%~dp0..\frontend"
set "PYTHON_CMD=python"
if exist "%~dp0..\..\..\PORTAL\.venv\Scripts\python.exe" set "PYTHON_CMD=%~dp0..\..\..\PORTAL\.venv\Scripts\python.exe"
"%PYTHON_CMD%" -m http.server 5173 --bind 127.0.0.1
pause
