"""Decode and validate a generated JWT token"""
import json
import base64
import datetime

token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDAiLCJqdGkiOiJhNDBmZDM0YS1jOThmLTQ0OGYtYmJjMS1hOGE1NGNhYTRiMDkiLCJleHAiOjE3ODA5OTg3NTEsImlhdCI6MTc4MDkxMjM1MX0.-9Aa8AuT3Zqo0Rd0XpC2J5AGpJFMZMHTgKPoKAE2Tv8"

def main():
    parts = token.split('.')
    payload_b64 = parts[1]
    # Add padding
    payload_b64 += '=' * (4 - len(payload_b64) % 4)
    payload_json = base64.b64decode(payload_b64).decode()
    payload = json.loads(payload_json)
    
    print("Decoded JWT Payload:")
    print(json.dumps(payload, indent=2))
    
    exp = payload.get("exp")
    iat = payload.get("iat")
    if exp and iat:
        duration_minutes = (exp - iat) / 60
        print(f"Duration: {duration_minutes} minutes")
        print(f"Issued At: {datetime.datetime.fromtimestamp(iat)}")
        print(f"Expires At: {datetime.datetime.fromtimestamp(exp)}")

if __name__ == '__main__':
    main()
