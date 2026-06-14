"""
FaceSnap Phase 6E – Participant Model Migration Script
======================================================

Executes the full database migration to eliminate legacy role values:
  - platform_role = 'member'  →  platform_role = 'user'
  - community role = 'member' | 'member_access' | 'gallery_access'  →  role = NULL
  - community role = 'contributor'  →  role = 'moderator'

Safe to run multiple times (idempotent).

Usage:
    cd backend
    python scripts/migrate_to_participant_model.py
"""

import asyncio
import sys
import os

# Ensure app is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import AsyncSessionLocal

MIGRATION_STEPS = [
    # Step 1: Platform role migration
    {
        "name": "Step 1 – Platform role 'member' → 'user'",
        "count_sql": "SELECT COUNT(*) FROM users WHERE platform_role = 'member'",
        "migrate_sql": "UPDATE users SET platform_role = 'user' WHERE platform_role = 'member'",
    },
    # Step 2: Community roles – participant conversion
    {
        "name": "Step 2 – Community roles 'member'/'member_access'/'gallery_access' → NULL",
        "count_sql": "SELECT COUNT(*) FROM community_roles WHERE role IN ('member', 'member_access', 'gallery_access')",
        "migrate_sql": "UPDATE community_roles SET role = NULL WHERE role IN ('member', 'member_access', 'gallery_access')",
    },
    # Step 3: Contributor → Moderator rename
    {
        "name": "Step 3 – Community roles 'contributor' → 'moderator'",
        "count_sql": "SELECT COUNT(*) FROM community_roles WHERE role = 'contributor'",
        "migrate_sql": "UPDATE community_roles SET role = 'moderator' WHERE role = 'contributor'",
    },
]

VERIFY_STEPS = [
    {
        "name": "Verify: No 'member' platform roles remain",
        "sql": "SELECT COUNT(*) FROM users WHERE platform_role = 'member'",
        "expected": 0,
    },
    {
        "name": "Verify: No 'member' community roles remain",
        "sql": "SELECT COUNT(*) FROM community_roles WHERE role = 'member'",
        "expected": 0,
    },
    {
        "name": "Verify: No 'member_access' community roles remain",
        "sql": "SELECT COUNT(*) FROM community_roles WHERE role = 'member_access'",
        "expected": 0,
    },
    {
        "name": "Verify: No 'gallery_access' community roles remain",
        "sql": "SELECT COUNT(*) FROM community_roles WHERE role = 'gallery_access'",
        "expected": 0,
    },
    {
        "name": "Verify: No 'contributor' community roles remain",
        "sql": "SELECT COUNT(*) FROM community_roles WHERE role = 'contributor'",
        "expected": 0,
    },
    {
        "name": "Verify: All platform roles are 'user' or 'super_admin'",
        "sql": "SELECT COUNT(*) FROM users WHERE platform_role NOT IN ('user', 'super_admin')",
        "expected": 0,
    },
    {
        "name": "Verify: All community roles are NULL, 'host', 'admin', or 'moderator'",
        "sql": "SELECT COUNT(*) FROM community_roles WHERE role IS NOT NULL AND role NOT IN ('host', 'admin', 'moderator')",
        "expected": 0,
    },
]

REPORT_QUERIES = [
    ("Total users", "SELECT COUNT(*) FROM users"),
    ("Users with platform_role='user'", "SELECT COUNT(*) FROM users WHERE platform_role = 'user'"),
    ("Users with platform_role='super_admin'", "SELECT COUNT(*) FROM users WHERE platform_role = 'super_admin'"),
    ("Total community roles", "SELECT COUNT(*) FROM community_roles"),
    ("Participants (role IS NULL)", "SELECT COUNT(*) FROM community_roles WHERE role IS NULL"),
    ("Hosts", "SELECT COUNT(*) FROM community_roles WHERE role = 'host'"),
    ("Admins", "SELECT COUNT(*) FROM community_roles WHERE role = 'admin'"),
    ("Moderators", "SELECT COUNT(*) FROM community_roles WHERE role = 'moderator'"),
]


async def run_migration():
    print("=" * 60)
    print("FaceSnap Phase 6E – Participant Model Migration")
    print("=" * 60)
    print()

    migration_counts = {}

    async with AsyncSessionLocal() as db:
        # Run migrations
        for step in MIGRATION_STEPS:
            print(f"⏳  {step['name']}")
            count_result = await db.execute(text(step["count_sql"]))
            count = count_result.scalar()
            print(f"    → Rows to migrate: {count}")
            if count > 0:
                await db.execute(text(step["migrate_sql"]))
                await db.commit()
                print(f"    ✅ Migrated {count} rows")
            else:
                print(f"    ✓  Nothing to migrate (already clean)")
            migration_counts[step["name"]] = count
            print()

        # Run verifications
        print("-" * 60)
        print("VERIFICATION")
        print("-" * 60)
        all_passed = True
        for verify in VERIFY_STEPS:
            result = await db.execute(text(verify["sql"]))
            actual = result.scalar()
            passed = actual == verify["expected"]
            if not passed:
                all_passed = False
            status = "✅" if passed else "❌"
            print(f"  {status}  {verify['name']}: {actual} (expected {verify['expected']})")
        print()

        # Final Report
        print("-" * 60)
        print("FINAL REPORT")
        print("-" * 60)
        for label, sql in REPORT_QUERIES:
            result = await db.execute(text(sql))
            value = result.scalar()
            print(f"  {label}: {value}")
        print()

        print("-" * 60)
        print("MIGRATION SUMMARY")
        print("-" * 60)
        for step_name, count in migration_counts.items():
            print(f"  {step_name}: {count} rows updated")
        print()

        if all_passed:
            print("✅  ALL VERIFICATIONS PASSED — Migration complete.")
        else:
            print("❌  SOME VERIFICATIONS FAILED — Review the output above.")

    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_migration())
