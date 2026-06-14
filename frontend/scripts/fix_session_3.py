import os
import re

frontend_dir = r"c:\Users\harsh\face new\facesnap\frontend\app\dashboard"

for root, dirs, files in os.walk(frontend_dir):
    for file in files:
        if file.endswith(".tsx") or file.endswith(".ts"):
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()

            new_content = content
            
            # Replace 'session' with 'token' inside destructuring from useAuthStore
            new_content = re.sub(r'const\s*{\s*([^}]*)session([^}]*)\s*}\s*=\s*useAuthStore\(\);?', 
                                 r'const {\1token\2} = useAuthStore();', new_content)
            
            # Replace access to session with token
            new_content = new_content.replace('session?.access_token', 'token')
            new_content = new_content.replace('session?.token', 'token')
            new_content = new_content.replace('session.access_token', 'token')
            new_content = new_content.replace('session.token', 'token')

            if new_content != content:
                print(f"Fixed session in {filepath}")
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(new_content)

print("Done fixing sessions.")
