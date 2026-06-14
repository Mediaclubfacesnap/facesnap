import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

print("Starting Database Benchmark Suite...")

def benchmark_query(name, query_func, iterations=100):
    start_time = time.time()
    for _ in range(iterations):
        query_func()
    end_time = time.time()
    
    total_time = end_time - start_time
    avg_time = (total_time / iterations) * 1000  # in ms
    print(f"[{name}] {iterations} iterations: Total {total_time:.4f}s | Avg {avg_time:.4f}ms per query")

def dummy_query():
    # Simulate DB latency
    time.sleep(0.005)

if __name__ == "__main__":
    print("Connecting to DB...")
    # engine = create_engine("postgresql://user:pass@localhost:5432/facesnap")
    # Session = sessionmaker(bind=engine)
    
    benchmark_query("Fetch Communities", dummy_query, 500)
    benchmark_query("Fetch Events", dummy_query, 500)
    benchmark_query("pgvector Similarity Search", dummy_query, 100)
    
    print("Database Benchmark Complete.")
