import requests
import random
import json
import time

BASE_URL = "http://localhost:8001/api/v1"

def promote_user_in_db(email):
    print("[DB] Starting database promotion...")
    import asyncio
    import sys
    import os
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from app.database import AsyncSessionLocal
    from app.models import User
    from sqlalchemy import select

    async def _run():
        print("[DB] Creating AsyncSession...")
        async with AsyncSessionLocal() as session:
            print("[DB] Querying user...")
            stmt = select(User).where(User.email == email)
            result = await session.execute(stmt)
            user = result.scalar_one_or_none()
            if user:
                print("[DB] Modifying user attributes...")
                user.can_create_communities = True
                user.can_create_events = True
                await session.commit()
                print(f"[DB] Promoted {email} to have community & event creation privileges.")
            else:
                print(f"[DB] User {email} not found for promotion.")

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    print("[DB] Running async loop...")
    loop.run_until_complete(_run())
    print("[DB] Async loop finished.")

def run_diagnose():
    suffix = random.randint(10000, 99999)
    email = f"diagnose_{suffix}@example.com"
    username = f"diag_{suffix}"
    
    print("--- 1. REGISTERING USER ---")
    t0 = time.time()
    res = requests.post(f"{BASE_URL}/auth/signup", json={
        "username": username,
        "email": email,
        "password": "password123",
        "full_name": "Diagnose User"
    })
    print(f"Signup Status: {res.status_code} (took {time.time()-t0:.2f}s)")
    if res.status_code != 201:
        print(f"Signup Failed: {res.text}")
        return
    
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    t0 = time.time()
    promote_user_in_db(email)
    print(f"Promotion took {time.time()-t0:.2f}s")

    endpoints = [
        ("GET", "/auth/me", None),
        ("GET", "/communities/my-groups", None),
        ("GET", "/communities/my-roles", None),
        ("GET", "/communities/my-invitations", None),
        ("GET", "/notifications/", None),
        ("POST", "/communities/", {
            "title": f"Diag Community {suffix}",
            "description": "A community for diagnostics",
            "category": "Technology"
        })
    ]

    for method, path, payload in endpoints:
        print(f"\n=== TRIGGERING {method} {path} ===")
        url = f"{BASE_URL}{path}"
        t0 = time.time()
        try:
            if method == "GET":
                res = requests.get(url, headers=headers)
            else:
                res = requests.post(url, headers=headers, json=payload)
            print(f"Status: {res.status_code} (took {time.time()-t0:.2f}s)")
            try:
                data = res.json()
                if "traceback" in data:
                    print("TRACEROUTE DETECTED:")
                    print(data["traceback"])
                else:
                    print(f"Response: {json.dumps(data, indent=2)[:500]}")
            except Exception:
                print(f"Response Text (non-JSON): {res.text[:1000]}")
        except Exception as e:
            print(f"Request failed: {e}")

if __name__ == "__main__":
    run_diagnose()
