import requests
import time
import sys
import os
import random
import uuid
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

def verify_user_face_in_db(email, embedding, event_id):
    from app.database import AsyncSessionLocal
    from app.models import User, VerificationSession
    from sqlalchemy import select

    async def _run():
        async with AsyncSessionLocal() as session:
            stmt = select(User).where(User.email == email)
            result = await session.execute(stmt)
            user = result.scalar_one_or_none()
            if user:
                user.face_matching_enabled = True
                # Create a verified session
                v_session = VerificationSession(
                    user_id=user.id,
                    event_id=event_id,
                    status="verified",
                    face_embedding=embedding
                )
                session.add(v_session)
                await session.commit()
                print(f"[DB] Inserted verified face embedding for {email}.")
            else:
                print(f"[DB] User {email} not found to verify face.")

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    loop.run_until_complete(_run())

def add_dummy_photo_with_face_to_db(event_id, embedding):
    from app.database import AsyncSessionLocal
    from app.models import Photo, PhotoFace
    from sqlalchemy import select

    async def _run():
        async with AsyncSessionLocal() as session:
            # Create Photo
            photo = Photo(
                event_id=event_id,
                storage_path="http://localhost:8000/static/dummy.jpg",
                filename="dummy.jpg",
                status="indexed"
            )
            session.add(photo)
            await session.flush() # get photo ID
            
            # Create PhotoFace
            pf = PhotoFace(
                photo_id=photo.id,
                bbox=[10, 10, 100, 100],
                embedding=embedding
            )
            session.add(pf)
            await session.commit()
            print(f"[DB] Inserted dummy photo and matching face for event {event_id}.")
            return photo.id

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(_run())

def check_photo_face_matches_count_in_db(user_id):
    from app.database import AsyncSessionLocal
    from app.models import PhotoFaceMatch
    from sqlalchemy import select, func

    async def _run():
        async with AsyncSessionLocal() as session:
            stmt = select(func.count(PhotoFaceMatch.id)).where(PhotoFaceMatch.user_id == user_id)
            result = await session.execute(stmt)
            return result.scalar()

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    return loop.run_until_complete(_run())

