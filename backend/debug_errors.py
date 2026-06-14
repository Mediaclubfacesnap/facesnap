"""Debug: get stored error logs from the server"""
import urllib.request
import urllib.error
import json
import sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE = "http://127.0.0.1:8001/api/v1"

def test(method, path, token=None, body=None):
    url = BASE + path
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = "Bearer " + token
    data = json.dumps(body).encode() if body else None
    try:
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            bd = json.loads(e.read())
        except Exception:
            bd = {}
        return e.code, bd
    except Exception as e:
        return "ERR", str(e)

# Get debug logs
s, r = test("GET", "/communities/debug-logs")
print(f"Status: {s}")
if isinstance(r, list):
    for log in r:
        print(f"--- Error Log ---")
        print(f"Endpoint: {log.get('endpoint')}")
        print(f"Message: {log.get('message')}")
        tb = log.get('traceback', '')
        if tb:
            # Show last 20 lines
            lines = tb.strip().split('\n')
            print("Traceback (last 20 lines):")
            for line in lines[-20:]:
                print("  " + line)
        print()
else:
    print(json.dumps(r, indent=2))
