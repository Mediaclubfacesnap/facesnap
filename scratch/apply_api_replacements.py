import os

# Define exact replacements for each file to ensure 100% syntax correctness
replacements = {
    r"frontend\app\auth\login\page.tsx": [
        ('fetch("http://localhost:8000/api/v1/auth/login", {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/auth/login`, {')
    ],
    r"frontend\app\auth\signup\page.tsx": [
        ('fetch(`http://localhost:8000/api/v1/auth/check-username?username=@${formatted}`);', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/auth/check-username?username=@${formatted}`);'),
        ('fetch("http://localhost:8000/api/v1/auth/signup", {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/auth/signup`, {')
    ],
    r"frontend\app\dashboard\page.tsx": [
        ('fetch("http://localhost:8000/api/v1/communities/"),', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/`),'),
        ('fetch("http://localhost:8000/api/v1/communities/my-roles", {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/my-roles`, {'),
        ('fetch("http://localhost:8000/api/v1/communities/my-invitations", {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/my-invitations`, {'),
        ('fetch("http://localhost:8000/api/v1/communities/", {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/`, {'),
        ('fetch(`http://localhost:8000/api/v1/communities/invitations/${invId}/respond`, {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/invitations/${invId}/respond`, {')
    ],
    r"frontend\app\dashboard\communities\[id]\page.tsx": [
        ('fetch(`http://localhost:8000/api/v1/communities/${communityId}`);', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}`);'),
        ('fetch(`http://localhost:8000/api/v1/communities/${communityId}/roles`);', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/roles`);'),
        ('fetch(`http://localhost:8000/api/v1/events/community/${communityId}`);', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/community/${communityId}`);'),
        ('fetch(`http://localhost:8000/api/v1/communities/${communityId}/requests`, {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/requests`, {')
    ],
    r"frontend\app\dashboard\discover\page.tsx": [
        ('fetch("http://localhost:8000/api/v1/communities/"),', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/`),'),
        ('fetch("http://localhost:8000/api/v1/communities/my-roles", {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/my-roles`, {'),
        ('fetch("http://localhost:8000/api/v1/communities/my-stars", {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/my-stars`, {'),
        ('fetch(`http://localhost:8000/api/v1/communities/${communityId}/star`, {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/star`, {'),
        ('fetch("http://localhost:8000/api/v1/communities/", {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/`, {')
    ],
    r"frontend\app\dashboard\events\[id]\page.tsx": [
        ('fetch(`http://localhost:8000/api/v1/events/${eventId}`);', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${eventId}`);')
    ],
    r"frontend\app\dashboard\events\[id]\gallery\page.tsx": [
        ('fetch(`http://localhost:8000/api/v1/verification/results/${eventId}`, {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/verification/results/${eventId}`, {'),
        ('fetch("http://localhost:8000/api/v1/verification/download", {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/verification/download`, {')
    ],
    r"frontend\app\dashboard\events\[id]\verify\page.tsx": [
        ('fetch(`http://localhost:8000/api/v1/verification/${eventId}`, {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/verification/${eventId}`, {')
    ],
    r"frontend\app\dashboard\my-groups\[id]\page.tsx": [
        ('fetch(`http://localhost:8000/api/v1/verification/history/${communityId}`, {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/verification/history/${communityId}`, {'),
        ('fetch(`http://localhost:8000/api/v1/verification/stats/${communityId}`, {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/verification/stats/${communityId}`, {'),
        ('fetch("http://localhost:8000/api/v1/uploads/banner", {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/uploads/banner`, {'),
        ('fetch(`http://localhost:8000/api/v1/communities/${communityId}/banner`, {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/banner`, {'),
        ('fetch(`http://localhost:8000/api/v1/events/${selectedEvent.id}/banner`, {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${selectedEvent.id}/banner`, {'),
        ('fetch("http://localhost:8000/api/v1/communities/");', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/`);'),
        ('fetch("http://localhost:8000/api/v1/communities/my-roles", {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/my-roles`, {'),
        ('fetch(`http://localhost:8000/api/v1/communities/${communityId}`);', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}`);'),
        ('fetch(`http://localhost:8000/api/v1/communities/${communityId}/roles`);', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/roles`);'),
        ('fetch(`http://localhost:8000/api/v1/events/community/${communityId}`);', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/community/${communityId}`);'),
        ('fetch(`http://localhost:8000/api/v1/communities/${communityId}/requests`, {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/requests`, {'),
        ('fetch(`http://localhost:8000/api/v1/communities/${communityId}/invitations`, {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/invitations`, {'),
        ('fetch(`http://localhost:8000/api/v1/verification/stats/${communityId}`, {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/verification/stats/${communityId}`, {'),
        ('fetch(`http://localhost:8000/api/v1/events/${communityId}`, {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/events/${communityId}`, {'),
        ('fetch(`http://localhost:8000/api/v1/uploads/${selectedEvent.id}`, {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/uploads/${selectedEvent.id}`, {'),
        ('fetch(`http://localhost:8000/api/v1/communities/${communityId}/requests/${requestId}/review`, {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/requests/${requestId}/review`, {'),
        ('fetch(`http://localhost:8000/api/v1/communities/${communityId}/members/${userId}/role`, {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/members/${userId}/role`, {'),
        ('fetch(`http://localhost:8000/api/v1/communities/${communityId}/members/${userId}`, {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/members/${userId}`, {'),
        ('fetch(`http://localhost:8000/api/v1/communities/${communityId}`, {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}`, {'),
        ('fetch(`http://localhost:8000/api/v1/communities/search-users?q=${inviteSearchQuery}`, {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/search-users?q=${inviteSearchQuery}`, {'),
        ('fetch(`http://localhost:8000/api/v1/communities/${communityId}/invitations`, {', 'fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/${communityId}/invitations`, {')
    ]
}

base_dir = r"c:\Users\nagen\facesnap2"

for rel_path, pairs in replacements.items():
    fullpath = os.path.join(base_dir, rel_path)
    if os.path.exists(fullpath):
        print(f"Migrating URLs in file: {rel_path}...")
        with open(fullpath, "r", encoding="utf-8") as f:
            content = f.read()
        
        orig_content = content
        for target, replacement in pairs:
            content = content.replace(target, replacement)
        
        if content != orig_content:
            with open(fullpath, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"Successfully migrated {len(pairs)} URLs in {rel_path}!")
        else:
            print(f"No changes made to {rel_path} (could have been migrated already).")
    else:
        print(f"File not found: {fullpath}")

print("API URL Migration completed successfully!")
