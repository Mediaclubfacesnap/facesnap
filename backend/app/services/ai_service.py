import io
import cv2
import numpy as np
import torch
from PIL import Image
from facenet_pytorch import MTCNN, InceptionResnetV1, extract_face
import logging
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

# Determine dynamic hardware device with GPU fallback acceleration
if torch.cuda.is_available():
    device = torch.device("cuda")
    logger.info("Initializing Face Detection and Feature Extraction Models in CUDA GPU Mode!")
elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
    device = torch.device("mps")
    logger.info("Initializing Face Detection and Feature Extraction Models in Apple Silicon MPS GPU Mode!")
else:
    device = torch.device("cpu")
    logger.info("Initializing Face Detection and Feature Extraction Models in CPU Mode (No GPU detected).")

# MTCNN for face localization and keypoint extraction
mtcnn = MTCNN(
    image_size=160,
    margin=0, # Tight facial crop (0 margin) to isolate face and exclude hair, caps, and clothing/dresses
    keep_all=True,
    post_process=True,
    device=device
)

# ResNet model pretrained on VGGFace2 to extract 512-D face embedding vectors
resnet = InceptionResnetV1(
    pretrained="vggface2",
    device=device
).eval()

class AIService:
    @staticmethod
    def bytes_to_pil(image_bytes: bytes) -> Image.Image:
        """Converts raw image bytes to a PIL Image."""
        return Image.open(io.BytesIO(image_bytes)).convert("RGB")

    @staticmethod
    def extract_faces(image_bytes: bytes) -> List[Dict[str, Any]]:
        """
        Loads an image, detects all faces using MTCNN, aligns them,
        generates a 512-D embedding vector for each, and returns their locations.
        Optimized to use extract_face for non-redundant crop alignment.
        """
        try:
            img = AIService.bytes_to_pil(image_bytes)
            orig_width, orig_height = img.size
            
            # 1. Downscale high-resolution images to 1600px to maintain high resolution for background/side faces
            max_size = 1600
            img_resized = img
            scale_x = 1.0
            scale_y = 1.0
            
            if orig_width > max_size or orig_height > max_size:
                if orig_width > orig_height:
                    new_width = max_size
                    new_height = int(orig_height * (max_size / orig_width))
                else:
                    new_height = max_size
                    new_width = int(orig_width * (max_size / orig_height))
                
                # Resampling with high speed bilinear filter
                img_resized = img.resize((new_width, new_height), Image.Resampling.BILINEAR)
                scale_x = orig_width / new_width
                scale_y = orig_height / new_height
                logger.info(f"Speed Optimization: Downscaled image from {orig_width}x{orig_height} to {new_width}x{new_height} for high-resolution MTCNN face detection.")

            # Detect boxes, confidence probabilities, and 5 keypoints on the resized image
            boxes, probs, landmarks = mtcnn.detect(img_resized, landmarks=True)
            
            if boxes is None or len(boxes) == 0:
                logger.info("No faces detected in image.")
                return []

            results = []
            face_list = []
            valid_indices = []

            # Perform single fast-pass crop using pre-detected coordinates
            for i in range(len(boxes)):
                prob = probs[i]
                if prob < 0.70: # Bounding box confidence filter - relaxed to 0.70 to carefully capture side profiles
                    continue
                
                # Extract the individual face tensor using the pre-detected box
                face_tensor = extract_face(img_resized, boxes[i], image_size=160, margin=0)
                face_tensor = (face_tensor - 127.5) / 128.0 # Normalize to [-1, 1] range
                
                face_list.append(face_tensor)
                valid_indices.append(i)

            if face_list:
                # Stack all face tensors into a single batch [N, 3, 160, 160] for lightning fast inference
                faces_batch = torch.stack(face_list).to(device)
                with torch.no_grad():
                    embeddings = resnet(faces_batch).cpu().numpy()

                for idx, i in enumerate(valid_indices):
                    prob = probs[i]
                    xmin, ymin, xmax, ymax = boxes[i]
                    bbox = [
                        int(ymin * scale_y),
                        int(xmin * scale_x),
                        int(ymax * scale_y),
                        int(xmax * scale_x)
                    ]
                    
                    embedding_vector = embeddings[idx]
                    norm = np.linalg.norm(embedding_vector)
                    if norm > 0:
                        embedding_vector = embedding_vector / norm
                    
                    results.append({
                        "bbox": bbox,
                        "embedding": embedding_vector.tolist(),
                        "confidence": float(prob)
                    })

            logger.info(f"Successfully indexed {len(results)} faces in image.")
            return results
        except Exception as e:
            logger.error(f"Error in face extraction pipeline: {e}")
            raise

    @staticmethod
    def verify_liveness(image_bytes: bytes) -> Tuple[bool, float, List[float]]:
        """
        Performs dual-threshold anti-spoofing and liveness checks on a selfie frame:
        1. Texture/Color channel standard deviation: Screens & printouts have low contrast.
        2. Geometric face symmetry check: Left/Right eye-to-nose distances.
        Optimized with zero-redundancy facial embedding extraction using pre-detected boxes.
        """
        try:
            img_pil = AIService.bytes_to_pil(image_bytes)
            orig_width, orig_height = img_pil.size
            
            # Downscale selfie to match webcam native size (480px) and avoid resizing overhead
            max_size = 480
            img_resized = img_pil
            if orig_width > max_size or orig_height > max_size:
                if orig_width > orig_height:
                    new_width = max_size
                    new_height = int(orig_height * (max_size / orig_width))
                else:
                    new_height = max_size
                    new_width = int(orig_width * (max_size / orig_height))
                img_resized = img_pil.resize((new_width, new_height), Image.Resampling.BILINEAR)

            img_np = np.array(img_resized)
            
            # 1. Texture/Color Liveness Check
            ycrcb = cv2.cvtColor(img_np, cv2.COLOR_RGB2YCrCb)
            std_dev = np.std(ycrcb[:, :, 1]) + np.std(ycrcb[:, :, 2]) # StdDev of Cr + Cb
            texture_score = min(1.0, std_dev / 18.0)
            
            # 2. Geometric Face Symmetry Check
            boxes, probs, landmarks = mtcnn.detect(img_resized, landmarks=True)
            if boxes is None or len(boxes) == 0:
                return False, 0.0, [0.0]
 
            # Focus on the most confident face
            primary_idx = np.argmax(probs)
            prob = probs[primary_idx]
            
            if prob < 0.80:
                return False, 0.0, [0.0]
 
            pts = landmarks[primary_idx]
            left_eye = pts[0]
            right_eye = pts[1]
            nose = pts[2]
 
            dist_left = np.linalg.norm(left_eye - nose)
            dist_right = np.linalg.norm(right_eye - nose)
            
            symmetry_ratio = min(dist_left, dist_right) / max(1e-5, max(dist_left, dist_right))
            
            liveness_score = 0.4 * texture_score + 0.6 * symmetry_ratio
            is_live = liveness_score > 0.58
            
            # Generate the embedding of this selfie using optimized non-redundant crop
            face_tensor = extract_face(img_resized, boxes[primary_idx], image_size=160, margin=0)
            face_tensor = (face_tensor - 127.5) / 128.0 # Normalize to [-1, 1] range
            
            # Add batch dimension and move to device
            single_face = face_tensor.unsqueeze(0).to(device)
            with torch.no_grad():
                selfie_emb = resnet(single_face).cpu().numpy()[0]
                
            norm = np.linalg.norm(selfie_emb)
            if norm > 0:
                selfie_emb = selfie_emb / norm
                
            return is_live, liveness_score, selfie_emb.tolist()

        except Exception as e:
            logger.error(f"Error in liveness verification: {e}")
            return False, 0.0, []
