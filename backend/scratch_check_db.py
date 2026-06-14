import asyncio
from app.database import AsyncSessionLocal
from app.models import User, VerificationSession, CommunityRole, PhotoFaceMatch
from sqlalchemy import text

async def main():
    async with AsyncSessionLocal() as db:
        print("--- USERS ---")
        u_res = await db.execute(text("SELECT id, email, platform_role, face_matching_enabled FROM users"))
        for row in u_res.all():
            print(row)
            
        print("\n--- VERIFICATION SESSIONS ---")
        v_res = await db.execute(text("SELECT id, user_id, status, event_id, face_embedding IS NOT NULL FROM verification_sessions"))
        for row in v_res.all():
            print(row)
            
        print("\n--- COMMUNITY ROLES ---")
        c_res = await db.execute(text("SELECT id, community_id, user_id, role FROM community_roles"))
        for row in c_res.all():
            print(row)
            
        print("\n--- PHOTO FACE MATCHES ---")
        m_res = await db.execute(text("SELECT id, photo_id, user_id, confidence_score, status FROM photo_face_matches"))
        for row in m_res.all():
            print(row)

if __name__ == "__main__":
    asyncio.run(main())
