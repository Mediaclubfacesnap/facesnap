from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from typing import List
from uuid import UUID
import logging
from app.database import get_db
from app.models import Community, CommunityRole, User, ContributorRequest, Invitation, CommunityStar
from app.schemas import (
    CommunityCreate, CommunityResponse, CommunityRoleResponse, 
    ContributorRequestResponse, ContributorRequestReview,
    ContributorRequestCreate, MemberRoleUpdate,
    InvitationCreate, InvitationResponse
)
from app.routes.auth import get_current_user

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/communities", tags=["Communities"])

async def check_is_host_or_admin(community_id: UUID, user_id: UUID, db: AsyncSession) -> bool:
    """Helper to check if a user is the Host or an Admin of the community."""
    stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == user_id
    )
    result = await db.execute(stmt)
    role_record = result.scalar_one_or_none()
    if not role_record:
        return False
    return role_record.role in ("host", "admin")

@router.post("/", response_model=CommunityResponse, status_code=status.HTTP_201_CREATED)
async def create_community(
    community_in: CommunityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Create community
    new_community = Community(
        title=community_in.title,
        description=community_in.description,
        category=community_in.category,
        logo_url=community_in.logo_url,
        banner_url=community_in.banner_url,
        creator_id=current_user.id
    )
    db.add(new_community)
    await db.commit()
    await db.refresh(new_community)

    # Automatically add creator as 'host' in community_roles
    host_role = CommunityRole(
        community_id=new_community.id,
        user_id=current_user.id,
        role="host"
    )
    db.add(host_role)
    await db.commit()

    return new_community

@router.get("/", response_model=List[CommunityResponse])
async def list_communities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Community).order_by(Community.created_at.desc()))
    return result.scalars().all()

