import os

frontend_dir = r"c:\Users\nagen\facesnap2\frontend"
target_str = "http://localhost:8000"

for root, dirs, files in os.walk(frontend_dir):
    if "node_modules" in root or ".next" in root:
        continue
    for file in files:
        if file.endswith((".tsx", ".ts")):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    lines = f.readlines()
                for idx, line in enumerate(lines):
                    if target_str in line:
                        print(f"{file} (line {idx+1}): {line.strip()}")
            except Exception as e:
                pass
