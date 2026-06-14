import requests
import time
import sys
import os
import random
import asyncio

# Add backend to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

BASE_URL = "http://localhost:8000/api/v1"

def promote_user_in_db(email):
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

def promote_member_role_in_db(community_id, user_id, role):
    from app.database import AsyncSessionLocal
    from app.models import CommunityRole
    from sqlalchemy import select

    async def _run():
        async with AsyncSessionLocal() as session:
            stmt = select(CommunityRole).where(
                CommunityRole.community_id == community_id,
                CommunityRole.user_id == user_id
            )
            result = await session.execute(stmt)
            role_rec = result.scalar_one_or_none()
            if role_rec:
                role_rec.role = role
                await session.commit()
                print(f"[DB] Promoted user {user_id} in community {community_id} to role: {role}.")
            else:
                print(f"[DB] Role record not found.")

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    loop.run_until_complete(_run())

def test_extra_endpoints():
    print("==================================================")
    print("Starting Security Hardening Extra Endpoints Verification...")
    print("==================================================")

    suffix = random.randint(10000, 99999)
    email_a = f"host_extra_{suffix}@gmail.com"
    email_b = f"member_extra_{suffix}@gmail.com"

    # ----------------------------------------------------
    # 1. Verification of Rate Limiting (Phase 34)
    # ----------------------------------------------------
    print("\nTesting login rate limits (20/hour/IP) via X-Test-IP...")
    test_ip = f"198.51.100.{random.randint(1, 254)}"
    rate_limit_hit = False

    for attempt in range(1, 25):
        # We try to login with a bad password, but we send from the test_ip
        res = requests.post(
            f"{BASE_URL}/auth/login",
            json={"email": email_a, "password": "wrongpassword"},
            headers={"X-Test-IP": test_ip}
        )
        if res.status_code == 429:
            print(f"[OK] Hit rate limit on attempt {attempt}: {res.json()}")
            rate_limit_hit = True
            break
    
    assert rate_limit_hit, "Rate limit of 20 attempts/hour was not triggered."

    # ----------------------------------------------------
    # 2. Set up Users and Community for Leave and Archive tests
    # ----------------------------------------------------
    # Signup Host User A
    res = requests.post(f"{BASE_URL}/auth/signup", json={
        "username": f"host_extra_{suffix}",
        "email": email_a,
        "password": "password123",
        "full_name": "Host User A"
    })
    assert res.status_code == 201, f"Host signup failed: {res.text}"
    token_a = res.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    promote_user_in_db(email_a)

    # Signup Member User B
    res = requests.post(f"{BASE_URL}/auth/signup", json={
        "username": f"member_extra_{suffix}",
        "email": email_b,
        "password": "password123",
        "full_name": "Member User B"
    })
    assert res.status_code == 201, f"Member signup failed: {res.text}"
    token_b = res.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    user_b_id = res.json()["user"]["id"]

    # Host User A creates community
    res = requests.post(f"{BASE_URL}/communities/", json={
        "title": f"Community Extra_{suffix}",
        "description": "Verification of extra rules",
        "category": "Technology"
    }, headers=headers_a)
    assert res.status_code == 201
    comm_id = res.json()["id"]
    print(f"[OK] Community created: {comm_id}")

    # Member User B joins community
    res = requests.post(f"{BASE_URL}/communities/{comm_id}/join-request", json={"message": "Join"}, headers=headers_b)
    assert res.status_code in (200, 201)

    res = requests.get(f"{BASE_URL}/communities/{comm_id}/join-requests", headers=headers_a)
    req_id = next(r["id"] for r in res.json() if r["user_id"] == user_b_id)

    res = requests.post(f"{BASE_URL}/communities/join-requests/{req_id}/review", json={"decision": "approved"}, headers=headers_a)
    assert res.status_code == 200

    # ----------------------------------------------------
    # 3. Leave Community Constraints (Phase 37)
    # ----------------------------------------------------
    print("\nTesting leaving restrictions...")

    # Case A: Sole host trying to leave
    res = requests.post(f"{BASE_URL}/communities/{comm_id}/leave", headers=headers_a)
    assert res.status_code == 400, f"Expected sole host leaving block, got {res.status_code}: {res.text}"
    assert "sole Host cannot leave" in res.json()["detail"]
    print("[OK] Sole Host cannot leave restriction verified.")

    # Promote Member B to Moderator
    promote_member_role_in_db(comm_id, user_b_id, "moderator")

    # Case B: Moderator trying to leave without downgrade
    res = requests.post(f"{BASE_URL}/communities/{comm_id}/leave", headers=headers_b)
    assert res.status_code == 400, f"Expected moderator leaving block, got {res.status_code}: {res.text}"
    assert "Moderators and Admins must be downgraded" in res.json()["detail"]
    print("[OK] Moderator leave without downgrade restriction verified.")

    # Downgrade B back to standard participant (role = None)
    promote_member_role_in_db(comm_id, user_b_id, None)

    # Case C: Downgraded participant leaving
    res = requests.post(f"{BASE_URL}/communities/{comm_id}/leave", headers=headers_b)
    assert res.status_code == 200, f"Expected participant to leave successfully, got {res.status_code}: {res.text}"
    print("[OK] Participant can leave successfully verified.")

    # ----------------------------------------------------
    # 4. Community Archive & Restoration Lifecycle (Phase 36)
    # ----------------------------------------------------
    print("\nTesting Community Archive/Restore lifecycle...")

    # First delete -> Archive
    res = requests.delete(f"{BASE_URL}/communities/{comm_id}", headers={
        "Authorization": f"Bearer {token_a}",
        "X-Confirm-Password": "password123"
    })
    assert res.status_code == 200
    assert "archived successfully" in res.json()["message"]
    print("[OK] First DELETE soft-deleted (archived) the community.")

    # Verify that requesting community details or event creation on it fails for host/member
    # Wait, can super_admin still bypass? Yes. But standard hosts/members get 403.
    res = requests.get(f"{BASE_URL}/communities/{comm_id}", headers=headers_a)
    assert res.status_code == 403, f"Expected 403 Forbidden for archived community, got {res.status_code}"
    print("[OK] Verified: community workspace is gated/invisible while archived.")

    # Restore the community
    res = requests.post(f"{BASE_URL}/communities/{comm_id}/restore", headers=headers_a)
    assert res.status_code == 200
    print("[OK] POST /restore restored the community.")

    # Verify community details are accessible again
    res = requests.get(f"{BASE_URL}/communities/{comm_id}", headers=headers_a)
    assert res.status_code == 200
    print("[OK] Verified: community workspace is accessible after restore.")

    # First delete again -> Archive
    res = requests.delete(f"{BASE_URL}/communities/{comm_id}", headers={
        "Authorization": f"Bearer {token_a}",
        "X-Confirm-Password": "password123"
    })
    assert res.status_code == 200

    # Second delete -> Permanent Delete
    res = requests.delete(f"{BASE_URL}/communities/{comm_id}", headers={
        "Authorization": f"Bearer {token_a}",
        "X-Confirm-Password": "password123"
    })
    assert res.status_code == 200
    assert "permanently deleted" in res.json()["message"]
    print("[OK] Second DELETE permanently deleted the community.")

    # Verify it is gone
    res = requests.get(f"{BASE_URL}/communities/{comm_id}", headers=headers_a)
    assert res.status_code == 404, f"Expected 404 Not Found for deleted community, got {res.status_code}"
    print("[OK] Verified: community is permanently deleted.")

    print("\n[SUCCESS] Extra Endpoints (Rate Limits, Leave restrictions, Archive/Restore) Verification Passed!")

if __name__ == "__main__":
    try:
        test_extra_endpoints()
    except Exception as e:
        import traceback
        print(f"[FAIL] test_extra_endpoints failed:")
        traceback.print_exc()
        sys.exit(1)
