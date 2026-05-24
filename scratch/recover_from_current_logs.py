import os
import json

log_path = r"C:\Users\nagen\.gemini\antigravity\brain\57e3efb3-c423-4058-9112-38b7fd134b80\.system_generated\logs\transcript.jsonl"
print(f"Searching current log file: {log_path}")

view_file_outputs = []

try:
    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
        for idx, line in enumerate(f):
            if not line.strip():
                continue
            try:
                step = json.loads(line)
                # Check tool outputs or results in step
                # A step inside jsonl logs might have "status": "DONE", "output" or similar keys
                # Let's inspect the entire step structure and look for keys containing page.tsx contents
                step_str = json.dumps(step)
                if "Total Lines: 1033" in step_str:
                    print(f"Found step matching 'Total Lines: 1033' at line {idx}!")
                    view_file_outputs.append((idx, step))
            except Exception as e:
                continue
except Exception as e:
    print(f"Failed to read logs: {e}")

print(f"Found {len(view_file_outputs)} matching steps.")
if view_file_outputs:
    # Let's dump the step JSON to inspect
    best_idx, best_step = view_file_outputs[0]
    print(f"Extracting page.tsx content from step at line {best_idx}...")
    
    # Save the step JSON so we can analyze it
    with open(r"c:\Users\nagen\facesnap2\scratch\matched_step.json", "w", encoding="utf-8") as out:
        json.dump(best_step, out, indent=2)
    print("Step details saved to scratch/matched_step.json!")
else:
    print("No matching steps found.")
