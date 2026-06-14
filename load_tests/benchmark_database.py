import asyncio
import time
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.database import AsyncSessionLocal
from sqlalchemy import text

async def benchmark_db():
    print("📊 Starting Database Benchmark...")
    iterations = 1000
    start_time = time.time()
    
    async with AsyncSessionLocal() as db:
        for _ in range(iterations):
            await db.execute(text("SELECT 1"))
            
    end_time = time.time()
    total_time = end_time - start_time
    queries_per_sec = iterations / total_time
    
    print(f"Completed {iterations} queries in {total_time:.2f} seconds.")
    print(f"Database QPS: {queries_per_sec:.2f}")

if __name__ == "__main__":
    asyncio.run(benchmark_db())
