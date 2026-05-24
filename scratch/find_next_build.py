import os

next_dir = r"c:\Users\nagen\facesnap2\frontend\.next"
found_files = []

if os.path.exists(next_dir):
    print(f"Scanning Next.js build directory: {next_dir}")
    for root, dirs, files in os.walk(next_dir):
        for file in files:
            if file.endswith(".js") or file.endswith(".html"):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                        if "getTerminalStatus" in content or "SYS_DECRYPT" in content:
                            found_files.append((file_path, len(content)))
                except Exception:
                    continue
else:
    print("Next.js build directory does not exist.")

print(f"\nScan completed. Found {len(found_files)} matches in build output:")
for path, size in found_files:
    print(f"  Path: {path} (size: {size} bytes)")
