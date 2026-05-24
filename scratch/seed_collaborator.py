import asyncio
import asyncpg
import datetime

async def main():
    print("Connecting to database...")
    conn = await asyncpg.connect('postgresql://postgres:Mediaclubfacesnap@[2406:da18:e5c:b700:2027:c108:315d:ae41]:5432/postgres')
    
    # Check if @sai is already a member
    existing = await conn.fetchrow('''
        SELECT id FROM community_roles 
        WHERE community_id = $1 AND user_id = $2
    ''', '136d6d79-1e57-4ab6-97c3-7735eac6211a', 'f3d9f131-fbf3-456f-a4f1-78aa6725c785')
    
    if not existing:
        await conn.execute('''
            INSERT INTO community_roles (community_id, user_id, role, created_at)
            VALUES ($1, $2, $3, $4)
        ''', '136d6d79-1e57-4ab6-97c3-7735eac6211a', 'f3d9f131-fbf3-456f-a4f1-78aa6725c785', 'contributor', datetime.datetime.now(datetime.timezone.utc))
        print("Successfully added @sai as a contributor in the community!")
    else:
        print("@sai is already a member in this community.")
        
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