@router.get("/my-groups", response_model=List[CommunityResponse])
async def get_my_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = (
        select(Community)
        .join(CommunityRole)
        .where(CommunityRole.user_id == current_user.id)
        .order_by(Community.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/my-roles")
async def get_my_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(CommunityRole).where(CommunityRole.user_id == current_user.id)
    res = await db.execute(stmt)
    roles_list = res.scalars().all()
    return {str(r.community_id): r.role for r in roles_list}

@router.get("/my-invitations")
async def get_my_invitations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Invitation).where(
        Invitation.invitee_id == current_user.id,
        Invitation.status == "pending"
    )
    res = await db.execute(stmt)
    invites = res.scalars().all()
    
    enriched = []
    for inv in invites:
        comm_stmt = select(Community).where(Community.id == inv.community_id)
        comm_res = await db.execute(comm_stmt)
        comm = comm_res.scalar_one_or_none()
        
        inviter_stmt = select(User).where(User.id == inv.inviter_id)
        inviter_res = await db.execute(inviter_stmt)
        inviter = inviter_res.scalar_one_or_none()
        
        enriched.append({
            "id": str(inv.id),
            "status": inv.status,
            "created_at": inv.created_at.isoformat(),
            "community": {
                "id": str(comm.id) if comm else "",
                "title": comm.title if comm else "",
                "description": comm.description if comm else ""
            },
            "inviter": {
                "id": str(inviter.id) if inviter else "",
                "username": inviter.username if inviter else "",
                "full_name": inviter.full_name if inviter else ""
            }
        })
    return enriched

@router.get("/my-stars")
async def get_my_stars(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns list of community_id strings that current user has starred."""
    stmt = select(CommunityStar).where(CommunityStar.user_id == current_user.id)
    res = await db.execute(stmt)
    stars = res.scalars().all()
    return [str(s.community_id) for s in stars]

@router.get("/{community_id}", response_model=CommunityResponse)
async def get_community(community_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Community).where(Community.id == community_id))
    community = result.scalar_one_or_none()
    if not community:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Community not found"
        )
    return community

@router.post("/{community_id}/join", status_code=status.HTTP_201_CREATED)
async def join_group(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify community exists
    result = await db.execute(select(Community).where(Community.id == community_id))
    if not result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Community not found"
        )

    # Check if role already exists
    role_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    role_res = await db.execute(role_stmt)
    if role_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You are already a member of this group."
        )

    # Automatically add as guest/member upon joining
    new_role = CommunityRole(
        community_id=community_id,
        user_id=current_user.id,
        role="member"
    )
    db.add(new_role)
    await db.commit()
    return {"message": "Successfully joined the group workspace."}

@router.get("/{community_id}/roles", response_model=List[CommunityRoleResponse])
async def list_community_roles(community_id: UUID, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(CommunityRole)
        .where(CommunityRole.community_id == community_id)
        .options(selectinload(CommunityRole.user))
    )
    result = await db.execute(stmt)
    return result.scalars().all()

# --- Contributor Requests API Endpoints ---

@router.post("/{community_id}/requests", response_model=ContributorRequestResponse, status_code=status.HTTP_201_CREATED)
async def submit_contributor_request(
    community_id: UUID,
    request_in: ContributorRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify community exists
    comm_res = await db.execute(select(Community).where(Community.id == community_id))
    if not comm_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Community not found."
        )

    # Check existing user role
    role_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    role_res = await db.execute(role_stmt)
    role_rec = role_res.scalar_one_or_none()
    
    role_ranks = {"host": 5, "admin": 4, "contributor": 3, "gallery_access": 2, "member_access": 1, "member": 0}
    current_rank = role_ranks.get(role_rec.role, 0) if role_rec else 0
    
    target_role = "gallery_access"
    if request_in.request_type in ("contributor", "upload"):
        target_role = "contributor"
    elif request_in.request_type == "member":
        target_role = "member_access"
    elif request_in.request_type == "gallery":
        target_role = "gallery_access"
        
    target_rank = role_ranks.get(target_role, 0)
    
    if current_rank >= target_rank and current_rank > 0:
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already possess equal or higher privileges than requested."
        )

    # Check if request already exists for this specific type
    req_stmt = select(ContributorRequest).where(
        ContributorRequest.community_id == community_id,
        ContributorRequest.user_id == current_user.id,
        ContributorRequest.request_type == request_in.request_type
    )
    req_res = await db.execute(req_stmt)
    existing_req = req_res.scalar_one_or_none()
    if existing_req:
        if existing_req.status == "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Your '{request_in.request_type}' request is currently pending review."
            )
        # Clear previous approved/rejected to allow resubmit
        await db.delete(existing_req)

    new_request = ContributorRequest(
        community_id=community_id,
        user_id=current_user.id,
        request_type=request_in.request_type,
        status="pending"
    )
    db.add(new_request)
    await db.commit()
    await db.refresh(new_request)
    
    # Load user relation
    stmt = (
        select(ContributorRequest)
        .where(ContributorRequest.id == new_request.id)
        .options(selectinload(ContributorRequest.user))
    )
    res = await db.execute(stmt)
    return res.scalar_one()

@router.get("/{community_id}/requests", response_model=List[ContributorRequestResponse])
async def list_contributor_requests(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify Host/Admin permissions
    is_authorized = await check_is_host_or_admin(community_id, current_user.id, db)
    if not is_authorized:
         raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only group Hosts or Admins can view requests."
        )

    stmt = (
        select(ContributorRequest)
        .where(
            ContributorRequest.community_id == community_id,
            ContributorRequest.status == "pending"
        )
        .options(selectinload(ContributorRequest.user))
        .order_by(ContributorRequest.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/{community_id}/requests/{request_id}/review")
async def review_contributor_request(
    community_id: UUID,
    request_id: UUID,
    review: ContributorRequestReview,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify Host/Admin permissions
    is_authorized = await check_is_host_or_admin(community_id, current_user.id, db)
    if not is_authorized:
         raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only group Hosts or Admins can review requests."
        )

    # Fetch request
    req_stmt = select(ContributorRequest).where(
        ContributorRequest.id == request_id,
        ContributorRequest.community_id == community_id
    )
    req_res = await db.execute(req_stmt)
    req_rec = req_res.scalar_one_or_none()
    if not req_rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Request not found."
        )

    req_rec.status = review.status

    if review.status == "approved":
        # Check if they have existing role
        role_stmt = select(CommunityRole).where(
            CommunityRole.community_id == community_id,
            CommunityRole.user_id == req_rec.user_id
        )
        role_res = await db.execute(role_stmt)
        role_rec_db = role_res.scalar_one_or_none()
        
        # Target role based on request_type
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
                role_rec_db.role = target_role
        else:
            new_role = CommunityRole(
                community_id=community_id,
                user_id=req_rec.user_id,
                role=target_role
            )
            db.add(new_role)

    await db.commit()
    return {"message": f"Request has been successfully {review.status}."}

# --- Host / Admin Member Administration APIs ---

@router.put("/{community_id}/members/{user_id}/role")
async def update_member_role(
    community_id: UUID,
    user_id: UUID,
    role_update: MemberRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify only Host can update roles
    stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    res = await db.execute(stmt)
    user_role_rec = res.scalar_one_or_none()
    if not user_role_rec or user_role_rec.role != "host":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only group Hosts can promote members or modify permissions."
        )

    # Check target member role
    t_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == user_id
    )
    t_res = await db.execute(t_stmt)
    target_role_rec = t_res.scalar_one_or_none()
    if not target_role_rec:
        new_role = CommunityRole(
            community_id=community_id,
            user_id=user_id,
            role=role_update.role
        )
        db.add(new_role)
    else:
        if target_role_rec.role == "host":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Host role cannot be modified."
            )
        target_role_rec.role = role_update.role
        
    await db.commit()
    return {"message": "User role/permission successfully updated."}

@router.delete("/{community_id}/members/{user_id}")
async def remove_member(
    community_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify only Host can evict members
    stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    res = await db.execute(stmt)
    user_role_rec = res.scalar_one_or_none()
    if not user_role_rec or user_role_rec.role != "host":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only group Hosts can remove members."
        )

    # Check target member role
    t_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == user_id
    )
    t_res = await db.execute(t_stmt)
    target_role_rec = t_res.scalar_one_or_none()
    if not target_role_rec:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found in community roles."
        )
        
    if target_role_rec.role == "host":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Host cannot be removed."
        )
        
    await db.delete(target_role_rec)
    
    # Also delete pending requests
    req_stmt = select(ContributorRequest).where(
        ContributorRequest.community_id == community_id,
        ContributorRequest.user_id == user_id
    )
    req_res = await db.execute(req_stmt)
    for req in req_res.scalars().all():
        await db.delete(req)
        
    await db.commit()
    return {"message": "Member successfully removed from the group."}

# --- User Search & Realtime Invitations Endpoints ---

@router.get("/search-users")
async def search_users(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Strip leading @ if present
    search_query = q.lstrip("@").strip()
    if not search_query:
        return []
        
    stmt = (
        select(User)
        .where(
            (User.username.ilike(f"%{search_query}%")) | 
            (User.email.ilike(f"%{search_query}%")) |
            (User.full_name.ilike(f"%{search_query}%"))
        )
        .limit(10)
    )
    result = await db.execute(stmt)
    users = result.scalars().all()
    
    return [
        {
            "id": str(u.id),
            "username": u.username,
            "full_name": u.full_name,
            "email": u.email,
            "avatar_url": u.avatar_url
        }
        for u in users
    ]

@router.post("/{community_id}/invitations", status_code=status.HTTP_201_CREATED)
async def invite_user(
    community_id: UUID,
    invite_in: InvitationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify current user is Host/Admin of community
    is_authorized = await check_is_host_or_admin(community_id, current_user.id, db)
    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only group Hosts or Admins can invite members."
        )

    # Find the target user (handle both with and without leading @ since db usernames start with @)
    input_username = invite_in.invitee_username.strip()
    username_variants = [input_username]
    if input_username.startswith("@"):
        username_variants.append(input_username[1:])
    else:
        username_variants.append(f"@{input_username}")
        
    user_stmt = select(User).where(User.username.in_(username_variants))
    user_res = await db.execute(user_stmt)
    invitee = user_res.scalar_one_or_none()
    if not invitee:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No user found with username {input_username}."
        )

    # Check if already has a role
    role_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == invitee.id
    )
    role_res = await db.execute(role_stmt)
    if role_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This user already possesses group workspace privileges."
        )

    # Check if invitation already exists
    inv_stmt = select(Invitation).where(
        Invitation.community_id == community_id,
        Invitation.invitee_id == invitee.id
    )
    inv_res = await db.execute(inv_stmt)
    existing_inv = inv_res.scalar_one_or_none()
    if existing_inv:
        if existing_inv.status == "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An invitation is already pending for this user."
            )
        await db.delete(existing_inv)

    new_invite = Invitation(
        community_id=community_id,
        inviter_id=current_user.id,
        invitee_id=invitee.id,
        status="pending"
    )
    db.add(new_invite)
    await db.commit()
    await db.refresh(new_invite)
    
    return {"message": f"Invitation successfully sent to @{invitee.username}.", "invitation_id": str(new_invite.id)}

@router.get("/{community_id}/invitations")
async def list_community_invitations(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify current user is Host/Admin
    is_authorized = await check_is_host_or_admin(community_id, current_user.id, db)
    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only group Hosts or Admins can view invitations."
        )

    stmt = select(Invitation).where(Invitation.community_id == community_id).order_by(Invitation.created_at.desc())
    res = await db.execute(stmt)
    invites = res.scalars().all()
    
    # Enrich with invitee information
    enriched = []
    for inv in invites:
        u_stmt = select(User).where(User.id == inv.invitee_id)
        u_res = await db.execute(u_stmt)
        u = u_res.scalar_one_or_none()
        enriched.append({
            "id": str(inv.id),
            "status": inv.status,
            "created_at": inv.created_at.isoformat(),
            "invitee": {
                "id": str(u.id) if u else "",
                "username": u.username if u else "",
                "full_name": u.full_name if u else ""
            }
        })
    return enriched

@router.post("/invitations/{invitation_id}/respond")
async def respond_to_invitation(
    invitation_id: UUID,
    payload: dict, # {"response": "accepted" | "rejected"}
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Invitation).where(Invitation.id == invitation_id)
    res = await db.execute(stmt)
    inv = res.scalar_one_or_none()
    if not inv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invitation not found."
        )

    if inv.invitee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Unauthorized: This invitation is not directed to you."
        )

    response_status = payload.get("response")
    if response_status not in ("accepted", "rejected"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid response. Must be 'accepted' or 'rejected'."
        )

    inv.status = response_status
    
    if response_status == "accepted":
        # Add to community roles as 'gallery_access' so they can browse private memories!
        role_stmt = select(CommunityRole).where(
            CommunityRole.community_id == inv.community_id,
            CommunityRole.user_id == current_user.id
        )
        role_res = await db.execute(role_stmt)
        if not role_res.scalar_one_or_none():
            new_role = CommunityRole(
                community_id=inv.community_id,
                user_id=current_user.id,
                role="gallery_access"
            )
            db.add(new_role)

    await db.commit()
    return {"message": f"Invitation successfully {response_status}."}

@router.put("/{community_id}/banner")
async def update_community_banner(
    community_id: UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Allows group Hosts or Admins to update community banner URL at any time."""
    is_authorized = await check_is_host_or_admin(community_id, current_user.id, db)
    if not is_authorized:
         raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only group Hosts or Admins can update community settings."
        )

    result = await db.execute(select(Community).where(Community.id == community_id))
    community = result.scalar_one_or_none()
    if not community:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Community not found"
        )

    banner_url = payload.get("banner_url")
    community.banner_url = banner_url
    await db.commit()
    await db.refresh(community)
    return community

