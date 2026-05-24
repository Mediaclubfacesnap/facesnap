import os

walkthrough_path = r"C:\Users\nagen\.gemini\antigravity\brain\57e3efb3-c423-4058-9112-38b7fd134b80\walkthrough.md"

new_section = """

---

## 📸 Update: Live Facial Snapshot Profile Previews (May 24, 2026)

* **The Upgrade**: Integrated an active webcam canvas snapshot-capture hook into the head-pose liveness verification loop. As the user completes each required direction, the system takes an instant snapshot of their face at that pitch/yaw angle and populates a glassmorphic preview thumbnail grid under the circular scanner.
* **Key Enhancements**:
  1. **Real-time Canvas Pose Snapping**:
     - Programmed the transition state loop to capture raw frames from the webcam `<video>` element on a dynamic, in-memory `160x160` crop canvas exactly when each head movement hits `100%`.
     - Mirrored the canvas context (`ctx.translate(160, 0); ctx.scale(-1, 1);`) before rendering to match the hardware mirror representation of the video stream.
  2. **Active Thumbnail HUD Deck**:
     - Rendered a grid of four rounded-square glassmorphic thumbnail cards representing each profile:
       - ⬆️ **Pitch UP** (Pitch UP facial snapshot)
       - ⬇️ **Pitch DOWN** (Pitch DN facial snapshot)
       - ➡️ **Yaw RIGHT** (Yaw RT facial snapshot)
       - ⬅️ **Yaw LEFT** (Yaw LT facial snapshot)
     - Displays glowing border animations matching the active prompt direction.
     - When a snapshot is successfully captured, the thumbnail instantly transitions from a grey wireframe arrow to a high-contrast crop of the user's face at that angle, accented with a satisfying checkmark overlay.
  3. **Robust Lifecycle Cleanup**:
     - Interlocked thumbnail states with the session retry click handler, guaranteeing all data references and buffers reset cleanly if the liveness verification is restarted.
* **Verification**:
  - The Next.js dev server compiled the changes dynamically without issues, and `npx tsc --noEmit` verifies **zero TypeScript errors**.
"""

with open(walkthrough_path, "r", encoding="utf-8") as f:
    content = f.read()

if "Live Facial Snapshot Profile Previews" not in content:
    content = content.rstrip() + "\n" + new_section
    with open(walkthrough_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Walkthrough updated successfully!")
else:
    print("Walkthrough already contains the updates.")
