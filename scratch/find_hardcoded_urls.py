import os

frontend_dir = r"c:\Users\nagen\facesnap2\frontend"
target_str = "http://localhost:8000"

found_files = []
for root, dirs, files in os.walk(frontend_dir):
    if "node_modules" in root or ".next" in root:
        continue
    for file in files:
        if file.endswith((".tsx", ".ts", ".js")):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    content = f.read()
                    if target_str in content:
                        found_files.append(filepath)
            except Exception as e:
                pass

print("Found files with hardcoded URL:")
for f in found_files:
    print(f)