# --- Community Star / Favorite Endpoints ---

@router.post("/{community_id}/star")
async def toggle_community_star(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggle star for current user on a community. If already starred, remove. If not, add."""
    # Verify community exists
    comm_res = await db.execute(select(Community).where(Community.id == community_id))
    if not comm_res.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Community not found."
        )

    # Check if already starred
    star_stmt = select(CommunityStar).where(
        CommunityStar.community_id == community_id,
        CommunityStar.user_id == current_user.id
    )
    star_res = await db.execute(star_stmt)
    existing_star = star_res.scalar_one_or_none()

    if existing_star:
        await db.delete(existing_star)
        await db.commit()
        return {"starred": False}
    else:
        new_star = CommunityStar(
            community_id=community_id,
            user_id=current_user.id
        )
        db.add(new_star)
        await db.commit()
        return {"starred": True}


@router.delete("/{community_id}", status_code=status.HTTP_200_OK)
async def delete_community(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a community group workspace. Host only."""
    # Verify current user is Host of community
    stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id,
        CommunityRole.role == "host"
    )
    res = await db.execute(stmt)
    host_role = res.scalar_one_or_none()
    if not host_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only group Hosts can delete this workspace."
        )

    # Fetch the community to delete
    comm_stmt = select(Community).where(Community.id == community_id)
    comm_res = await db.execute(comm_stmt)
    community = comm_res.scalar_one_or_none()
    if not community:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Community workspace not found."
        )

    await db.delete(community)
    await db.commit()
    return {"message": "Community workspace group successfully deleted."}
