import asyncio
import os
import sys

# Add parent directory to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine
from sqlalchemy import text

async def migrate_roles():
    async with engine.begin() as conn:
        print("Migrating Community Roles...")

        # 0. Alter table to allow NULL in role column
        await conn.execute(text("ALTER TABLE community_roles ALTER COLUMN role DROP NOT NULL;"))
        print("Dropped NOT NULL constraint on community_roles.role.")
        
        # 1. Update legacy roles to NULL (participants)
        await conn.execute(text("""
            UPDATE community_roles 
            SET role = NULL 
            WHERE role IN ('member', 'gallery_access', 'member_access')
        """))
        print("Updated legacy member roles to NULL.")

        # 2. Rename contributor to moderator
        await conn.execute(text("""
            UPDATE community_roles 
            SET role = 'moderator' 
            WHERE role = 'contributor'
        """))
        print("Renamed contributor roles to moderator.")

        # 3. Rename table contributor_requests to role_requests
        # We also need to check if the table exists first.
        result = await conn.execute(text("SELECT to_regclass('public.contributor_requests');"))
        table_exists = result.scalar() is not None
        if table_exists:
            await conn.execute(text("ALTER TABLE contributor_requests RENAME TO role_requests;"))
            print("Renamed table contributor_requests to role_requests.")
        else:
            print("Table contributor_requests not found (might be already renamed).")
            
        # 4. In role_requests, delete legacy request types and rename 'contributor' to 'moderator'
        # Wait, the user said "Delete: member, gallery, upload. Remaining: moderator, admin, host."
        result = await conn.execute(text("SELECT to_regclass('public.role_requests');"))
        if result.scalar() is not None:
            await conn.execute(text("""
                DELETE FROM role_requests WHERE request_type IN ('member', 'gallery', 'upload')
            """))
            await conn.execute(text("""
                UPDATE role_requests SET request_type = 'moderator' WHERE request_type = 'contributor'
            """))
            print("Updated role_requests data.")

        print("Role migration complete!")

if __name__ == "__main__":
    asyncio.run(migrate_roles())
