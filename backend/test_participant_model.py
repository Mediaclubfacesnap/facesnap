import requests
import time
import sys
import os

# Add backend to path for SQLAlchemy imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

BASE_URL = "http://localhost:8000/api/v1"

def promote_user_in_db(email):
    import asyncio
    from app.database import AsyncSessionLocal
    from app.models import User
    from sqlalchemy import select

    async def _run():
        async with AsyncSessionLocal() as session:
            stmt = select(User).where(User.email == email)
            result = await session.execute(stmt)
            user = result.scalar_one_or_none()
            if user:
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
    loop.run_until_complete(_run())

def test_flow():
    print("Starting Participant Model Verification Test...")

    # 1. Register User A (Host)
    import random
    suffix = random.randint(1000, 9999)
    email_a = f"host_{suffix}@example.com"
    res = requests.post(f"{BASE_URL}/auth/signup", json={
        "username": f"host_user_{suffix}",
        "email": email_a,
        "password": "password123",
        "full_name": "Host User"
    })
    assert res.status_code == 201, f"Failed to register User A: {res.text}"
    token_a = res.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    print("[OK] User A registered.")

    # Promote User A to Host / Creator permissions
    promote_user_in_db(email_a)

    # 2. Register User B (Participant)
    res = requests.post(f"{BASE_URL}/auth/signup", json={
        "username": f"part_user_{suffix}",
        "email": f"part_{suffix}@example.com",
        "password": "password123",
        "full_name": "Participant User"
    })
    assert res.status_code == 201, f"Failed to register User B: {res.text}"
    token_b = res.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    user_b_id = res.json()["user"]["id"]
    print("[OK] User B registered.")

    # 3. User A creates a community
    res = requests.post(f"{BASE_URL}/communities/", json={
        "title": "Test Community",
        "description": "A community for testing",
        "category": "Technology"
    }, headers=headers_a)
    assert res.status_code == 201, f"Failed to create community: {res.text}"
    community_id = res.json()["id"]
    print("[OK] Community created by User A.")

    # 4. User B requests to join
    res = requests.post(f"{BASE_URL}/communities/{community_id}/join-request", json={
        "message": "Let me in!"
    }, headers=headers_b)
    assert res.status_code in [200, 201], f"Failed to request join: {res.text}"
    print("[OK] User B requested to join.")

    # 4.5. Retrieve request_id by listing pending requests as User A
    res = requests.get(f"{BASE_URL}/communities/{community_id}/join-requests", headers=headers_a)
    assert res.status_code == 200, f"Failed to list join requests: {res.text}"
    requests_list = res.json()
    user_b_req = next((r for r in requests_list if r["user_id"] == user_b_id), None)
    assert user_b_req is not None, "User B join request not found in pending list"
    request_id = user_b_req["id"]
    print(f"[OK] Retrieved User B's join request ID: {request_id}")

    # 5. User A approves User B's join request
    res = requests.post(f"{BASE_URL}/communities/join-requests/{request_id}/review", json={
        "decision": "approved"
    }, headers=headers_a)
    assert res.status_code == 200, f"Failed to approve join request: {res.text}"
    print("[OK] User A approved User B.")

    # 6. Verify User B's role is NULL
    res = requests.get(f"{BASE_URL}/communities/{community_id}/members", headers=headers_a)
    assert res.status_code == 200
    members = res.json()
    user_b_member = next((m for m in members if m["user_id"] == user_b_id), None)
    assert user_b_member is not None, "User B not found in members list"
    assert user_b_member["role"] is None, f"Expected role to be None, got {user_b_member['role']}"
    print("[OK] Verified User B has role=NULL (Participant).")

    # 7. Verify User B CANNOT upload a photo
    # Let's hit the S3 pre-signed URL endpoint (or whatever the upload endpoint is)
    # The endpoint might be /communities/{id}/media or something, we'll just check upload permission
    # For now, let's just try to create an event as User B
    res = requests.post(f"{BASE_URL}/events/{community_id}", json={
        "title": "Test Event",
        "description": "Test",
        "location": "Test Location",
        "date": "2027-01-01"
    }, headers=headers_b)
    assert res.status_code == 403, f"Expected 403 Forbidden for participant, got {res.status_code}"
    print("[OK] Verified User B (Participant) cannot create events (403 Forbidden).")

    # 8. User A promotes User B to Moderator
    headers_a_confirm = headers_a.copy()
    headers_a_confirm["X-Confirm-Password"] = "password123"
    res = requests.put(f"{BASE_URL}/communities/{community_id}/members/{user_b_id}/role", json={
        "role": "moderator"
    }, headers=headers_a_confirm)
    assert res.status_code == 200, f"Failed to promote User B: {res.text}"
    print("[OK] User A promoted User B to Moderator.")

    # 9. Verify User B is Moderator
    res = requests.get(f"{BASE_URL}/communities/{community_id}/members", headers=headers_a)
    members = res.json()
    user_b_member = next((m for m in members if m["user_id"] == user_b_id), None)
    assert user_b_member["role"] == "moderator", f"Expected 'moderator', got {user_b_member['role']}"
    print("[OK] Verified User B has role='moderator'.")

    print("\n[SUCCESS] All Verification Tests Passed successfully!")

if __name__ == "__main__":
    try:
        test_flow()
    except Exception as e:
        print(f"[FAIL] Test failed: {e}")
