import subprocess
import sys
import os
import time

base_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.join(base_dir, "backend")
frontend_script = os.path.join(base_dir, "run_frontend_server.py")

print("=" * 60)
print("Starting HSMLE India Corporation Full-Stack Servers")
print("1. Backend API: http://127.0.0.1:8000")
print("2. API Documentation: http://127.0.0.1:8000/docs")
print("3. Frontend Web App: http://localhost:5173")
print("=" * 60)

# Launch backend
backend_proc = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"],
    cwd=backend_dir
)

# Launch frontend
frontend_proc = subprocess.Popen(
    [sys.executable, frontend_script]
)

try:
    while True:
        time.sleep(1)
        if backend_proc.poll() is not None:
            print("Backend process exited unexpectedly.")
            break
        if frontend_proc.poll() is not None:
            print("Frontend process exited unexpectedly.")
            break
except KeyboardInterrupt:
    print("Stopping servers...")
    backend_proc.terminate()
    frontend_proc.terminate()
