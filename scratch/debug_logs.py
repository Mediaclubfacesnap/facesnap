import json

log_path = r"C:\Users\nagen\.gemini\antigravity\brain\3be36ab4-8355-4f5c-bb63-aa7d40c50e18\.system_generated\logs\transcript.jsonl"
print(f"Reading logs from: {log_path}")

try:
    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
        for idx, line in enumerate(f):
            if not line.strip():
                continue
            try:
                step = json.loads(line)
                step_idx = step.get("step_index")
                step_type = step.get("type")
                tool_calls = step.get("tool_calls", [])
                if tool_calls:
                    print(f"Step {step_idx} ({step_type}):")
                    for call in tool_calls:
                        name = call.get("name", "")
                        args = call.get("args", {})
                        target = args.get("TargetFile") or args.get("TargetFile") or args.get("AbsolutePath")
                        print(f"  Tool: {name}")
                        if target:
                            print(f"    Target: {target}")
            except Exception as e:
                print(f"Error parsing line {idx}: {e}")
except Exception as e:
    print(f"Failed to open log file: {e}")
