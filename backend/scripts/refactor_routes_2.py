import os
import re

backend_routes_dir = r"c:\Users\harsh\face new\facesnap\backend\app\routes"

# Process communities.py
communities_file = os.path.join(backend_routes_dir, "communities.py")
with open(communities_file, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update `evict_member` notification
content = content.replace(
    'title="Member Removed"',
    'title="Access Removed"'
)

# 2. Update `demote_admin` target role logic
content = content.replace(
    'target_role.role = "member"',
    'target_role.role = None'
)

content = content.replace(
    'action="Admin Demoted",\n        target=f"User ID: {target_user_id} demoted to member",',
    'action="Elevated Access Removed",\n        target=f"User ID: {target_user_id} demoted to participant",'
)

content = content.replace(
    'message="Your Community Admin role has been removed"',
    'message="Your elevated access has been removed"'
)

# 3. Update `super_admin_update_role` validation
content = content.replace(
    'payload.role not in ["member", "moderator", "admin", "host"]',
    'payload.role not in [None, "moderator", "admin", "host"]'
)

content = content.replace(
    'hierarchy = {"member": 0, "moderator": 1, "admin": 2, "host": 3}',
    'hierarchy = {None: 0, "moderator": 1, "admin": 2, "host": 3}'
)

# 4. Check if role already exists in Join Request
content = content.replace(
    'detail="You are already a member of this group."',
    'detail="You already possess group workspace privileges."'
)

with open(communities_file, "w", encoding="utf-8") as f:
    f.write(content)

# Process events.py
events_file = os.path.join(backend_routes_dir, "events.py")
with open(events_file, "r", encoding="utf-8") as f:
    e_content = f.read()

e_content = e_content.replace(
    'verify_contributor_permission',
    'verify_moderator_permission'
)
e_content = e_content.replace(
    'role_ranks = {"host": 5, "admin": 4, "contributor": 3, "gallery_access": 2, "member_access": 1, "member": 0}',
    'role_ranks = {"host": 3, "admin": 2, "moderator": 1}'
)
e_content = e_content.replace(
    'return role_record.role in ("host", "admin", "contributor")',
    'return role_record.role in ("host", "admin", "moderator")'
)
# Members can register without explicit role="member"
# "Verify user is member of the parent community" is handled by just existing in CommunityRole.
e_content = e_content.replace(
    'role_record.role != "member" and',
    'role_record.role is not None and'
)
with open(events_file, "w", encoding="utf-8") as f:
    f.write(e_content)

# Process uploads.py
uploads_file = os.path.join(backend_routes_dir, "uploads.py")
with open(uploads_file, "r", encoding="utf-8") as f:
    u_content = f.read()

u_content = u_content.replace(
    'verify_contributor_permission',
    'verify_moderator_permission'
)
u_content = u_content.replace(
    'You must be a host or contributor to upload photos.',
    'Only Hosts and Community Admins can upload community media.'
)
# Wait, uploads only for super_admin, host, admin!
# Currently `verify_moderator_permission` allows moderators. 
# We should change `has_permission = await verify_moderator_permission(...)` 
# to `check_is_host_or_admin`
with open(uploads_file, "w", encoding="utf-8") as f:
    f.write(u_content)

print("Second refactor phase complete!")
