import json
import re

log_path = r"C:\Users\nagen\.gemini\antigravity\brain\57e3efb3-c423-4058-9112-38b7fd134b80\.system_generated\logs\transcript.jsonl"
target_file_sub = "frontend/app/page.tsx"

print("Scanning log file...")
writes = []
with open(log_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            # Look for write_to_file calls or replace_file_content calls
            if "tool_calls" in data:
                for tc in data["tool_calls"]:
                    if tc.get("name") == "write_to_file":
                        args = tc.get("args", {})
                        tfile = args.get("TargetFile", "")
                        if "page.tsx" in tfile:
                            writes.append((data.get("step_index"), args.get("CodeContent"), "write"))
                    elif tc.get("name") == "replace_file_content" or tc.get("name") == "multi_replace_file_content":
                        args = tc.get("args", {})
                        tfile = args.get("TargetFile", "")
                        if "page.tsx" in tfile:
                            writes.append((data.get("step_index"), args, "replace"))
        except Exception as e:
            pass

print(f"Found {len(writes)} modifications/writes to page.tsx.")
for idx, (step, content, type_) in enumerate(writes):
    print(f"[{idx}] Step: {step}, Type: {type_}")
    if type_ == "write":
        print(f"  Length: {len(content) if content else 0} chars")

# Let's save the last complete write content if found
last_write_content = None
for idx in range(len(writes) - 1, -1, -1):
    step, content, type_ = writes[idx]
    if type_ == "write" and content and len(content) > 5000:
        last_write_content = content
        print(f"Selecting write at step {step} with length {len(content)}")
        break

if last_write_content:
    out_path = r"c:\Users\nagen\facesnap2\frontend\app\page.tsx.recovered"
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(last_write_content)
    print(f"Saved recovered page.tsx to {out_path}")
else:
    print("No large write found to recover.")
