@echo off
echo ===================================================
echo HSMLE India Corporation - FastAPI Backend Server
echo Port: 8000 ^| Host: 127.0.0.1
echo API Docs: http://127.0.0.1:8000/docs
echo ===================================================
cd /d "%~dp0..\backend"
set "PYTHON_CMD=python"
if exist "%~dp0..\..\..\PORTAL\.venv\Scripts\python.exe" set "PYTHON_CMD=%~dp0..\..\..\PORTAL\.venv\Scripts\python.exe"
"%PYTHON_CMD%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
