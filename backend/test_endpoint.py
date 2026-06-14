import urllib.request
import json

url = "http://localhost:8000/api/v1/events/208ee9a4-3648-42c8-a9bd-0c173c4286ec"

try:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
        print("Response:", json.dumps(json.loads(response.read()), indent=2))
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code)
    print("Response:", e.read().decode())
except Exception as e:
    print("Error:", str(e))
