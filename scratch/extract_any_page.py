import os
import json

brain_dir = r"C:\Users\nagen\.gemini\antigravity\brain"
print("Scanning all transcript.jsonl files in brain...")

all_writes = []

for root, dirs, files in os.walk(brain_dir):
    for file in files:
        if file == "transcript.jsonl":
            log_path = os.path.join(root, file)
            # print(f"Checking {log_path}")
            try:
                with open(log_path, 'r', encoding='utf-8') as f:
                    for line in f:
                        data = json.loads(line)
                        if "tool_calls" in data:
                            for tc in data["tool_calls"]:
                                if tc.get("name") == "write_to_file":
                                    args = tc.get("args", {})
                                    tfile = args.get("TargetFile", "")
                                    if "page.tsx" in tfile:
                                        code = args.get("CodeContent", "")
                                        if code:
                                            all_writes.append((log_path, len(code), code))
            except Exception as e:
                pass

print(f"Found {len(all_writes)} writes across all logs.")
all_writes.sort(key=lambda x: x[1], reverse=True)

for i, (path, length, code) in enumerate(all_writes[:5]):
    print(f"Rank {i}: {path} | Length: {length} chars")
    
if all_writes:
    best_path, best_length, best_code = all_writes[0]
    out_path = r"c:\Users\nagen\facesnap2\frontend\app\page.tsx.recovered"
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(best_code)
    print(f"Saved recovered page.tsx ({best_length} chars) to {out_path} from {best_path}")
else:
    print("No page.tsx writes found.")
