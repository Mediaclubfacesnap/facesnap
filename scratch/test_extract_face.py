import torch
from facenet_pytorch import MTCNN, InceptionResnetV1, extract_face
from PIL import Image
import numpy as np

print("Imports successful!")
device = torch.device("cpu")
mtcnn = MTCNN(device=device)
print("MTCNN instantiated!")
img = Image.fromarray(np.uint8(np.random.rand(200, 200, 3) * 255))
boxes, probs = mtcnn.detect(img)
print("Detect called. Boxes:", boxes)
