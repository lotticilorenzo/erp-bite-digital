import sys
import os
import traceback
from fastapi.testclient import TestClient

# Add current directory to path to import app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app

def trigger_500():
    client = TestClient(app)
    
    print("--- Tentativo di login ---")
    login_data = {"username": "lorenzo@biteagency.com", "password": "BiteAgency-155B3984!"}
    # Standard OAuth2 form login
    resp = client.post("/api/v1/auth/login", data=login_data)
    
    if resp.status_code != 200:
        print(f"Login fallito: {resp.status_code}")
        print(resp.text)
        return

    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    print("--- Chiamata a /api/v1/tasks?parent_only=true ---")
    try:
        resp = client.get("/api/v1/tasks?parent_only=true", headers=headers)
        print(f"Status: {resp.status_code}")
        if resp.status_code == 500:
            print("Errore 500 rilevato!")
            # The error should have been printed to stderr by our handlers
        else:
            print(f"Risposta: {resp.text[:200]}")
    except Exception:
        traceback.print_exc()

if __name__ == "__main__":
    trigger_500()
