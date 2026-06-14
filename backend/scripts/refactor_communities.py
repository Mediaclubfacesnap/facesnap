import os

backend_routes_dir = r"c:\Users\harsh\face new\facesnap\backend\app\routes"
communities_file = os.path.join(backend_routes_dir, "communities.py")

with open(communities_file, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Rename ContributorRequest -> RoleRequest classes
content = content.replace("ContributorRequestResponse", "RoleRequestResponse")
content = content.replace("ContributorRequestCreate", "RoleRequestCreate")
content = content.replace("ContributorRequestReview", "RoleRequestReview")
content = content.replace("ContributorRequest", "RoleRequest")

# 2. Fix the roles and target role logic in submit_role_request (formerly submit_contributor_request)
old_submit_logic = """    role_ranks = {"host": 5, "admin": 4, "contributor": 3, "gallery_access": 2, "member_access": 1, "member": 0}
    current_rank = role_ranks.get(role_rec.role, 0) if role_rec else 0
    
    target_role = "gallery_access"
    if request_in.request_type in ("contributor", "upload"):
        target_role = "contributor"
    elif request_in.request_type == "member":
        target_role = "member_access"
    elif request_in.request_type == "gallery":
        target_role = "gallery_access"
        
    target_rank = role_ranks.get(target_role, 0)"""

new_submit_logic = """    role_ranks = {"host": 3, "admin": 2, "moderator": 1}
    current_rank = role_ranks.get(role_rec.role, 0) if role_rec and role_rec.role else 0
    
    target_role = request_in.request_type
    target_rank = role_ranks.get(target_role, 0)"""

content = content.replace(old_submit_logic, new_submit_logic)

# 3. Fix the target role logic in review_role_request (formerly review_contributor_request)
old_review_logic = """        # Target role based on request_type
        target_role = "gallery_access"
        if req_rec.request_type in ("contributor", "upload"):
            target_role = "contributor"
        elif req_rec.request_type == "member":
            target_role = "member_access"
        elif req_rec.request_type == "gallery":
            target_role = "gallery_access"

        if role_rec_db:
            role_ranks = {"host": 5, "admin": 4, "contributor": 3, "gallery_access": 2, "member_access": 1, "member": 0}
            current_rank = role_ranks.get(role_rec_db.role, 0)
            target_rank = role_ranks.get(target_role, 0)
            if target_rank > current_rank:
                role_rec_db.role = target_role"""

new_review_logic = """        # Target role based on request_type
        target_role = req_rec.request_type

        if role_rec_db:
            role_ranks = {"host": 3, "admin": 2, "moderator": 1}
            current_rank = role_ranks.get(role_rec_db.role, 0) if role_rec_db.role else 0
            target_rank = role_ranks.get(target_role, 0)
            if target_rank > current_rank:
                role_rec_db.role = target_role"""

content = content.replace(old_review_logic, new_review_logic)

# 4. Join Requests - change member to NULL
old_join_logic = """        if not role_res.scalar_one_or_none():
            new_role = CommunityRole(
                community_id=req_rec.community_id,
                user_id=req_rec.user_id,
                role="member"
            )
            db.add(new_role)"""

new_join_logic = """        if not role_res.scalar_one_or_none():
            new_role = CommunityRole(
                community_id=req_rec.community_id,
                user_id=req_rec.user_id,
                role=None
            )
            db.add(new_role)"""

content = content.replace(old_join_logic, new_join_logic)

# Join Request Auto-Join
old_auto_join = """    # Automatically add as guest/member upon joining
    new_role = CommunityRole(
        community_id=community_id,
        user_id=current_user.id,
        role="member"
    )
    db.add(new_role)"""

new_auto_join = """    # Automatically add as approved participant upon joining
    new_role = CommunityRole(
        community_id=community_id,
        user_id=current_user.id,
        role=None
    )
    db.add(new_role)"""

content = content.replace(old_auto_join, new_auto_join)

# 5. Invitation Accept -> gallery_access -> NULL
old_invite_accept = """        if not role_res.scalar_one_or_none():
            new_role = CommunityRole(
                community_id=inv.community_id,
                user_id=current_user.id,
                role="gallery_access"
            )
            db.add(new_role)"""

new_invite_accept = """        if not role_res.scalar_one_or_none():
            new_role = CommunityRole(
                community_id=inv.community_id,
                user_id=current_user.id,
                role=None
            )
            db.add(new_role)"""

content = content.replace(old_invite_accept, new_invite_accept)

with open(communities_file, "w", encoding="utf-8") as f:
    f.write(content)

print(f"Refactored {communities_file}")
