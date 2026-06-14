import os
import re

ADMIN_DIR = r"c:\Users\harsh\face new\facesnap\frontend\app\dashboard\admin"

# Regex to find the <aside>...</aside> block
aside_pattern = re.compile(r"<aside\b[^>]*>.*?</aside>", re.DOTALL)

for root, dirs, files in os.walk(ADMIN_DIR):
    for file in files:
        if file == "page.tsx":
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()
            
            # Check if it already has AdminSidebar imported
            if "AdminSidebar" in content:
                continue

            # Check if it has an aside element
            if "<aside" in content:
                # Add the import statement
                if "import AdminSidebar" not in content:
                    # Find last import
                    last_import_idx = content.rfind("import ")
                    end_of_last_import = content.find("\n", last_import_idx)
                    content = content[:end_of_last_import] + '\nimport AdminSidebar from "@/components/AdminSidebar";\n' + content[end_of_last_import:]

                # Replace the <aside> block with <AdminSidebar />
                new_content = aside_pattern.sub("<AdminSidebar />", content)
                
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(new_content)
                print(f"Refactored: {filepath}")

print("Refactoring complete.")
