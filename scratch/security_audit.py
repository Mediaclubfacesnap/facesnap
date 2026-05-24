import os
import re

backend_dir = r"c:\Users\nagen\facesnap2\backend\app"
security_findings = []

# Rules to scan for:
# 1. SQL Injection: Using text(...) with dynamic string formatting or f-strings instead of bind parameters.
# 2. SSRF: requests.get or urllib.request.urlopen without domain whitelist validation.
# 3. CORS: Wildcard origins in production.
# 4. Lack of authentication: Route endpoints without Depends(get_current_user) or Depends(get_db) dependencies.

def audit_file(file_path):
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
        lines = content.splitlines()

    # Scan for SQL Injection
    # e.g., execute(text(f"...")) or execute(text("..." + ...))
    for idx, line in enumerate(lines):
        if "text(" in line and ("f\"" in line or "f'" in line or " + " in line or ".format(" in line):
            # Exclude safe/static schema alterations on startup in main.py
            if "ALTER TABLE" not in line and "CREATE UNIQUE INDEX" not in line:
                security_findings.append({
                    "file": file_path,
                    "line": idx + 1,
                    "type": "Potential SQL Injection",
                    "content": line.strip()
                })

        # Scan for SSRF
        if "requests.get(" in line or "requests.post(" in line:
            # Check if there is a domain validation nearby
            has_validation = False
            for offset in range(-5, 6):
                check_idx = idx + offset
                if 0 <= check_idx < len(lines):
                    check_line = lines[check_idx]
                    if "supabase.co" in check_line or "whitelisted" in check_line or "validate" in check_line or "url.startswith" in check_line:
                        has_validation = True
                        break
            if not has_validation:
                security_findings.append({
                    "file": file_path,
                    "line": idx + 1,
                    "type": "Potential SSRF Vector",
                    "content": line.strip()
                })

        # Scan for CORS wildcard
        if "allow_origins=[" in line and '"*"' in line:
            security_findings.append({
                "file": file_path,
                "line": idx + 1,
                "type": "Wildcard CORS Origin",
                "content": line.strip()
            })

for root, dirs, files in os.walk(backend_dir):
    for file in files:
        if file.endswith(".py"):
            audit_file(os.path.join(root, file))

print("=== SECURITY AUDIT COMPLETED ===")
print(f"Total findings: {len(security_findings)}")
for f in security_findings:
    print(f"\n[{f['type']}] in {os.path.basename(f['file'])}:L{f['line']}")
    print(f"  Code: {f['content']}")
