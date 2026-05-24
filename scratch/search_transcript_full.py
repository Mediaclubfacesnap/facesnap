import os
import json

brain_dir = r"C:\Users\nagen\.gemini\antigravity\brain"
matches = []

for root, dirs, files in os.walk(brain_dir):
    for file in files:
        if file == "transcript.jsonl":
            log_path = os.path.join(root, file)
            try:
                with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                    for line in f:
                        if "page.tsx" in line:
                            # Let's inspect this line
                            try:
                                step = json.loads(line)
                                if "tool_calls" in step:
                                    for call in step["tool_calls"]:
                                        name = call.get("name", "")
                                        args = call.get("args", {})
                                        target = args.get("TargetFile", "")
                                        if "page.tsx" in target and not target.endswith("my-groups/[id]/page.tsx") and not target.endswith("communities/[id]/page.tsx") and not target.endswith("discover/page.tsx"):
                                            # Check content size
                                            code = args.get("CodeContent") or args.get("ReplacementContent") or ""
                                            if not code and "ReplacementChunks" in args:
                                                code = "".join([chunk.get("ReplacementContent", "") for chunk in args["ReplacementChunks"]])
                                            
                                            matches.append({
                                                "log": log_path,
                                                "tool": name,
                                                "size": len(code),
                                                "target": target,
                                                "snippet": code[:100]
                                            })
                            except Exception:
                                pass
            except Exception as e:
                pass

print(f"Total matches found: {len(matches)}")
# Sort matches by size descending
matches.sort(key=lambda x: x["size"], reverse=True)
for idx, m in enumerate(matches[:15]):
    print(f"\nMatch #{idx + 1}:")
    print(f"  Log: {m['log']}")
    print(f"  Tool: {m['tool']}")
    print(f"  Target: {m['target']}")
    print(f"  Size: {m['size']} bytes")
    print(f"  Snippet: {repr(m['snippet'])}")
