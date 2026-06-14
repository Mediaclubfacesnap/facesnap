import requests
r = requests.options('http://localhost:8000/api/v1/auth/me', headers={'Origin':'http://localhost:3000','Access-Control-Request-Method':'GET'})
print(f"OPTIONS Status: {r.status_code}")
print(f"OPTIONS Headers: {r.headers}")

r2 = requests.get('http://localhost:8000/api/v1/auth/me', headers={'Origin':'http://localhost:3000', 'Authorization':'Bearer invalid_token_123'})
print(f"GET Status: {r2.status_code}")
print(f"GET Headers: {r2.headers}")
print(f"GET Content: {r2.text}")
