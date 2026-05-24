import json
import os

log_path = r"C:\Users\nagen\.gemini\antigravity\brain\3be36ab4-8355-4f5c-bb63-aa7d40c50e18\.system_generated\logs\transcript.jsonl"
print(f"Checking if path exists: {os.path.exists(log_path)}")
if not os.path.exists(log_path):
    # Try finding in other directories in brain
    brain_dir = r"C:\Users\nagen\.gemini\antigravity\brain"
    print("Listing directories in brain:")
    for d in os.listdir(brain_dir):
        sub_log = os.path.join(brain_dir, d, ".system_generated", "logs", "transcript.jsonl")
        if os.path.exists(sub_log):
            print(f" - Found log in {d}")
else:
    writes = []
    with open(log_path, 'r', encoding='utf-8') as f:
        for line in f:
            try:
                data = json.loads(line)
                if "tool_calls" in data:
                    for tc in data["tool_calls"]:
                        if tc.get("name") == "write_to_file":
                            args = tc.get("args", {})
                            tfile = args.get("TargetFile", "")
                            if "page.tsx" in tfile:
                                writes.append((data.get("step_index"), args.get("CodeContent"), "write"))
                        elif tc.get("name") in ["replace_file_content", "multi_replace_file_content"]:
                            args = tc.get("args", {})
                            tfile = args.get("TargetFile", "")
                            if "page.tsx" in tfile:
                                writes.append((data.get("step_index"), args, "replace"))
            except Exception as e:
                pass

    print(f"Found {len(writes)} modifications/writes to page.tsx in subagent log.")
    for idx, (step, content, type_) in enumerate(writes):
        print(f"[{idx}] Step: {step}, Type: {type_}")
        if type_ == "write":
            print(f"  Length: {len(content) if content else 0} chars")

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
        print("No large write found in subagent log.")
