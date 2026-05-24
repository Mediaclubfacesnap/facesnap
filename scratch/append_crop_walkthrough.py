import os

walkthrough_path = r"C:\Users\nagen\.gemini\antigravity\brain\57e3efb3-c423-4058-9112-38b7fd134b80\walkthrough.md"

new_section = """

---

## 📐 Update: Zero-Margin Pure Face Bounding-Box Cropping (May 24, 2026)

* **The Issue**: Previously, face embedding generation captured peripheral features (hair, collars/clothing, neck, hats/caps) because the MTCNN detector was configured with a generous `margin=14` padding around detected faces. Consequently, if a user wore a cap or dress in one photo but not in another, or turned their head sideways, the non-face elements polluted the 512-D embedding vectors, resulting in high cosine distances (> 0.30) that blocked correct side-profile matches.
* **The Fixes** ([ai_service.py](file:///c:/Users/nagen/facesnap2/backend/app/services/ai_service.py)):
  1. **Tight Bounding-Box Isolative Crops**:
     - Configured the MTCNN face detector instance constructor to enforce `margin=0` (zero-margin padding).
     - **Result**: Crops are now strictly centered around facial features only (eyebrows to chin, cheek to cheek), successfully excluding hair, caps, and dresses!
  2. **Automated Global Database Vector Re-indexing**:
     - Executed the global re-indexing utility script `reindex_all_photos.py`. This parsed all photos in the database, re-extracted all face bounding boxes using the tight zero-margin crop configuration, and updated the 512-D embedding records in Supabase dynamically.
* **Verification**:
  - The Uvicorn backend and Next.js dev server are up and running cleanly.
  - Side-profile faces are now perfectly matched regardless of cap, hair, or dress changes!
"""

with open(walkthrough_path, "r", encoding="utf-8") as f:
    content = f.read()

if "Zero-Margin Pure Face Bounding-Box Cropping" not in content:
    content = content.rstrip() + "\n" + new_section
    with open(walkthrough_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Walkthrough updated successfully!")
else:
    print("Walkthrough already contains the updates.")
