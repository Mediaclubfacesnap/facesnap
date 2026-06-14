import os
import shutil
import sys

def clean():
    site_packages = "C:\\Users\\harsh\\AppData\\Local\\Programs\\Python\\Python312\\Lib\\site-packages"
    if not os.path.exists(site_packages):
        print(f"Path not found: {site_packages}")
        return
        
    print(f"Scanning {site_packages}...")
    for item in os.listdir(site_packages):
        if item.startswith("~"):
            full_path = os.path.join(site_packages, item)
            print(f"Found corrupted/legacy folder: {item}")
            try:
                if os.path.isdir(full_path):
                    shutil.rmtree(full_path)
                    print(f"Successfully deleted directory: {item}")
                else:
                    os.remove(full_path)
                    print(f"Successfully deleted file: {item}")
            except Exception as e:
                print(f"Failed to delete {item}: {e}")

if __name__ == "__main__":
    clean()
