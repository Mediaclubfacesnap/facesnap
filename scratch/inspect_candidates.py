import os
import json

brain_dir = r"C:\Users\nagen\.gemini\antigravity\brain"
candidates = []

for root, dirs, files in os.walk(brain_dir):
    for file in files:
        if file == "transcript.jsonl":
            log_path = os.path.join(root, file)
            try:
                with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        if not line.strip():
                            continue
                        try:
                            step = json.loads(line)
                            if "tool_calls" in step:
                                for call in step["tool_calls"]:
                                    name = call.get("name", "")
                                    if any(target in name for target in ("write_to_file", "replace_file_content", "multi_replace_file_content")):
                                        args = call.get("args", {})
                                        target_file = args.get("TargetFile") or args.get("TargetFile")
                                        if target_file and "page.tsx" in target_file and not target_file.endswith("my-groups/[id]/page.tsx") and not target_file.endswith("communities/[id]/page.tsx") and not target_file.endswith("discover/page.tsx"):
                                            # Extract code content depending on write or replace tool
                                            content = args.get("CodeContent") or args.get("ReplacementContent")
                                            if not content and "ReplacementChunks" in args:
                                                # Join chunks content
                                                content = "".join([chunk.get("ReplacementContent", "") for chunk in args["ReplacementChunks"]])
                                            
                                            if content:
                                                candidates.append({
                                                    "log": log_path,
                                                    "tool": name,
                                                    "size": len(content),
                                                    "content": content
                                                })
                        except Exception:
                            continue
            except Exception as e:
                print(f"Error reading log file {log_path}: {e}")

print(f"\nTotal candidates found: {len(candidates)}")
# Sort candidates by size descending
candidates.sort(key=lambda x: x["size"], reverse=True)
for idx, c in enumerate(candidates[:10]):
    print(f"\nCandidate #{idx + 1}:")
    print(f"  Log: {c['log']}")
    print(f"  Tool: {c['tool']}")
    print(f"  Size: {c['size']} bytes")
    print(f"  Snippet: {c['content'][:150]}...")

if candidates:
    # Let's restore the largest one!
    best = candidates[0]
    print(f"\nRestoring largest candidate of size {best['size']} bytes from {best['log']}...")
    target_path = r"c:\Users\nagen\facesnap2\frontend\app\page.tsx"
    with open(target_path, "w", encoding="utf-8") as out:
        out.write(best["content"])
    print("SUCCESS: page.tsx restored successfully!")
else:
    print("No candidates found.")
