import httpx
import asyncio
import os

async def main():
    # 1. Login as admin
    print("Logging in...")
    async with httpx.AsyncClient() as client:
        # Assuming there is a super admin account
        res = await client.post("http://localhost:8000/api/v1/auth/login", data={
            "username": "admin@example.com", # If it exists, otherwise we just test the endpoint directly via internal DB
            "password": "password" # Just a guess
        })
        if res.status_code == 200:
            token = res.json()["access_token"]
            print("Login successful.")
            
            res2 = await client.get("http://localhost:8000/api/v1/notifications/admin/analytics", headers={"Authorization": f"Bearer {token}"})
            print("Status:", res2.status_code)
            print("Payload:", res2.json())
        else:
            print("Could not login. Status:", res.status_code)

asyncio.run(main())
