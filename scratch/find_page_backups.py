import os

root_path = r"c:\Users\nagen\facesnap2"
for root, dirs, files in os.walk(root_path):
    if "node_modules" in root or ".next" in root:
        continue
    for file in files:
        if "page" in file.lower():
            file_path = os.path.join(root, file)
            print(f"File: {file_path} (size: {os.path.getsize(file_path)} bytes)")
