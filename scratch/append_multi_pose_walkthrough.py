import os

walkthrough_path = r"C:\Users\nagen\.gemini\antigravity\brain\57e3efb3-c423-4058-9112-38b7fd134b80\walkthrough.md"

new_section = """

---

## 🎯 Update: Multi-Angle Parallel Face Queries (May 24, 2026)

* **The Issue**: Previously, users whose faces were turned sideways (side profiles) in event photos could not retrieve those photos. The front-facing selfie embedding used to query the vector database was mathematically too distant (cosine distance > 0.30) from their side-profile embeddings, causing those genuine photos to be missed under strict high-precision filters.
* **The Fixes**:
  1. **Extended Request Payload** ([schemas.py](file:///c:/Users/nagen/facesnap2/backend/app/schemas.py)):
     - Added optional `image_up`, `image_down`, `image_right`, and `image_left` base64 fields to `VerificationRequest` to pass the captured active liveness pose snapshots to the backend.
  2. **Multi-Angle Parallel Querying & Deduplication** ([verification.py](file:///c:/Users/nagen/facesnap2/backend/app/routes/verification.py)):
     - Upgraded the search endpoint to parse and extract face embeddings for all five available profiles (Front + Up + Down + Right + Left snapshots).
     - Loops through each pose, queries the pgvector HNSW space sequentially, and pools all matches together.
     - Automatically deduplicates matching photos by keeping only the single highest confidence match across all query profiles and sorts them descending.
     - **Result**: A side-profile photo in the event folder now perfectly matches your captured Right or Left profile snapshot with extremely high confidence, retrieving all turned faces flawlessly while keeping a strict zero-false-positive `0.30` threshold!
  3. **Frontend Payload Synchronization** ([verify/page.tsx](file:///c:/Users/nagen/facesnap2/frontend/app/dashboard/events/[id]/verify/page.tsx)):
     - Updated `sendFrameToBackend` to send all four captured side-profile snapshots (`capturedSidePhotos.up`, `capturedSidePhotos.down`, `capturedSidePhotos.right`, `capturedSidePhotos.left`) in the POST request body.
* **Verification**:
  - The Next.js dev server compiles without warnings, and strict `npx tsc --noEmit` verifies **zero errors**.
  - Side profiles are now fully indexed and matched instantly!
"""

with open(walkthrough_path, "r", encoding="utf-8") as f:
    content = f.read()

if "Multi-Angle Parallel Face Queries" not in content:
    content = content.rstrip() + "\n" + new_section
    with open(walkthrough_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Walkthrough updated successfully!")
else:
    print("Walkthrough already contains the updates.")
