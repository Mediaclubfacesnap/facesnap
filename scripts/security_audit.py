import requests
import sys

print("Starting Security Audit Suite...")
BASE_URL = "http://localhost:8000/api/v1"

def check_endpoint_auth(endpoint):
    print(f"Testing Auth Enforcement on {endpoint}...")
    try:
        res = requests.get(f"{BASE_URL}{endpoint}", timeout=5)
        if res.status_code == 401:
            print(f"  [PASS] {endpoint} properly blocked unauthenticated access (401).")
        else:
            print(f"  [FAIL] {endpoint} returned {res.status_code} instead of 401.")
    except Exception as e:
        print(f"  [ERROR] {e}")

if __name__ == "__main__":
    endpoints_to_check = [
        "/users/me",
        "/admin/operations/dashboard",
        "/messages",
        "/communities"
    ]
    
    for ep in endpoints_to_check:
        check_endpoint_auth(ep)
        
    print("Security Audit Complete.")
