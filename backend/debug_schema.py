"""Check database schema for ip_address column types"""
import asyncio, sys
sys.path.insert(0, '.')
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

from app.database import engine
from sqlalchemy import text

async def main():
    async with engine.begin() as conn:
        # Check audit_logs
        result = await conn.execute(text(
            "SELECT column_name, data_type, udt_name "
            "FROM information_schema.columns "
            "WHERE table_name = 'audit_logs' "
            "ORDER BY ordinal_position"
        ))
        print('audit_logs columns:')
        for row in result:
            print(f'  {row[0]}: {row[1]} ({row[2]})')
        
        # Check security_incidents
        result2 = await conn.execute(text(
            "SELECT column_name, data_type, udt_name "
            "FROM information_schema.columns "
            "WHERE table_name = 'security_incidents' "
            "ORDER BY ordinal_position"
        ))
        print('security_incidents columns:')
        for row in result2:
            print(f'  {row[0]}: {row[1]} ({row[2]})')
        
        # Check login_events
        result3 = await conn.execute(text(
            "SELECT column_name, data_type, udt_name "
            "FROM information_schema.columns "
            "WHERE table_name = 'login_events' "
            "ORDER BY ordinal_position"
        ))
        print('login_events columns:')
        for row in result3:
            print(f'  {row[0]}: {row[1]} ({row[2]})')

asyncio.run(main())
