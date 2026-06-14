"""Test OAuth User creation and update flows"""
import asyncio
import sys
import uuid
import urllib.request
import urllib.error
import json

sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from app.database import engine
from sqlalchemy import text

async def test_endpoint(payload):
    url = "http://localhost:8000/api/v1/auth/sync-oauth"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode())

async def verify_db(user_id):
    async with engine.begin() as conn:
        res_user = await conn.execute(text("SELECT id, username, email, full_name, avatar_url FROM users WHERE id = :uid"), {"uid": user_id})
        user = res_user.fetchone()
        
        res_sessions = await conn.execute(text("SELECT id, user_id, jti, browser, expires_at FROM user_sessions WHERE user_id = :uid ORDER BY created_at DESC"), {"uid": user_id})
        sessions = res_sessions.fetchall()
        
        return user, sessions

async def main():
    new_id = str(uuid.uuid4())
    email = f"oauth_test_{uuid.uuid4().hex[:8]}@example.com"
    full_name = "Original OAuth Name"
    
    print("=== TEST CASE 1: NEW OAUTH USER ===")
    payload = {
        "id": new_id,
        "email": email,
        "full_name": full_name,
        "avatar_url": "http://example.com/avatar.jpg"
    }
    
    status, response = await test_endpoint(payload)
    print(f"Endpoint Status: {status}")
    if status == 200:
        print("Success! Access token acquired.")
        user_db, sessions_db = await verify_db(new_id)
        print("Database Verification:")
        print(f"  User Exists: {user_db is not None}")
        if user_db:
            print(f"  User Fields: email={user_db[2]}, full_name={user_db[3]}, avatar_url={user_db[4]}")
        print(f"  Sessions Count: {len(sessions_db)}")
        if sessions_db:
            print(f"  Latest Session JTI: {sessions_db[0][2]}")
    else:
        print("Failed:", response)
        return

    print("\n=== TEST CASE 2: EXISTING OAUTH USER (UPDATE) ===")
    updated_name = "Updated OAuth Name"
    payload_update = {
        "id": new_id,
        "email": email,
        "full_name": updated_name,
        "avatar_url": "http://example.com/avatar_new.jpg"
    }
    
    status2, response2 = await test_endpoint(payload_update)
    print(f"Endpoint Status: {status2}")
    if status2 == 200:
        print("Success! Access token acquired.")
        user_db, sessions_db = await verify_db(new_id)
        print("Database Verification:")
        print(f"  User Exists: {user_db is not None}")
        if user_db:
            print(f"  User Fields: email={user_db[2]}, full_name={user_db[3]} (expected: {updated_name}), avatar_url={user_db[4]}")
        print(f"  Sessions Count: {len(sessions_db)} (expected: 2)")
    else:
        print("Failed:", response2)

if __name__ == '__main__':
    asyncio.run(main())
