import asyncio
import os
import sys
from sqlalchemy import text
import traceback

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

# Reload database settings if needed
from app.config import settings
if os.getenv("DATABASE_URL"):
    settings.DATABASE_URL = os.getenv("DATABASE_URL")

from app.database import engine

async def main():
    try:
        async with engine.begin() as conn:
            print("Applying migration v7: Adding production indexes...")
            
            # 1. CommunityRole index: (user_id, community_id)
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_community_roles_user_community 
                ON community_roles (user_id, community_id);
            """))
            print("- Created index idx_community_roles_user_community on community_roles(user_id, community_id)")
            
            # 2. Join requests index: (community_id, status)
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_community_join_requests_comm_status 
                ON community_join_requests (community_id, status);
            """))
            print("- Created index idx_community_join_requests_comm_status on community_join_requests(community_id, status)")
            
            # 3. Events index: (community_id, status)
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_events_comm_status 
                ON events (community_id, status);
            """))
            print("- Created index idx_events_comm_status on events(community_id, status)")
            
            # 4. Notifications index: (user_id, created_at)
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
                ON notifications (user_id, created_at DESC);
            """))
            print("- Created index idx_notifications_user_created on notifications(user_id, created_at DESC)")
            
            # 5. Face matches index (VerificationSession): (user_id, event_id)
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_verification_sessions_user_event 
                ON verification_sessions (user_id, event_id);
            """))
            print("- Created index idx_verification_sessions_user_event on verification_sessions(user_id, event_id)")
            
        print("Migration v7 applied successfully.")
    except Exception as e:
        print("Error applying migration v7:", e)
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
