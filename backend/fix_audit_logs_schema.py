"""Fix the audit_logs.ip_address column type from inet to varchar"""
import asyncio, sys
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from app.database import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        print("Altering audit_logs.ip_address from inet to varchar...")
        await conn.execute(text(
            "ALTER TABLE audit_logs ALTER COLUMN ip_address TYPE character varying USING ip_address::text"
        ))
        print("Done! Verifying...")
        
        result = await conn.execute(text(
            "SELECT column_name, data_type, udt_name "
            "FROM information_schema.columns "
            "WHERE table_name = 'audit_logs' AND column_name = 'ip_address'"
        ))
        for row in result:
            print(f"  ip_address: {row[1]} ({row[2]})")
        
        print("Migration complete!")

asyncio.run(main())
