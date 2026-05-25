import requests
import json
import base64
import time
import sys
from uuid import uuid4

# Avoid UnicodeEncodeError on Windows terminals
sys.stdout.reconfigure(encoding='utf-8')

BASE_URL = "http://localhost:8000/api/v1"

# Generate unique credentials for this e2e run
unique_suffix = str(uuid4())[:8]
username = f"tester_{unique_suffix}"
email = f"tester_{unique_suffix}@example.com"
password = "securePassword123"
full_name = "E2E Integration Auditor"

print(f"Starting E2E Integration Audit for FaceSnap Core APIs...")
print(f"Generated Audit User: @{username} | {email}")

session = requests.Session()
token = None
community_id = None
event_id = None

def run_test():
    global token, community_id, event_id
    
    # ──────────────────────────────────────────────────────────
    # 1. User Sign Up
    # ──────────────────────────────────────────────────────────
    print("\n[TEST 1] Creating new user account...")
    signup_payload = {
        "username": username,
        "email": email,
        "password": password,
        "full_name": full_name
    }
    res = session.post(f"{BASE_URL}/auth/signup", json=signup_payload)
    if res.status_code not in (200, 201):

        print(f"❌ SIGNUP FAILED: {res.status_code} | {res.text}")
        return False
    print("✅ SIGNUP SUCCESSFUL!")
    
    # ──────────────────────────────────────────────────────────
    # 2. User Sign In / Token Generation
    # ──────────────────────────────────────────────────────────
    print("\n[TEST 2] Authenticating user and generating JWT token...")
    login_payload = {
        "email": email,
        "password": password
    }
    res = session.post(f"{BASE_URL}/auth/login", json=login_payload)
    if res.status_code != 200:
        print(f"❌ LOGIN FAILED: {res.status_code} | {res.text}")
        return False
    
    auth_data = res.json()
    token = auth_data["access_token"]
    session.headers.update({"Authorization": f"Bearer {token}"})
    print("✅ AUTHENTICATION SUCCESSFUL! JWT Token acquired.")

    # ──────────────────────────────────────────────────────────
    # 3. Create Community Workspace
    # ──────────────────────────────────────────────────────────
    print("\n[TEST 3] Deploying new Community Workspace...")
    community_payload = {
        "title": f"Audit Community {unique_suffix}",
        "description": "A high-fidelity group workspace to perform e2e integrations.",
        "category": "Technology"
    }
    res = session.post(f"{BASE_URL}/communities/", json=community_payload)
    if res.status_code not in (200, 201):
        print(f"❌ COMMUNITY CREATION FAILED: {res.status_code} | {res.text}")
        return False

    
    comm_data = res.json()
    community_id = comm_data["id"]
    print(f"✅ COMMUNITY DEPLOYED! ID: {community_id}")

    # ──────────────────────────────────────────────────────────
    # 4. Toggle Community Star
    # ──────────────────────────────────────────────────────────
    print("\n[TEST 4] Toggling Community Star persistence...")
    res = session.post(f"{BASE_URL}/communities/{community_id}/star")
    if res.status_code != 200:
        print(f"❌ COMMUNITY STAR TOGGLE FAILED: {res.status_code} | {res.text}")
        return False
    
    star_data = res.json()
    print(f"✅ STAR TOGGLED SUCCESSFUL! Status: {star_data}")

    # ──────────────────────────────────────────────────────────
    # 5. Fetch Starred Communities
    # ──────────────────────────────────────────────────────────
    print("\n[TEST 5] Querying user's starred list...")
    res = session.get(f"{BASE_URL}/communities/my-stars")
    if res.status_code != 200:
        print(f"❌ MY STARS FETCH FAILED: {res.status_code} | {res.text}")
        return False
    
    stars = res.json()
    print(f"✅ MY STARS RECEIVED: {stars}")
    assert community_id in stars, "Community ID not present in starred list!"

    # ──────────────────────────────────────────────────────────
    # 6. Deploy Event scoped under Workspace
    # ──────────────────────────────────────────────────────────
    print("\n[TEST 6] Scoping and deploying an Event...")
    event_payload = {
        "title": f"Cinematic Hackathon {unique_suffix}",
        "description": "E2E Neural Search testing event.",
        "location": "Auditorium Room A",
        "date": "2026-05-30"
    }
    res = session.post(f"{BASE_URL}/events/{community_id}", json=event_payload)
    if res.status_code not in (200, 201):
        print(f"❌ EVENT CREATION FAILED: {res.status_code} | {res.text}")
        return False

    
    event_data = res.json()
    event_id = event_data["id"]
    print(f"✅ EVENT DEPLOYED! ID: {event_id}")

    # ──────────────────────────────────────────────────────────
    # 7. Biometric Scanner Endpoint Check
    # ──────────────────────────────────────────────────────────
    print("\n[TEST 7] Testing Biometric verification & anti-spoofing pipeline...")
    # Send a dummy 1x1 black pixel base64 image
    dummy_image = base64.b64encode(b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\rIDATx\x9cc`\x00\x00\x00\x02\x00\x01H\xaf\xa4q\x00\x00\x00\x00IEND\xaeB`\x82").decode("utf-8")
    
    verify_payload = {
        "image_base64": f"data:image/png;base64,{dummy_image}",
        "liveness_score": 0.94,
        "eye_blinked": True
    }
    
    res = session.post(f"{BASE_URL}/verification/{event_id}", json=verify_payload)
    # We expect a 400 Bad Request because the dummy image contains no face!
    if res.status_code == 400:
        print("✅ BIOMETRIC PIPELINE PASSED! Server successfully detected liveness/face constraints and rejected dummy image correctly.")
    else:
        print(f"❌ BIOMETRIC PIPELINE UNEXPECTED RESPONSE: {res.status_code} | {res.text}")
        return False

    # ──────────────────────────────────────────────────────────
    # 8. Querying Persistent Database Verification Results
    # ──────────────────────────────────────────────────────────
    print("\n[TEST 8] Querying persistent verification results API fallback...")
    res = session.get(f"{BASE_URL}/verification/results/{event_id}")
    # Since we have not had a successful session yet, we expect a 404
    if res.status_code == 404:
        print("✅ PERSISTENT RESULTS FALLBACK PASSED! Returned 404 as expected (no verified session logged yet for this tester).")
    else:
        print(f"❌ RESULTS FALLBACK UNEXPECTED: {res.status_code} | {res.text}")
        return False

    # ──────────────────────────────────────────────────────────
    # 9. Aggregating Recognition Analytics
    # ──────────────────────────────────────────────────────────
    print("\n[TEST 9] Fetching Workspace Recognition Stats...")
    res = session.get(f"{BASE_URL}/verification/stats/{community_id}")
    if res.status_code != 200:
        print(f"❌ STATS FETCH FAILED: {res.status_code} | {res.text}")
        return False
    
    stats = res.json()
    print(f"✅ STATS ACCUMULATED: {stats}")
    
    print("\n⭐️ ALL 9 E2E CORE INTEGRATION TESTS PASSED SUCCESSFULLY! ⭐️")
    return True

if __name__ == "__main__":
    success = run_test()
    if not success:
        sys.exit(1)
