import os

backend_dir = r"c:\Users\nagen\facesnap2\backend"
search_terms = ["0.35", "cosine_distance", "distance_expr"]

print("Searching backend for matching terms...")
for root, dirs, files in os.walk(backend_dir):
    for file in files:
        if file.endswith(".py"):
            path = os.path.join(root, file)
            try:
                with open(path, 'r', encoding='utf-8') as f:
                    content = f.read()
                    for term in search_terms:
                        if term in content:
                            print(f"Found '{term}' in {path}")
            except Exception as e:
                pass
