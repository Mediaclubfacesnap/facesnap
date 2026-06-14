import os

frontend_dir = r"c:\Users\harsh\face new\facesnap\frontend\app\dashboard"

for root, dirs, files in os.walk(frontend_dir):
    for file in files:
        if file.endswith(".tsx"):
            filepath = os.path.join(root, file)
            with open(filepath, "r", encoding="utf-8") as f:
                content = f.read()

            # Search for `session` in dependency arrays
            if "[session]" in content or ", session" in content or "session," in content:
                content = content.replace("[session]", "[token]")
                content = content.replace(", session]", ", token]")
                content = content.replace("[session,", "[token,")
                content = content.replace(" session ", " token ")
                
                with open(filepath, "w", encoding="utf-8") as f:
                    f.write(content)

print("Fixed array deps")
