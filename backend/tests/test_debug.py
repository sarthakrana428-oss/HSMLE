import os, sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.stdout.reconfigure(encoding='utf-8')

print("1. Importing app...", flush=True)
from app.main import app

print("2. Importing TestClient...", flush=True)
from fastapi.testclient import TestClient

print("3. Creating TestClient...", flush=True)
client = TestClient(app)

print("4. Testing GET /health...", flush=True)
res = client.get("/health")
print("Response:", res.status_code, res.json(), flush=True)

print("5. Done!", flush=True)
