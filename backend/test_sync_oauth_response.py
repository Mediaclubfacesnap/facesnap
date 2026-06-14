import urllib.request
import urllib.error
import json

url = "http://localhost:8000/api/v1/auth/sync-oauth"
payload = {
    "id": "00000000-0000-0000-0000-000000000000",
    "email": "test@example.com",
    "full_name": "Test User"
}
data = json.dumps(payload).encode()
req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")

try:
    with urllib.request.urlopen(req) as response:
        print("Status Code:", response.status)
        print("Response Body:", response.read().decode())
except urllib.error.HTTPError as e:
    print("Status Code:", e.code)
    print("Response Body:", e.read().decode())
    print("Response Headers:", dict(e.headers))
except Exception as e:
    print("Error:", str(e))
