import os
import json

brain_dir = r"C:\Users\nagen\.gemini\antigravity\brain"
found_contents = []

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
                            # Check tool calls inside the step
                            if "tool_calls" in step:
                                for call in step["tool_calls"]:
                                    name = call.get("name", "")
                                    if any(target in name for target in ("write_to_file", "replace_file_content", "multi_replace_file_content")):
                                        args = call.get("args", {})
                                        target_file = args.get("TargetFile") or args.get("TargetFile")
                                        if target_file and "page.tsx" in target_file and not target_file.endswith("my-groups/[id]/page.tsx") and not target_file.endswith("communities/[id]/page.tsx") and not target_file.endswith("discover/page.tsx"):
                                            content = args.get("CodeContent")
                                            if content:
                                                found_contents.append((log_path, content))
                        except Exception:
                            continue
            except Exception as e:
                print(f"Error reading log file {log_path}: {e}")

print(f"\nScan completed. Found {len(found_contents)} page.tsx candidates.")
if found_contents:
    # Sort by length to get the largest/most complete one
    found_contents.sort(key=lambda x: len(x[1]), reverse=True)
    best_log, best_content = found_contents[0]
    print(f"Restoring best candidate from {best_log} (size: {len(best_content)} bytes)...")
    
    target_path = r"c:\Users\nagen\facesnap2\frontend\app\page.tsx"
    with open(target_path, "w", encoding="utf-8") as out:
        out.write(best_content)
    print("SUCCESS: page.tsx has been fully restored!")
else:
    print("No candidates found in logs.")
