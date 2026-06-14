"""Debug the login 500 error"""
import urllib.request
import urllib.error
import json
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE = "http://127.0.0.1:8001/api/v1"

def test(method, path, token=None, body=None):
    url = BASE + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    data = json.dumps(body).encode() if body else None
    try:
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            bd = json.loads(e.read())
        except Exception:
            bd = {}
        return e.code, bd
    except Exception as e:
        return "ERR", str(e)

# Try login with non-existent email
s, r = test("POST", "/auth/login", body={"email": "nobody@x.com", "password": "bad"})
print(f"Status: {s}")
print(f"Response: {json.dumps(r, indent=2)}")

# Try login with existing user + wrong password  
s2, r2 = test("POST", "/auth/login", body={"email": "rec99@facesnap.dev", "password": "wrongpassword"})
print(f"\nStatus (wrong pass): {s2}")
print(f"Response: {json.dumps(r2, indent=2)}")
