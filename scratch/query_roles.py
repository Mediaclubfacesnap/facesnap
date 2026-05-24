import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres:Mediaclubfacesnap@[2406:da18:e5c:b700:2027:c108:315d:ae41]:5432/postgres')
    
    rows = await conn.fetch('''
        SELECT cr.id, u.username, cr.role, cr.created_at 
        FROM community_roles cr 
        JOIN users u ON cr.user_id = u.id 
        WHERE cr.community_id = $1
    ''', '136d6d79-1e57-4ab6-97c3-7735eac6211a')
    
    print('Community Roles:')
    for r in rows:
        print(dict(r))
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
