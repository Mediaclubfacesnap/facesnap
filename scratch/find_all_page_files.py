import os

search_roots = [
    r"C:\Users\nagen\.gemini\antigravity\brain",
    r"c:\Users\nagen\facesnap2"
]

found_files = []

for root_path in search_roots:
    print(f"Scanning root: {root_path}")
    for root, dirs, files in os.walk(root_path):
        # Skip node_modules and .next to avoid scanning millions of files
        if "node_modules" in root or ".next" in root:
            continue
        for file in files:
            if file.endswith(".tsx") or file.endswith(".bak") or file.endswith(".py"):
                file_path = os.path.join(root, file)
                try:
                    # Check if file has our custom text
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                        if "getTerminalStatus" in content or "Holographic HUD" in content or "SYS_DECRYPT" in content:
                            found_files.append((file_path, len(content)))
                except Exception:
                    continue

print(f"\nScan completed. Found {len(found_files)} matches:")
for path, size in found_files:
    print(f"  Path: {path} (size: {size} bytes)")
