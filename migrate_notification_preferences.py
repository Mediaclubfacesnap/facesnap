import sys
import os
import asyncio
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add backend dir to sys.path so we can import app modules
sys.path.append(os.path.join(os.path.dirname(__file__), "backend"))

from app.database import Base, DATABASE_URL
from app.models import User, NotificationPreference

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

async def run_migration():
    async with AsyncSessionLocal() as session:
        # 1. Ensure table exists
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        print("Fetching users...")
        result = await session.execute(select(User))
        users = result.scalars().all()
        print(f"Found {len(users)} users.")

        migrated_count = 0
        skipped_count = 0

        for user in users:
            # Check if pref already exists
            pref_result = await session.execute(select(NotificationPreference).where(NotificationPreference.user_id == user.id))
            existing_pref = pref_result.scalar_one_or_none()

            if existing_pref:
                skipped_count += 1
                continue

            new_pref = NotificationPreference(
                user_id=user.id,
                face_matches_enabled=user.face_matching_enabled and user.match_notifications_enabled,
                community_enabled=user.community_match_notifications_enabled,
                social_enabled=True,  # New category, default true
                achievement_enabled=True, # New category, default true
                system_enabled=True, # New category, default true
                security_enabled=True, # New category, always true logically, but user can't turn off critical
                event_enabled=user.event_match_notifications_enabled,
                message_enabled=True,
                push_enabled=user.push_notifications_enabled,
                email_enabled=user.email_notifications_enabled,
                digest_enabled=user.weekly_digest_enabled,
                digest_frequency="weekly",
                quiet_hours_enabled=False
            )
            session.add(new_pref)
            migrated_count += 1
            
        await session.commit()
        print(f"Migration Complete: Migrated {migrated_count} users. Skipped {skipped_count} users.")

if __name__ == "__main__":
    asyncio.run(run_migration())
