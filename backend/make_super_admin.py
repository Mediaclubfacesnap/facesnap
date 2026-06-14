import asyncio
import argparse
from sqlalchemy.future import select
from app.database import async_session
from app.models import User

async def main():
    parser = argparse.ArgumentParser(description="Promote a user to Super Admin.")
    parser.add_argument("email", type=str, help="The email of the user to promote.")
    args = parser.parse_args()

    async with async_session() as session:
        stmt = select(User).where(User.email == args.email)
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            print(f"User with email {args.email} not found.")
            return

        user.platform_role = "super_admin"
        user.can_create_communities = True
        await session.commit()
        print(f"Success: User {args.email} is now a Super Admin!")

if __name__ == "__main__":
    asyncio.run(main())
