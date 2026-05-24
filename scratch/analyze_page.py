with open(r"c:\Users\nagen\facesnap2\frontend\app\page.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

print(f"Total lines in file: {len(lines)}")
for i, line in enumerate(lines[:60]):
    print(f"{i+1:02d}: {repr(line[:100])} (len={len(line)})")
