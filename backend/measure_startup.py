import time
t0 = time.time()
print("Starting import...")
from app.main import app
print(f"Startup time: {time.time() - t0:.2f} seconds")
