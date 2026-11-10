@echo off
echo ===================================================
echo Starting HSMLE India Corporation Complete Portal
echo 1. Backend Server at http://127.0.0.1:8000
echo 2. Frontend Web App at http://localhost:5173
echo 3. API Docs at http://127.0.0.1:8000/docs
echo ===================================================

start "HSMLE Backend" cmd /k "call "%~dp0start-backend.bat""
timeout /t 3 /nobreak >nul
start "HSMLE Frontend" cmd /k "call "%~dp0start-frontend.bat""
timeout /t 2 /nobreak >nul

echo Opening web browser at http://localhost:5173...
start http://localhost:5173
