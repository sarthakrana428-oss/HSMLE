@echo off
echo ===================================================
echo HSMLE India Corporation - FastAPI Backend Server
echo Port: 8000 ^| Host: 127.0.0.1
echo API Docs: http://127.0.0.1:8000/docs
echo ===================================================
cd /d "%~dp0..\backend"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
pause
