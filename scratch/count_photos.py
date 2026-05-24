import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect('postgresql://postgres:Mediaclubfacesnap@[2406:da18:e5c:b700:2027:c108:315d:ae41]:5432/postgres')
    
    count = await conn.fetchval('''
        SELECT COUNT(p.id) 
        FROM photos p 
        JOIN events e ON p.event_id = e.id 
        WHERE e.community_id = $1
    ''', '136d6d79-1e57-4ab6-97c3-7735eac6211a')
    
    print('Photo count in this community:', count)
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
