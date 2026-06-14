import time
import random

print("Starting Face Recognition Pipeline Benchmark Suite...")

def simulate_gpu_inference(name, batch_size, model_latency_ms):
    start = time.time()
    
    # Simulate loading batch to GPU and running inference (MTCNN/Facenet)
    time.sleep((model_latency_ms * batch_size) / 1000.0)
    
    end = time.time()
    total = end - start
    
    print(f"[{name}] Batch Size {batch_size} -> {total:.3f}s (Throughput: {batch_size/total:.1f} faces/sec)")

if __name__ == "__main__":
    print("Initializing Models (Simulated)...")
    time.sleep(2) # simulate model load
    print("Models Loaded.")
    print("-" * 50)
    
    simulate_gpu_inference("Face Detection (MTCNN)", batch_size=1, model_latency_ms=40)
    simulate_gpu_inference("Face Detection (MTCNN)", batch_size=16, model_latency_ms=15)
    simulate_gpu_inference("Face Detection (MTCNN)", batch_size=64, model_latency_ms=8)
    
    print("-" * 50)
    
    simulate_gpu_inference("Embedding Generation (Facenet)", batch_size=1, model_latency_ms=60)
    simulate_gpu_inference("Embedding Generation (Facenet)", batch_size=16, model_latency_ms=25)
    simulate_gpu_inference("Embedding Generation (Facenet)", batch_size=64, model_latency_ms=12)
    
    print("-" * 50)
    print("Face Recognition Benchmark Complete.")
