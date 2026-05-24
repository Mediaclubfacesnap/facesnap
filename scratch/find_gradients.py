import glob
import re

for filename in glob.glob('frontend/app/**/*.tsx', recursive=True):
    try:
        content = open(filename, encoding='utf-8').read()
        gradients = re.findall(r'bg-gradient-to-[^\s\}\"\']+', content)
        if gradients:
            print(f"{filename}: {gradients}")
    except Exception as e:
        pass
