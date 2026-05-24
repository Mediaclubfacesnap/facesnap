import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))

import asyncio
import numpy as np
import torch
from facenet_pytorch import MTCNN, InceptionResnetV1
from PIL import Image
import requests
from io import BytesIO

# Load two different face images from the web (or just simple random/different images if offline, but let's see)
# We can load two different photos from the database instead!
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text
from app.config import settings

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)
    
    async with AsyncSessionLocal() as session:
        # Fetch two photos from the event
        res = await session.execute(text("SELECT storage_path FROM photos LIMIT 2"))
        urls = [r[0] for r in res.all()]
        
    if len(urls) < 2:
        print("Not enough photos in DB to test.")
        return
        
    print(f"Downloading test photos:\n 1. {urls[0]}\n 2. {urls[1]}")
    try:
        r1 = requests.get(urls[0])
        r2 = requests.get(urls[1])
        img1 = Image.open(BytesIO(r1.content)).convert("RGB")
        img2 = Image.open(BytesIO(r2.content)).convert("RGB")
    except Exception as e:
        print(f"Failed to download photos: {e}")
        return

    # Check with post_process=False
    mtcnn_false = MTCNN(image_size=160, keep_all=True, post_process=False)
    resnet = InceptionResnetV1(pretrained="vggface2").eval()
    
    tensors1_false = mtcnn_false(img1)
    tensors2_false = mtcnn_false(img2)
    
    if tensors1_false is not None and tensors2_false is not None:
        with torch.no_grad():
            emb1_false = resnet(tensors1_false[0:1]).numpy()[0]
            emb2_false = resnet(tensors2_false[0:1]).numpy()[0]
        
        emb1_false = emb1_false / np.linalg.norm(emb1_false)
        emb2_false = emb2_false / np.linalg.norm(emb2_false)
        dist_false = np.linalg.norm(emb1_false - emb2_false)
        cosine_dist_false = 1.0 - np.dot(emb1_false, emb2_false)
        print("\nWith post_process=False:")
        print(f" - L2 distance: {dist_false:.4f}")
        print(f" - Cosine distance: {cosine_dist_false:.4f}")
        
    # Check with post_process=True
    mtcnn_true = MTCNN(image_size=160, keep_all=True, post_process=True)
    tensors1_true = mtcnn_true(img1)
    tensors2_true = mtcnn_true(img2)
    
    if tensors1_true is not None and tensors2_true is not None:
        with torch.no_grad():
            emb1_true = resnet(tensors1_true[0:1]).numpy()[0]
            emb2_true = resnet(tensors2_true[0:1]).numpy()[0]
        
        emb1_true = emb1_true / np.linalg.norm(emb1_true)
        emb2_true = emb2_true / np.linalg.norm(emb2_true)
        dist_true = np.linalg.norm(emb1_true - emb2_true)
        cosine_dist_true = 1.0 - np.dot(emb1_true, emb2_true)
        print("\nWith post_process=True:")
        print(f" - L2 distance: {dist_true:.4f}")
        print(f" - Cosine distance: {cosine_dist_true:.4f}")

if __name__ == "__main__":
    asyncio.run(main())
