import requests
import json
import socket

print("Starting Launch Verification Suite (Pre-Flight Checks)...")

def check_service(name, host, port):
    print(f"Checking {name} at {host}:{port}...")
    try:
        with socket.create_connection((host, port), timeout=3):
            print(f"  [PASS] {name} is reachable.")
    except Exception as e:
        print(f"  [WARN] {name} unreachable: {e}")

def check_http_endpoint(name, url, expected_status=200):
    print(f"Checking {name} at {url}...")
    try:
        res = requests.get(url, timeout=3)
        if res.status_code == expected_status:
            print(f"  [PASS] {name} returned expected status {expected_status}.")
        else:
            print(f"  [FAIL] {name} returned {res.status_code}.")
    except Exception as e:
        print(f"  [FAIL] {name} failed: {e}")

if __name__ == "__main__":
    print("-" * 50)
    check_service("PostgreSQL DB", "localhost", 5432)
    check_service("Redis Cache", "localhost", 6379)
    check_service("FastAPI Backend", "localhost", 8000)
    check_service("Next.js Frontend", "localhost", 3000)
    
    print("-" * 50)
    check_http_endpoint("Backend Health", "http://localhost:8000/api/v1/health")
    check_http_endpoint("Frontend Home", "http://localhost:3000/")
    # PWA Manifest usually at /manifest.json
    check_http_endpoint("PWA Manifest", "http://localhost:3000/manifest.json")
    
    print("-" * 50)
    print("Launch Verification Suite Complete.")
