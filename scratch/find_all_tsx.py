import os

root_path = r"c:\Users\nagen\facesnap2\frontend\app"
for root, dirs, files in os.walk(root_path):
    for file in files:
        if file.endswith(".tsx"):
            file_path = os.path.join(root, file)
            print(f"File: {file_path} (size: {os.path.getsize(file_path)} bytes)")
