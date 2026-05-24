import json

log_path = r"C:\Users\nagen\.gemini\antigravity\brain\3be36ab4-8355-4f5c-bb63-aa7d40c50e18\.system_generated\logs\transcript.jsonl"

with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
    for line in f:
        if not line.strip():
            continue
        try:
            step = json.loads(line)
            if step.get("step_index") == 8:
                tool_calls = step.get("tool_calls", [])
                for call in tool_calls:
                    name = call.get("name", "")
                    args = call.get("args", {})
                    print(f"Tool Name: {name}")
                    for k, v in args.items():
                        if isinstance(v, str):
                            print(f"  Key '{k}': length {len(v)} characters")
                        else:
                            print(f"  Key '{k}': {v}")
        except Exception as e:
            continue
