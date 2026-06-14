"""
FaceSnap Recovery Endpoint Test - ASCII safe version
"""
import urllib.request
import urllib.error
import json
import sys

# Force UTF-8 output
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

results = []

def chk(label, s, good):
    ok = s in good
    tag = "[OK]  " if ok else "[FAIL]"
    print(tag + " " + label + ": HTTP " + str(s))
    results.append(ok)
    return ok

print("=" * 70)
print("FACESNAP RECOVERY ENDPOINT TEST")
print("=" * 70)

# 1. Health
s, r = test("GET", "/health")
chk("GET /health", s, [200])

# 2. /auth/me no token (must NOT be 500)
s, r = test("GET", "/auth/me")
chk("GET /auth/me (no token) not 500", s, [401, 403, 422])

# 3. Login bad creds (must NOT be 500)
s, r = test("POST", "/auth/login", body={"email": "nobody@x.com", "password": "bad"})
chk("POST /auth/login bad creds not 500", s, [401, 403])

# 4. Signup / login
token = None
s, r = test("POST", "/auth/signup", body={
    "username": "rec99",
    "email": "rec99@facesnap.dev",
    "password": "TestPass123!",
    "full_name": "Rec Test"
})
if s == 201:
    token = r.get("access_token")
    chk("POST /auth/signup -> 201", s, [201])
elif s == 400 and "already" in str(r.get("detail", "")).lower():
    print("[INFO] User already exists, logging in...")
    s2, r2 = test("POST", "/auth/login", body={"email": "rec99@facesnap.dev", "password": "TestPass123!"})
    token = r2.get("access_token") if isinstance(r2, dict) else None
    chk("POST /auth/login (existing user)", s2, [200])
else:
    chk("POST /auth/signup", s, [201])
    print("       detail=" + str(r.get("detail", r)))

print("Token acquired: " + ("YES" if token else "NO"))

if token:
    print("\n--- Authenticated Endpoint Tests ---")
    
    s, r = test("GET", "/auth/me", token=token)
    chk("GET /auth/me -> 200", s, [200])
    if s == 200:
        print("       email=" + str(r.get("email")) + " role=" + str(r.get("platform_role")))
    else:
        print("       detail=" + str(r.get("detail", r)))
    
    s, r = test("GET", "/communities/my-groups", token=token)
    chk("GET /communities/my-groups -> 200", s, [200])
    
    s, r = test("GET", "/communities/my-roles", token=token)
    chk("GET /communities/my-roles -> 200", s, [200])
    
    s, r = test("GET", "/communities/my-invitations", token=token)
    chk("GET /communities/my-invitations -> 200", s, [200])
    
    s, r = test("GET", "/notifications/", token=token)
    chk("GET /notifications/ -> 200", s, [200])
    if s != 200:
        print("       detail=" + str(r.get("detail", r)))
    
    s, r = test("POST", "/communities/", token=token, body={
        "title": "RecTest Community",
        "description": "Recovery test community",
        "category": "Technology"
    })
    chk("POST /communities/ (201 or 403, NOT 500)", s, [201, 403])
    if s == 403:
        print("       (403 expected - user needs can_create_communities flag)")
    elif s == 201:
        print("       Community created! id=" + str(r.get("id")))
    else:
        print("       Unexpected! detail=" + str(r.get("detail", r)))

print("")
print("=" * 70)
passed = sum(1 for ok in results if ok)
failed = len(results) - passed
print("RESULTS: " + str(passed) + "/" + str(len(results)) + " passed | " + str(failed) + " failed")
print("=" * 70)

if failed > 0:
    print("\nFailed tests:")
    for i, (ok) in enumerate(results):
        if not ok:
            print("  FAILED: test #" + str(i + 1))
