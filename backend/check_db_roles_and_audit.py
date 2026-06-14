"""Verify roles in community_roles and ip_address column type in audit_logs"""
import asyncio
import sys
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from app.database import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        print("--- Verifying audit_logs.ip_address column ---")
        result = await conn.execute(text(
            "SELECT column_name, data_type, udt_name "
            "FROM information_schema.columns "
            "WHERE table_name = 'audit_logs' AND column_name = 'ip_address'"
        ))
        rows = result.fetchall()
        for row in rows:
            print(f"Column: {row[0]}, Type: {row[1]} ({row[2]})")
        
        print("\n--- Checking distinct roles in community_roles ---")
        result = await conn.execute(text(
            "SELECT role, COUNT(*) FROM community_roles GROUP BY role;"
        ))
        rows = result.fetchall()
        for row in rows:
            print(f"Role: {row[0]}, Count: {row[1]}")

        # Let's also check if there are legacy roles that need to be migrated to NULL
        # Legacy roles: member, contributor, admin (admin is actually allowed now as moderator/admin/host/NULL)
        # Wait, the migration specifies roles: host, admin, moderator, NULL (participant)
        # Any other value should be updated to NULL.
        result = await conn.execute(text(
            "SELECT COUNT(*) FROM community_roles WHERE role NOT IN ('host', 'admin', 'moderator') AND role IS NOT NULL"
        ))
        invalid_count = result.scalar()
        print(f"\nLegacy/Invalid roles count: {invalid_count}")
        if invalid_count > 0:
            print("Repairing legacy roles to NULL...")
            await conn.execute(text(
                "UPDATE community_roles SET role = NULL WHERE role NOT IN ('host', 'admin', 'moderator') AND role IS NOT NULL"
            ))
            print("Repair complete!")
            
            # Recheck
            result = await conn.execute(text(
                "SELECT role, COUNT(*) FROM community_roles GROUP BY role;"
            ))
            rows = result.fetchall()
            print("\nAfter Repair - Roles in community_roles:")
            for row in rows:
                print(f"Role: {row[0]}, Count: {row[1]}")

if __name__ == '__main__':
    asyncio.run(main())
