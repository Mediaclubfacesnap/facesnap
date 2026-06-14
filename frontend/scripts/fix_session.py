import os

frontend_dir = r"c:\Users\harsh\face new\facesnap\frontend\app\dashboard"

for root, dirs, files in os.walk(frontend_dir):
    for file in files:
        if file.endswith(".tsx"):
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()

            if "const { session } = useAuthStore()" in content:
                content = content.replace("const { session } = useAuthStore()", "const { token } = useAuthStore()")
                content = content.replace("session?.access_token", "token")
                content = content.replace("session.access_token", "token")
                
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(content)
                    
            elif "const { session, user } = useAuthStore()" in content:
                content = content.replace("const { session, user } = useAuthStore()", "const { token, user } = useAuthStore()")
                content = content.replace("session?.access_token", "token")
                content = content.replace("session.access_token", "token")
                
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(content)

print("Fixed session references in frontend")
