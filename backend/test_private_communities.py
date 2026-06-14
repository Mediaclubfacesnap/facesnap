import requests
import time
import sys
import os
import random
import datetime

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

def make_super_admin_in_db(email):
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
                user.platform_role = "super_admin"
                await session.commit()
                print(f"[DB] Promoted {email} to super_admin.")
            else:
                print(f"[DB] User {email} not found for super_admin promotion.")

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    loop.run_until_complete(_run())

def expire_invite_code_in_db(code_str):
    import asyncio
    from app.database import AsyncSessionLocal
    from app.models import CommunityInviteCode
    from sqlalchemy import select

    async def _run():
        async with AsyncSessionLocal() as session:
            stmt = select(CommunityInviteCode).where(CommunityInviteCode.code == code_str)
            result = await session.execute(stmt)
            invite_code = result.scalar_one_or_none()
            if invite_code:
                invite_code.expires_at = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=1)
                await session.commit()
                print(f"[DB] Expired invite code {code_str} manually.")
            else:
                print(f"[DB] Invite code {code_str} not found to expire.")

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    loop.run_until_complete(_run())


def test_private_communities():
    print("==================================================")
    print("Starting Private Communities Privacy Verification...")
    print("==================================================")

    suffix = random.randint(10000, 99999)
    email_host = f"host_{suffix}@gmail.com"
    email_visitor = f"visitor_{suffix}@gmail.com"
    email_visitor2 = f"visitor2_{suffix}@gmail.com"
    email_admin = f"sadmin_{suffix}@gmail.com"

    # 1. Sign up Users
    # 1.1 Host (User A)
    res = requests.post(f"{BASE_URL}/auth/signup", json={
        "username": f"host_{suffix}",
        "email": email_host,
        "password": "password123",
        "full_name": "Host User A"
    })
    assert res.status_code == 201, f"Host signup failed: {res.text}"
    token_host = res.json()["access_token"]
    headers_host = {"Authorization": f"Bearer {token_host}"}
    promote_user_in_db(email_host)
    print("[OK] Host User A registered and promoted.")

    # 1.2 Visitor (User B)
    res = requests.post(f"{BASE_URL}/auth/signup", json={
        "username": f"visitor_{suffix}",
        "email": email_visitor,
        "password": "password123",
        "full_name": "Visitor User B"
    })
    assert res.status_code == 201, f"Visitor signup failed: {res.text}"
    token_visitor = res.json()["access_token"]
    headers_visitor = {"Authorization": f"Bearer {token_visitor}"}
    user_b_id = res.json()["user"]["id"]
    print("[OK] Visitor User B registered.")

    # 1.3 Visitor 2 (User C)
    res = requests.post(f"{BASE_URL}/auth/signup", json={
        "username": f"visitor2_{suffix}",
        "email": email_visitor2,
        "password": "password123",
        "full_name": "Visitor User C"
    })
    assert res.status_code == 201, f"Visitor 2 signup failed: {res.text}"
    token_visitor2 = res.json()["access_token"]
    headers_visitor2 = {"Authorization": f"Bearer {token_visitor2}"}
    print("[OK] Visitor User C registered.")

    # 1.4 Super Admin (User D)
    res = requests.post(f"{BASE_URL}/auth/signup", json={
        "username": f"sadmin_{suffix}",
        "email": email_admin,
        "password": "password123",
        "full_name": "Super Admin User D"
    })
    assert res.status_code == 201, f"Super admin signup failed: {res.text}"
    token_sadmin = res.json()["access_token"]
    headers_sadmin = {"Authorization": f"Bearer {token_sadmin}"}
    make_super_admin_in_db(email_admin)
    print("[OK] Super Admin User D registered and promoted.")


    # 2. Host creates a private community
    comm_title = f"Private Tech Community {suffix}"
    res = requests.post(f"{BASE_URL}/communities/", json={
        "title": comm_title,
        "description": "Exclusively private community for code reviews",
        "category": "Technology"
    }, headers=headers_host)
    assert res.status_code == 201, f"Community creation failed: {res.text}"
    community_id = res.json()["id"]
    print(f"[OK] Private Community created with ID {community_id}")


    # 3. Verify Privacy Gates for User B (Non-Participant)
    # 3.1 Community List (should not contain Community X)
    res = requests.get(f"{BASE_URL}/communities/", headers=headers_visitor)
    assert res.status_code == 200
    communities_list = [c["id"] for c in res.json()]
    assert community_id not in communities_list, "Error: Private community is visible to non-members in listing"
    print("[OK] Privacy Gate: Community hidden from non-member list.")

    # 3.2 Community Details (should return 403)
    res = requests.get(f"{BASE_URL}/communities/{community_id}", headers=headers_visitor)
    assert res.status_code == 403, f"Expected 403 for details, got {res.status_code}"
    print("[OK] Privacy Gate: Community details block unauthorized access (403).")

    # 3.3 Community Events (should return 403)
    res = requests.get(f"{BASE_URL}/events/community/{community_id}", headers=headers_visitor)
    assert res.status_code == 403, f"Expected 403 for events list, got {res.status_code}"
    print("[OK] Privacy Gate: Community events block unauthorized access (403).")

    # 3.4 Community Search (should not return the community in search)
    res = requests.get(f"{BASE_URL}/search", params={"q": comm_title}, headers=headers_visitor)
    assert res.status_code == 200
    search_comms = [c["id"] for c in res.json().get("communities", [])]
    assert community_id not in search_comms, "Error: Private community matches in search for non-member"
    print("[OK] Privacy Gate: Community hidden from non-member search.")


    # 4. Verify Super Admin Bypass
    # 4.1 Super Admin accesses details
    res = requests.get(f"{BASE_URL}/communities/{community_id}", headers=headers_sadmin)
    assert res.status_code == 200, f"Expected 200 for Super Admin details, got {res.status_code}"
    # 4.2 Super Admin searches community
    res = requests.get(f"{BASE_URL}/search", params={"q": comm_title}, headers=headers_sadmin)
    assert res.status_code == 200
    search_comms_admin = [c["id"] for c in res.json().get("communities", [])]
    assert community_id in search_comms_admin, "Error: Private community hidden from Super Admin search"
    print("[OK] Privacy Gate Bypass: Super Admin can view details and search the private community.")


    # 5. Invite Code: Auto Join Flow
    # 5.1 Host creates auto join code
    res = requests.post(f"{BASE_URL}/communities/{community_id}/invite-codes", json={
        "join_mode": "auto",
        "expires_in_days": None,
        "max_uses": None
    }, headers=headers_host)
    assert res.status_code == 200, f"Failed to generate auto invite code: {res.text}"
    code_auto = res.json()["code"]
    code_auto_id = res.json()["id"]
    print(f"[OK] Auto-join invite code generated: {code_auto}")

    # 5.2 User B joins via auto join code
    res = requests.post(f"{BASE_URL}/communities/join-by-code/{code_auto}", headers=headers_visitor)
    assert res.status_code == 200
    assert res.json()["joined"] is True
    print("[OK] User B joined via auto-join code.")

    # 5.3 Verify User B has participant access (role is None)
    res = requests.get(f"{BASE_URL}/communities/{community_id}/members", headers=headers_host)
    print(f"[DEBUG] GET /members status: {res.status_code}, response: {res.text}")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"
    members = res.json()
    user_b_role = next((m for m in members if m["user_id"] == user_b_id), None)
    assert user_b_role is not None, "User B not found in members list"
    assert user_b_role["role"] is None, f"Expected role to be None, got {user_b_role['role']}"
    print("[OK] Verified User B joined as a Participant (role=NULL).")

    # 5.4 Verify User B can view details and see community in list
    res = requests.get(f"{BASE_URL}/communities/{community_id}", headers=headers_visitor)
    assert res.status_code == 200, "User B is member but detail access blocked"
    res = requests.get(f"{BASE_URL}/communities/", headers=headers_visitor)
    assert community_id in [c["id"] for c in res.json()], "User B is member but community missing from list"
    print("[OK] Verified User B can now access details and list the community.")

    # 5.5 User B leaves the community
    res = requests.post(f"{BASE_URL}/communities/{community_id}/leave", headers=headers_visitor)
    assert res.status_code == 200
    print("[OK] User B left the community.")

    # 5.6 Verify User B is blocked again
    res = requests.get(f"{BASE_URL}/communities/{community_id}", headers=headers_visitor)
    assert res.status_code == 403
    print("[OK] Verified User B is blocked from community detail after leaving.")


    # 6. Invite Code: Approval Required Flow
    # 6.1 Host creates approval join code
    res = requests.post(f"{BASE_URL}/communities/{community_id}/invite-codes", json={
        "join_mode": "approval",
        "expires_in_days": None,
        "max_uses": None
    }, headers=headers_host)
    assert res.status_code == 200, f"Failed to generate approval invite code: {res.text}"
    code_approval = res.json()["code"]
    print(f"[OK] Approval-required invite code generated: {code_approval}")

    # 6.2 User B joins via approval code (should submit request)
    res = requests.post(f"{BASE_URL}/communities/join-by-code/{code_approval}", headers=headers_visitor)
    assert res.status_code == 200
    assert res.json()["joined"] is False
    assert res.json()["status"] == "pending"
    print("[OK] User B requested to join via approval code.")

    # 6.3 Verify User B is still blocked from community details
    res = requests.get(f"{BASE_URL}/communities/{community_id}", headers=headers_visitor)
    assert res.status_code == 403
    print("[OK] Verified User B is blocked while request is pending.")

    # 6.4 Host retrieves join requests and approves User B
    res = requests.get(f"{BASE_URL}/communities/{community_id}/join-requests", headers=headers_host)
    assert res.status_code == 200
    requests_list = res.json()
    user_b_req = next((r for r in requests_list if r["user_id"] == user_b_id), None)
    assert user_b_req is not None, "Join request from User B not found"
    request_id = user_b_req["id"]

    res = requests.post(f"{BASE_URL}/communities/join-requests/{request_id}/review", json={
        "decision": "approved"
    }, headers=headers_host)
    assert res.status_code == 200, f"Failed to approve join request: {res.text}"
    print("[OK] Host approved User B's request.")

    # 6.5 Verify User B can now access details
    res = requests.get(f"{BASE_URL}/communities/{community_id}", headers=headers_visitor)
    assert res.status_code == 200
    print("[OK] Verified User B can now access community details after approval.")

    # 6.6 User B leaves community
    res = requests.post(f"{BASE_URL}/communities/{community_id}/leave", headers=headers_visitor)
    assert res.status_code == 200
    print("[OK] User B left the community again.")


    # 7. Invite Code: Expiration Gating
    # 7.1 Host creates auto-join code
    res = requests.post(f"{BASE_URL}/communities/{community_id}/invite-codes", json={
        "join_mode": "auto",
        "expires_in_days": 1,
        "max_uses": None
    }, headers=headers_host)
    assert res.status_code == 200
    code_expired = res.json()["code"]
    print(f"[OK] Expiration invite code generated: {code_expired}")

    # 7.2 Expire code in database
    expire_invite_code_in_db(code_expired)

    # 7.3 User B attempts to join via expired code
    res = requests.post(f"{BASE_URL}/communities/join-by-code/{code_expired}", headers=headers_visitor)
    assert res.status_code == 400, f"Expected 400 Bad Request, got {res.status_code}: {res.text}"
    assert "expired" in res.json()["detail"].lower()
    print("[OK] Expiration Gate: Joining via expired code is rejected.")


    # 8. Invite Code: Max Uses limit
    # 8.1 Host creates auto-join code with max_uses = 1
    res = requests.post(f"{BASE_URL}/communities/{community_id}/invite-codes", json={
        "join_mode": "auto",
        "expires_in_days": None,
        "max_uses": 1
    }, headers=headers_host)
    assert res.status_code == 200
    code_limited = res.json()["code"]
    print(f"[OK] Usage-limited invite code generated: {code_limited}")

    # 8.2 User B joins via limited code
    res = requests.post(f"{BASE_URL}/communities/join-by-code/{code_limited}", headers=headers_visitor)
    assert res.status_code == 200
    assert res.json()["joined"] is True
    print("[OK] User B joined successfully using limited code (first use).")

    # 8.3 User B leaves
    res = requests.post(f"{BASE_URL}/communities/{community_id}/leave", headers=headers_visitor)
    assert res.status_code == 200
    print("[OK] User B left community.")

    # 8.4 User C attempts to join via limited code (second use - should fail)
    res = requests.post(f"{BASE_URL}/communities/join-by-code/{code_limited}", headers=headers_visitor2)
    assert res.status_code == 400, f"Expected 400 Bad Request for second use, got {res.status_code}: {res.text}"
    assert "limit" in res.json()["detail"].lower() or "uses" in res.json()["detail"].lower()
    print("[OK] Usage Limit Gate: Joining via code that hit max uses is rejected.")


    # 9. Clean up invite code deletion
    res = requests.delete(f"{BASE_URL}/communities/invite-codes/{code_auto_id}", headers=headers_host)
    assert res.status_code == 200
    print("[OK] Host deleted invite code successfully.")

    print("\n==================================================")
    print("[SUCCESS] All Private Communities Gates and Invite Code flows verified successfully!")
    print("==================================================")

if __name__ == "__main__":
    test_private_communities()
