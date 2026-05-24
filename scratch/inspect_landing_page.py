import os

file_path = r"c:\Users\nagen\facesnap2\frontend\app\page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

print("Length:", len(content))
print("Start:", repr(content[:50]))
print("End:", repr(content[-50:]))

# Let's try parsing it as an escaped string manually
try:
    # If it is wrapped in double quotes, let's unwrap it
    cleaned = content.strip()
    if cleaned.startswith('"') and cleaned.endswith('"'):
        # It is wrapped in quotes
        import codecs
        # Decode the escaped string
        # Since it is a string representation of python bytes, we can use codecs.escape_decode
        raw_str = cleaned[1:-1]
        decoded = codecs.escape_decode(bytes(raw_str, "utf-8"))[0].decode("utf-8")
        print("Manually decoded successfully! New length:", len(decoded))
        print("Decoded start:", repr(decoded[:100]))
        with open(file_path, "w", encoding="utf-8") as f_out:
            f_out.write(decoded)
        print("Overwrote file with unescaped version.")
except Exception as e:
    print("Manual decode failed:", e)
