"""Debug: direct login test bypassing URL handler"""
import sys
import asyncio
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from app.database import AsyncSessionLocal
from app.models import User, UserSession, AuditLog, LoginEvent, Notification, SecurityIncident
from app.routes.auth import verify_password, create_access_token
from sqlalchemy.future import select
import uuid
import datetime
from app.config import settings

async def main():
    email = "nobody@x.com"
    password = "bad"
    ip = "127.0.0.1"
    ua_string = "TestAgent"
    browser = "Unknown"
    os_name = "Unknown"
    now = datetime.datetime.utcnow()

    async with AsyncSessionLocal() as db:
        try:
            # Test 1: non-existent user login
            print(f"Test 1: Login with non-existent email {email!r}")
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            print(f"  User found: {user}")
            
            if not user:
                print("  Trying to create AuditLog with user_id=None...")
                from app.models import AuditLog
                audit = AuditLog(
                    user_id=None,
                    action="login_failed",
                    target="user",
                    ip_address=ip,
                    user_agent=ua_string,
                    meta={"email": email, "reason": "Non-existent user email"}
                )
                db.add(audit)
                print("  AuditLog added OK, committing...")
                await db.commit()
                print("  Commit OK!")
            
        except Exception as e:
            import traceback
            print(f"  ERROR: {e}")
            traceback.print_exc()
    
    # Test 2: existing user + wrong password
    email2 = "rec99@facesnap.dev"
    password2 = "wrongpassword"
    
    async with AsyncSessionLocal() as db:
        try:
            print(f"\nTest 2: Login with existing email {email2!r} + wrong password")
            result = await db.execute(select(User).where(User.email == email2))
            user = result.scalar_one_or_none()
            print(f"  User found: {user is not None}")
            
            if user:
                print(f"  Verifying password...")
                is_valid = verify_password(password2, user.password_hash)
                print(f"  Password valid: {is_valid}")
                
                if not is_valid:
                    print("  Creating LoginEvent with user_id...")
                    failed_event = LoginEvent(
                        user_id=user.id,
                        ip_address=ip,
                        device=f"{browser} on {os_name}",
                        browser=browser,
                        os=os_name,
                        country="Unknown",
                        city="Unknown",
                        success=False
                    )
                    db.add(failed_event)
                    print("  LoginEvent added, committing...")
                    await db.commit()
                    print("  Commit OK!")
                    print("  Login would correctly raise 401 here")
                    
        except Exception as e:
            import traceback
            print(f"  ERROR: {e}")
            traceback.print_exc()

asyncio.run(main())
