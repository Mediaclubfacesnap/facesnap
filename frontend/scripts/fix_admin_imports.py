import os
import glob
import re

base_dir = r"c:\Users\harsh\face new\facesnap\frontend\app\dashboard\admin"
page_files = glob.glob(os.path.join(base_dir, "**", "page.tsx"), recursive=True)

missing_icons = ["Camera", "MessageSquare", "Cpu", "Smartphone"]

for file_path in page_files:
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Find the lucide-react import block
    import_match = re.search(r'import\s+\{([^}]+)\}\s+from\s+"lucide-react";', content)
    if import_match:
        existing_imports = import_match.group(1)
        # Check for missing icons
        to_add = [icon for icon in missing_icons if icon not in existing_imports]
        
        if to_add:
            # We add the missing ones
            new_imports = existing_imports.rstrip()
            if not new_imports.endswith(','):
                new_imports += ','
            new_imports += " " + ", ".join(to_add)
            
            new_import_block = f'import {{{new_imports}\n}} from "lucide-react";'
            content = content.replace(import_match.group(0), new_import_block)
            
            with open(file_path, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"Fixed imports in {file_path}")