def test_participant_access():
    print("==================================================")
    print("Starting Participant Access and Face Isolation Verification...")
    print("==================================================")

    suffix = random.randint(10000, 99999)
    email_a = f"host_{suffix}@gmail.com"
    email_b = f"visitor_{suffix}@gmail.com"

    # 1. Sign up User A (Host)
    res = requests.post(f"{BASE_URL}/auth/signup", json={
        "username": f"host_{suffix}",
        "email": email_a,
        "password": "password123",
        "full_name": "Host User A"
    })
    assert res.status_code == 201, f"Host signup failed: {res.text}"
    token_a = res.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}
    promote_user_in_db(email_a)

    # 2. Sign up User B (Visitor / Non-member)
    res = requests.post(f"{BASE_URL}/auth/signup", json={
        "username": f"visitor_{suffix}",
        "email": email_b,
        "password": "password123",
        "full_name": "Visitor User B"
    })
    assert res.status_code == 201, f"Visitor signup failed: {res.text}"
    token_b = res.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}
    user_b_id = res.json()["user"]["id"]

    # 3. Create Community X as User A
    res = requests.post(f"{BASE_URL}/communities/", json={
        "title": f"Community X_{suffix}",
        "description": "Private test community",
        "category": "Technology",
        "visibility": "PRIVATE"
    }, headers=headers_a)
    assert res.status_code == 201, f"Community creation failed: {res.text}"
    comm_id = res.json()["id"]
    print(f"[OK] Community X created: {comm_id}")

    # 4. Create Event E in Community X as User A
    res = requests.post(f"{BASE_URL}/events/{comm_id}", json={
        "title": "Private Event E",
        "description": "Testing private access control",
        "location": "Virtual Room",
        "date": "2027-06-15"
    }, headers=headers_a)
    assert res.status_code in (200, 201), f"Event creation failed: {res.text}"
    event_id = res.json()["id"]
    print(f"[OK] Event E created: {event_id}")

    # Publish Event E as User A
    res = requests.patch(f"{BASE_URL}/events/{event_id}/publish", headers=headers_a)
    assert res.status_code == 200, f"Event publication failed: {res.text}"
    print(f"[OK] Event E published.")

    # 5. Assert User B (Non-member) gets 403 when requesting events of Community X directly
    res = requests.get(f"{BASE_URL}/events/{event_id}", headers=headers_b)
    assert res.status_code == 403, f"Expected 403 for non-member accessing event details, got {res.status_code}"
    print("[OK] Verified: User B receives 403 on direct event access.")

    res = requests.get(f"{BASE_URL}/events/community/{comm_id}", headers=headers_b)
    assert res.status_code == 403, f"Expected 403 for non-member listing community events, got {res.status_code}"
    print("[OK] Verified: User B receives 403 on listing community events.")

    # 6. Assert User B does NOT see Event E's ID in general lists
    for endpoint in ["upcoming", "recommendations", "calendar"]:
        res = requests.get(f"{BASE_URL}/events/{endpoint}", headers=headers_b)
        assert res.status_code == 200, f"Failed to call {endpoint}: {res.text}"
        events_list = res.json()
        event_ids = [evt["id"] for evt in events_list]
        assert event_id not in event_ids, f"Expected event_id {event_id} to be hidden from user B's {endpoint} list"
        print(f"[OK] Verified: Event E is hidden from User B's {endpoint} list.")

    # 7. Test Face Recognition Isolation:
    # 7.1 Verify User B's face and create photo with same embedding
    dummy_emb = [0.0] * 512
    dummy_emb[0] = 1.0 # simple unit vector
    verify_user_face_in_db(email_b, dummy_emb, event_id)
    photo_id = add_dummy_photo_with_face_to_db(event_id, dummy_emb)

    # 7.2 Trigger analysis as User A
    res = requests.post(f"{BASE_URL}/events/{event_id}/analyze", headers=headers_a)
    assert res.status_code == 200, f"Trigger analysis failed: {res.text}"
    print("[OK] Triggered face recognition analysis for Event E.")

    # Wait for the async task to execute (it is fast since it is sqlite/postgres in-memory or fast local query)
    print("Waiting for face matching analysis background task to complete...")
    time.sleep(2)

    # 7.3 Assert no match is created for User B (since B is not a community member)
    matches_cnt = check_photo_face_matches_count_in_db(user_b_id)
    assert matches_cnt == 0, f"Expected 0 face matches for non-member User B, found {matches_cnt}"
    print("[OK] Verified: Face Match Isolation works. Non-member B was NOT matched.")

    # 8. Let User B join Community X
    # B requests to join
    res = requests.post(f"{BASE_URL}/communities/{comm_id}/join-request", json={"message": "Join"}, headers=headers_b)
    assert res.status_code in (200, 201), f"Join request failed: {res.text}"
    
    # Get request ID
    res = requests.get(f"{BASE_URL}/communities/{comm_id}/join-requests", headers=headers_a)
    assert res.status_code == 200
    req_id = next(r["id"] for r in res.json() if r["user_id"] == user_b_id)

    # Approve request
    res = requests.post(f"{BASE_URL}/communities/join-requests/{req_id}/review", json={"decision": "approved"}, headers=headers_a)
    assert res.status_code == 200
    print("[OK] User B successfully joined Community X.")

    # 9. Trigger analysis again as User A
    res = requests.post(f"{BASE_URL}/events/{event_id}/analyze", headers=headers_a)
    assert res.status_code == 200
    
    print("Waiting for face matching analysis background task to complete...")
    matches_cnt = 0
    for attempt in range(12):
        matches_cnt = check_photo_face_matches_count_in_db(user_b_id)
        if matches_cnt > 0:
            break
        time.sleep(1)

    # 10. Assert that face match IS now created for User B
    assert matches_cnt > 0, f"Expected face matches for member User B, found {matches_cnt}"
    print(f"[OK] Verified: Member User B was matched successfully ({matches_cnt} matches).")

    print("\n[SUCCESS] Participant Access & Face Isolation Verification Passed!")

if __name__ == "__main__":
    try:
        test_participant_access()
    except Exception as e:
        print(f"[FAIL] test_participant_access failed: {e}")
        sys.exit(1)
