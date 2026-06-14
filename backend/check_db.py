import asyncio
from app.database import async_session
from app.models import Event
from sqlalchemy.future import select

async def main():
    async with async_session() as session:
        stmt = select(Event).where(Event.id == "208ee9a4-3648-42c8-a9bd-0c173c4286ec")
        res = await session.execute(stmt)
        event = res.scalar_one_or_none()
        if event:
            print("Event found:", event.title, event.id)
        else:
            print("Event NOT found in database")

asyncio.run(main())
