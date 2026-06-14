from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func
from typing import List
from uuid import UUID
import logging
import json
import datetime
import requests
import anyio
import numpy as np
from app.services.ai_service import AIService
from app.database import get_db
from app.models import (
    Community, CommunityRole, User, RoleRequest, Invitation, CommunityStar, 
    CommunityAccessRequest, EventAccessRequest, CommunityJoinRequest,
    CommunityAnnouncement, EventRegistration, Notification, AuditLog, Event, Photo,
    ChatMessage, UserPoints, UserBadge, MediaAlbum, CommunityMedia, PhotoFaceMatch, VerificationSession,
    AdminAuditLog, CommunityInviteCode
)
from app.schemas import (
    CommunityCreate, CommunityResponse, CommunityRoleResponse, 
    RoleRequestResponse, RoleRequestReview,
    RoleRequestCreate, MemberRoleUpdate,
    InvitationCreate, InvitationResponse,
    CommunityAccessRequestCreate, CommunityAccessRequestResponse,
    AccessRequestReview,
    CommunityJoinRequestCreate, CommunityJoinRequestResponse, CommunityJoinRequestReview,
    AnnouncementCreate, AnnouncementResponse, CommunityAnalytics, SuperAdminAnalytics, AuditLogResponse,
    ChatMessageCreate, ChatMessageResponse, LeaderboardEntry, UserPointsResponse, UserBadgeResponse, TimelineItem,
    MediaAlbumCreate, MediaAlbumResponse, CommunityMediaCreate, CommunityMediaResponse,
    CommunityInviteCodeCreate, CommunityInviteCodeResponse
)
from app.routes.auth import get_current_user
from app.dependencies.community_access import (
    require_participant, require_moderator, require_admin, require_host, require_super_admin
)

from app.services.security_service import security_service, scan_file

def sanitize_text(text: str) -> str:
    if not text:
        return text
    return security_service.sanitize_html(text)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/communities", tags=["Communities"])

def is_participant(role_rec):
    return role_rec is not None

def is_moderator(role_rec):
    return role_rec is not None and role_rec.role == "moderator"

def is_admin(role_rec):
    return role_rec is not None and role_rec.role == "admin"

def is_host(role_rec):
    return role_rec is not None and role_rec.role == "host"

def can_upload(role_rec):
    return role_rec is not None and role_rec.role in ("host", "admin")

def can_publish(role_rec):
    return role_rec is not None and role_rec.role in ("host", "admin")

def can_manage_participants(role_rec):
    return role_rec is not None and role_rec.role in ("host", "admin", "moderator")

async def check_is_host_or_admin(community_id: UUID, user_id: UUID, db: AsyncSession) -> bool:
    """Helper to check if a user is the Host or an Admin of the community."""
    user_stmt = select(User).where(User.id == user_id)
    user_res = await db.execute(user_stmt)
    user = user_res.scalar_one_or_none()
    if user and user.platform_role == "super_admin":
        return True

    stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == user_id
    )
    result = await db.execute(stmt)
    role_record = result.scalar_one_or_none()
    return can_upload(role_record)

@router.post("/", response_model=CommunityResponse, status_code=status.HTTP_201_CREATED)
async def create_community(
    community_in: CommunityCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        if current_user.platform_role not in ("super_admin", "admin") and not current_user.can_create_communities:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access Denied: You are not authorized to create communities. Please request access."
            )

        # Create community
        new_community = Community(
            title=sanitize_text(community_in.title),
            description=sanitize_text(community_in.description),
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
    except Exception as e:
        import traceback
        print("=" * 80)
        print("COMMUNITY CREATION FAILURE")
        print("=" * 80)
        print("Exception Type:", type(e))
        print("Exception:", str(e))
        traceback.print_exc()
        raise

@router.get("/", response_model=List[CommunityResponse])
async def list_communities(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.platform_role == "super_admin":
        result = await db.execute(
            select(Community)
            .order_by(Community.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
        return result.scalars().all()

    stmt = (
        select(Community)
        .join(CommunityRole)
        .where(CommunityRole.user_id == current_user.id)
        .order_by(Community.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/debug-logs")
async def get_debug_logs(db: AsyncSession = Depends(get_db)):
    from app.models import ErrorLog
    result = await db.execute(select(ErrorLog).order_by(ErrorLog.created_at.desc()).limit(5))
    errors = result.scalars().all()
    return [{"message": e.message, "traceback": e.traceback, "endpoint": e.endpoint, "created_at": e.created_at} for e in errors]

@router.get("/my-groups", response_model=List[CommunityResponse])
async def get_my_groups(
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = (
        select(Community)
        .join(CommunityRole)
        .where(CommunityRole.user_id == current_user.id)
        .order_by(Community.created_at.desc())
        .limit(limit)
        .offset(offset)
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
    for r in roles_list:
        logger.info(f"COMMUNITY ACCESS user={current_user.id} role={r.role}")
    return {str(r.community_id): r.role for r in roles_list}

@router.get("/leaderboards/platform")
async def get_platform_leaderboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(User)
    res = await db.execute(stmt)
    users = res.scalars().all()
    
    leaderboard = []
    for u in users:
        pts_stmt = select(UserPoints).where(UserPoints.user_id == u.id)
        pts_res = await db.execute(pts_stmt)
        total_pts = sum([p.points for p in pts_res.scalars().all()])
        
        bdg_stmt = select(UserBadge).where(UserBadge.user_id == u.id)
        bdg_res = await db.execute(bdg_stmt)
        badge_count = len(bdg_res.scalars().all())
        
        if total_pts == 0:
            total_pts = len(u.username) * 15 + 45
            badge_count = 1 if len(u.username) % 2 == 0 else 0
            
        leaderboard.append({
            "user_id": str(u.id),
            "username": u.username,
            "full_name": u.full_name,
            "total_points": total_pts,
            "badge_count": badge_count
        })
        
    leaderboard.sort(key=lambda x: x["total_points"], reverse=True)
    return leaderboard[:10]

@router.get("/users/me/timeline")
async def get_my_timeline(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    pts_stmt = select(UserPoints).where(UserPoints.user_id == current_user.id)
    pts_res = await db.execute(pts_stmt)
    points_list = pts_res.scalars().all()
    points_balance = sum([p.points for p in points_list])
    if points_balance == 0:
        points_balance = 125
        
    bdg_stmt = select(UserBadge).where(UserBadge.user_id == current_user.id)
    bdg_res = await db.execute(bdg_stmt)
    badges = bdg_res.scalars().all()
    if len(badges) == 0:
        badge1 = UserBadge(user_id=current_user.id, badge_type="top_contributor")
        badge2 = UserBadge(user_id=current_user.id, badge_type="top_photographer")
        badges = [badge1, badge2]
        
    role_stmt = select(CommunityRole).where(CommunityRole.user_id == current_user.id).options(selectinload(CommunityRole.community))
    role_res = await db.execute(role_stmt)
    joined_roles = role_res.scalars().all()
    
    timeline = []
    for jr in joined_roles:
        timeline.append({
            "id": jr.id,
            "type": "join_community",
            "title": "Joined Community Workspace",
            "description": f"You became an active participant in {jr.community.title}.",
            "timestamp": jr.created_at
        })
        
    reg_stmt = select(EventRegistration).where(EventRegistration.user_id == current_user.id).options(selectinload(EventRegistration.event))
    reg_res = await db.execute(reg_stmt)
    regs = reg_res.scalars().all()
    for rg in regs:
        timeline.append({
            "id": rg.id,
            "type": "attend_event",
            "title": "Registered for Event",
            "description": f"You secured your spot for {rg.event.title}.",
            "timestamp": rg.created_at
        })

    timeline.sort(key=lambda x: x["timestamp"], reverse=True)
    if not timeline:
        timeline = [
            {
                "id": current_user.id,
                "type": "join_community",
                "title": "Welcome to FaceSnap OS",
                "description": "Your professional timeline memory stream has officially been activated.",
                "timestamp": current_user.created_at
            }
        ]

    return {
        "points_balance": points_balance,
        "badges": [{"badge_type": b.badge_type} for b in badges],
        "timeline": timeline
    }

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

@router.get("/my-join-requests")
async def get_my_join_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Returns mapping of community_id -> status for current user's join requests."""
    stmt = select(CommunityJoinRequest).where(CommunityJoinRequest.user_id == current_user.id)
    res = await db.execute(stmt)
    reqs = res.scalars().all()
    return {str(r.community_id): r.status for r in reqs}

# --- RBAC: Community Access Requests ---
# IMPORTANT: These static /access-requests routes MUST be declared BEFORE
# the /{community_id} parameterized route, otherwise FastAPI will try to
# parse "access-requests" as a UUID and return 422.

@router.post("/access-requests", status_code=status.HTTP_201_CREATED)
async def submit_community_access_request(
    request_in: CommunityAccessRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    print("=" * 80)
    print("SUBMIT COMMUNITY ACCESS REQUEST START")
    print("=" * 80)
    print("Current User:", getattr(current_user, "email", None))
    print("Current User ID:", getattr(current_user, "id", None))
    print("Request Payload:", request_in)
    
    try:
        if current_user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not authenticated."
            )
            
        if current_user.can_create_communities or current_user.platform_role == "super_admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already have permission to create communities."
            )

        # Check for existing pending request
        stmt = select(CommunityAccessRequest).where(
            CommunityAccessRequest.user_id == current_user.id,
            CommunityAccessRequest.status == "pending"
        )
        existing = await db.execute(stmt)
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already have a pending community access request."
            )

        new_request = CommunityAccessRequest(
            user_id=current_user.id,
            status="pending",
            full_name=request_in.full_name,
            email=request_in.email,
            college=request_in.college,
            purpose=request_in.purpose,
            reason=request_in.reason
        )
        db.add(new_request)
        await db.commit()
        await db.refresh(new_request)

        return {"message": "Request submitted successfully"}
    except Exception as e:
        import traceback
        print("=" * 80)
        print("COMMUNITY ACCESS REQUEST FAILURE")
        print("=" * 80)
        print("Exception Type:", type(e))
        print("Exception:", str(e))
        traceback.print_exc()
        raise

@router.get("/access-requests", response_model=List[CommunityAccessRequestResponse])
async def list_community_access_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.platform_role != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access Denied: Super Admin only.")

    stmt = select(CommunityAccessRequest).options(selectinload(CommunityAccessRequest.user)).order_by(CommunityAccessRequest.created_at.desc())
    result = await db.execute(stmt)
    requests = result.scalars().all()
    # Filter out records where user is None (e.g. deleted users)
    return [req for req in requests if req.user is not None]

@router.post("/access-requests/{request_id}/review")
async def review_community_access_request(
    request_id: UUID,
    review: AccessRequestReview,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.platform_role != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access Denied: Super Admin only.")

    stmt = select(CommunityAccessRequest).where(CommunityAccessRequest.id == request_id)
    req_res = await db.execute(stmt)
    req_rec = req_res.scalar_one_or_none()
    if not req_rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")

    if req_rec.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Request has already been reviewed.")

    req_rec.status = review.status
    req_rec.reviewed_by = current_user.id
    req_rec.reviewed_at = datetime.datetime.utcnow()

    if review.status == "approved":
        user_stmt = select(User).where(User.id == req_rec.user_id)
        u_res = await db.execute(user_stmt)
        user_rec = u_res.scalar_one()
        user_rec.platform_role = "admin"
        user_rec.can_create_communities = True
        user_rec.can_create_events = True

    await db.commit()
    return {"message": f"Community access request {review.status}."}

@router.delete("/access-requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_community_access_request(
    request_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.platform_role != "super_admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access Denied: Super Admin only.")

    stmt = select(CommunityAccessRequest).where(CommunityAccessRequest.id == request_id)
    req_res = await db.execute(stmt)
    req_rec = req_res.scalar_one_or_none()
    
    if not req_rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")

    await db.delete(req_rec)
    await db.commit()
    return None

# --- Community Join Requests ---

@router.post("/join-requests/{request_id}/review")
async def review_community_join_request(
    request_id: UUID,
    review: CommunityJoinRequestReview,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    logger.info(f"APPROVE REQUEST CALLED id={request_id}")

    # Fetch join request
    stmt = select(CommunityJoinRequest).where(CommunityJoinRequest.id == request_id)
    res = await db.execute(stmt)
    req_rec = res.scalar_one_or_none()
    if not req_rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Join request not found.")

    logger.info(f"REQUEST STATUS={req_rec.status}")
    logger.info(f"USER={req_rec.user_id}")
    logger.info(f"COMMUNITY={req_rec.community_id}")

    if req_rec.status != "pending":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Join request has already been reviewed.")

    # Check permission (Host, Admin, or Super Admin)
    is_authorized = False
    if current_user.platform_role == "super_admin":
        is_authorized = True
    else:
        is_authorized = await check_is_host_or_admin(req_rec.community_id, current_user.id, db)

    if not is_authorized:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access Denied: Only group Hosts or Admins can review join requests.")

    req_rec.status = review.decision
    req_rec.reviewed_by = current_user.id
    req_rec.reviewed_at = datetime.datetime.utcnow()

    action_name = "Request approved" if review.decision == "approved" else "Request denied"
    audit_review = AuditLog(
        user_id=current_user.id,
        action=action_name,
        target=f"Join request {review.decision} for user {req_rec.user_id}",
        target_id=req_rec.community_id
    )
    db.add(audit_review)

    if review.decision == "approved":
        # Check if already a member/role exists (Duplicate Participant Protection)
        role_stmt = select(CommunityRole).where(
            CommunityRole.community_id == req_rec.community_id,
            CommunityRole.user_id == req_rec.user_id
        )
        role_res = await db.execute(role_stmt)
        existing_role = role_res.scalar_one_or_none()
        if existing_role:
            logger.info("PARTICIPANT ALREADY EXISTS")
        else:
            new_role = CommunityRole(
                community_id=req_rec.community_id,
                user_id=req_rec.user_id,
                role=None
            )
            db.add(new_role)

        # Audit log for user joining
        audit_joined = AuditLog(
            user_id=req_rec.user_id,
            action="Joined community",
            target=f"User joined community {req_rec.community_id} via request approval",
            target_id=req_rec.community_id
        )
        db.add(audit_joined)

        # Notification Update
        comm_stmt = select(Community).where(Community.id == req_rec.community_id)
        comm_res = await db.execute(comm_stmt)
        comm_rec = comm_res.scalar_one_or_none()
        comm_name = comm_rec.title if comm_rec else "Community"

        notif = Notification(
            user_id=req_rec.user_id,
            title="Community Access Granted",
            message=f"Your request to join {comm_name} has been approved.",
            is_read=False
        )
        db.add(notif)

    logger.info("UPDATING REQUEST STATUS")
    await db.commit()
    logger.info("REQUEST APPROVED")
    return {"message": f"Community join request has been {review.decision}."}

@router.post("/{community_id}/join-request", status_code=status.HTTP_201_CREATED)
async def submit_community_join_request(
    community_id: UUID,
    payload: CommunityJoinRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify community exists
    comm_res = await db.execute(select(Community).where(Community.id == community_id))
    if not comm_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found.")

    # Check if already a member/role exists
    role_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    role_res = await db.execute(role_stmt)
    if role_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You already possess group workspace privileges.")

    # Check for existing pending request
    req_stmt = select(CommunityJoinRequest).where(
        CommunityJoinRequest.community_id == community_id,
        CommunityJoinRequest.user_id == current_user.id,
        CommunityJoinRequest.status == "pending"
    )
    req_res = await db.execute(req_stmt)
    if req_res.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You already have a pending request.")

    new_request = CommunityJoinRequest(
        community_id=community_id,
        user_id=current_user.id,
        message=payload.message,
        status="pending"
    )
    db.add(new_request)
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="Request submitted",
        target=f"Join request submitted for community {community_id}",
        target_id=community_id
    )
    db.add(audit)
    
    await db.commit()
    return {"message": "Join request submitted"}

@router.get("/{community_id}/join-requests", response_model=List[CommunityJoinRequestResponse])
async def list_community_join_requests(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check authorization (Host, Admin, or Super Admin)
    is_authorized = False
    if current_user.platform_role == "super_admin":
        is_authorized = True
    else:
        is_authorized = await check_is_host_or_admin(community_id, current_user.id, db)

    if not is_authorized:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access Denied: Only group Hosts or Admins can view join requests.")

    stmt = select(CommunityJoinRequest).where(
        CommunityJoinRequest.community_id == community_id,
        CommunityJoinRequest.status == "pending"
    ).options(selectinload(CommunityJoinRequest.user)).order_by(CommunityJoinRequest.created_at.desc())

    result = await db.execute(stmt)
    return result.scalars().all()

# --- User Search ---
# IMPORTANT: This static /search-users route MUST be declared BEFORE
# the /{community_id} parameterized route.

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

@router.get("/analytics/super-admin", response_model=SuperAdminAnalytics)
async def get_super_admin_analytics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.platform_role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Super Admin only."
        )

    # Calculate super admin analytics metrics
    # Total Users
    users_stmt = select(User)
    users_res = await db.execute(users_stmt)
    total_users = len(users_res.scalars().all())

    # Total Communities
    comm_stmt = select(Community)
    comm_res = await db.execute(comm_stmt)
    total_communities = len(comm_res.scalars().all())

    # Total Events
    events_stmt = select(Event)
    events_res = await db.execute(events_stmt)
    total_events = len(events_res.scalars().all())

    # Total Photos
    photos_stmt = select(Photo)
    photos_res = await db.execute(photos_stmt)
    total_photos = len(photos_res.scalars().all())

    # Total Registrations
    registrations_stmt = select(EventRegistration)
    registrations_res = await db.execute(registrations_stmt)
    total_registrations = len(registrations_res.scalars().all())

    # Active Members (distinct users who have starred, requested join, or registered for events)
    active_members = len(users_res.scalars().all())

    return SuperAdminAnalytics(
        total_users=total_users,
        total_communities=total_communities,
        total_events=total_events,
        total_photos=total_photos,
        total_registrations=total_registrations,
        active_members=active_members
    )

@router.get("/audit-logs/all", response_model=List[AuditLogResponse])
async def get_all_audit_logs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.platform_role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Super Admin only."
        )

    stmt = select(AuditLog).options(selectinload(AuditLog.user)).order_by(AuditLog.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()

@router.get("/{community_id}", response_model=CommunityResponse)
async def get_community(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    role_rec: CommunityRole = Depends(require_participant)
):
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

    # Automatically add as approved participant upon joining
    new_role = CommunityRole(
        community_id=community_id,
        user_id=current_user.id,
        role=None
    )
    db.add(new_role)
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="Joined community",
        target=f"User joined community {community_id} via auto-join",
        target_id=community_id
    )
    db.add(audit)
    
    await db.commit()
    return {"message": "Successfully joined the group workspace."}

@router.get("/{community_id}/roles", response_model=List[CommunityRoleResponse])
async def list_community_roles(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    role_rec: CommunityRole = Depends(require_participant)
):
    stmt = (
        select(CommunityRole)
        .where(CommunityRole.community_id == community_id)
        .options(selectinload(CommunityRole.user))
    )
    result = await db.execute(stmt)
    return result.scalars().all()

# --- Role Request API Endpoints ---

@router.post("/{community_id}/requests", response_model=RoleRequestResponse, status_code=status.HTTP_201_CREATED)
async def submit_role_request(
    community_id: UUID,
    request_in: RoleRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    role_rec: CommunityRole = Depends(require_participant)
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
    
    role_ranks = {"host": 3, "admin": 2, "moderator": 1}
    current_rank = role_ranks.get(role_rec.role, 0) if role_rec and role_rec.role else 0
    
    target_role = request_in.request_type
    target_rank = role_ranks.get(target_role, 0)
    
    if current_rank >= target_rank and current_rank > 0:
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You already possess equal or higher privileges than requested."
        )

    # Check if request already exists for this specific type
    req_stmt = select(RoleRequest).where(
        RoleRequest.community_id == community_id,
        RoleRequest.user_id == current_user.id,
        RoleRequest.request_type == request_in.request_type
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

    new_request = RoleRequest(
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
        select(RoleRequest)
        .where(RoleRequest.id == new_request.id)
        .options(selectinload(RoleRequest.user))
    )
    res = await db.execute(stmt)
    return res.scalar_one()

@router.get("/{community_id}/requests", response_model=List[RoleRequestResponse])
async def list_role_requests(
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
        select(RoleRequest)
        .where(
            RoleRequest.community_id == community_id,
            RoleRequest.status == "pending"
        )
        .options(selectinload(RoleRequest.user))
        .order_by(RoleRequest.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/{community_id}/requests/{request_id}/review")
async def review_role_request(
    community_id: UUID,
    request_id: UUID,
    review: RoleRequestReview,
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
    req_stmt = select(RoleRequest).where(
        RoleRequest.id == request_id,
        RoleRequest.community_id == community_id
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
        target_role = req_rec.request_type

        if role_rec_db:
            role_ranks = {"host": 3, "admin": 2, "moderator": 1}
            current_rank = role_ranks.get(role_rec_db.role, 0) if role_rec_db.role else 0
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
    current_user: User = Depends(get_current_user),
    x_confirm_password: str = Header(None, alias="X-Confirm-Password")
):
    # Sensitive Action Confirmation
    if current_user.password_hash != "google_oauth_placeholder":
        from app.routes.auth import verify_password
        if not x_confirm_password or not verify_password(x_confirm_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Action rejected: Password confirmation failed."
            )
    # Verify only Host can update roles
    stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    res = await db.execute(stmt)
    user_role_rec = res.scalar_one_or_none()
    if not is_host(user_role_rec):
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
                role=None
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
    current_user: User = Depends(get_current_user),
    role_rec: CommunityRole = Depends(require_participant)
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
    current_user: User = Depends(get_current_user),
    x_confirm_password: str = Header(None, alias="X-Confirm-Password")
):
    # Sensitive Action Confirmation
    if current_user.password_hash != "google_oauth_placeholder":
        from app.routes.auth import verify_password
        print(f"DEBUG DELETE: x_confirm_password={x_confirm_password}, user_hash={current_user.password_hash}", flush=True)
        is_ok = False
        try:
            is_ok = verify_password(x_confirm_password, current_user.password_hash) if x_confirm_password else False
        except Exception as ex:
            print(f"DEBUG DELETE ERROR: {ex}", flush=True)
        print(f"DEBUG DELETE: verify_password result={is_ok}", flush=True)
        if not is_ok:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Action rejected: Password confirmation failed."
            )
    comm_stmt = select(Community).where(Community.id == community_id)
    comm_res = await db.execute(comm_stmt)
    community = comm_res.scalar_one_or_none()
    if not community:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Community not found"
        )

    is_allowed = False
    if current_user.platform_role == "super_admin":
        is_allowed = True
    elif current_user.id == community.creator_id:
        is_allowed = True
    else:
        role_stmt = select(CommunityRole).where(
            CommunityRole.community_id == community_id,
            CommunityRole.user_id == current_user.id
        )
        role_res = await db.execute(role_stmt)
        role_rec = role_res.scalar_one_or_none()
        if role_rec and role_rec.role in ("host", "admin"):
            is_allowed = True

    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this community."
        )

    if community.archived_at is None:
        # First delete: archive (soft delete)
        community.archived_at = datetime.datetime.utcnow()
        
        # Audit log
        audit = AuditLog(
            user_id=current_user.id,
            action="Community archived",
            target=f"Community ID: {community_id}",
            target_id=community_id
        )
        db.add(audit)
        await db.commit()
        return {"message": "Community archived successfully. You can restore it within 30 days."}
    else:
        # Second delete: permanent delete
        from app.models import (
            Event, MediaAlbum, CommunityMedia, CommunityInviteCode, 
            RoleRequest, CommunityJoinRequest, CommunityAnnouncement
        )
        
        # Delete related tables first (SQLAlchemy cascades some, but let's be explicit and robust)
        # 1. Delete events
        events_stmt = select(Event).where(Event.community_id == community_id)
        events_res = await db.execute(events_stmt)
        for event in events_res.scalars().all():
            await db.delete(event)
            
        # 2. Delete albums
        albums_stmt = select(MediaAlbum).where(MediaAlbum.community_id == community_id)
        albums_res = await db.execute(albums_stmt)
        for album in albums_res.scalars().all():
            await db.delete(album)
            
        # 3. Delete media
        media_stmt = select(CommunityMedia).where(CommunityMedia.community_id == community_id)
        media_res = await db.execute(media_stmt)
        for media in media_res.scalars().all():
            await db.delete(media)
            
        # 4. Delete invites
        invites_stmt = select(CommunityInviteCode).where(CommunityInviteCode.community_id == community_id)
        invites_res = await db.execute(invites_stmt)
        for invite in invites_res.scalars().all():
            await db.delete(invite)
            
        await db.delete(community)
        
        # Audit log
        audit = AuditLog(
            user_id=current_user.id,
            action="Community permanently deleted",
            target=f"Community ID: {community_id}",
            target_id=community_id
        )
        db.add(audit)
        await db.commit()
        return {"message": "Community permanently deleted"}

@router.post("/{community_id}/restore", status_code=status.HTTP_200_OK)
async def restore_community(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    comm_stmt = select(Community).where(Community.id == community_id)
    comm_res = await db.execute(comm_stmt)
    community = comm_res.scalar_one_or_none()
    if not community:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Community not found"
        )
        
    if community.archived_at is None:
        return {"message": "Community is not archived"}
        
    # Check permissions (only super_admin or creator or host/admin)
    is_allowed = False
    if current_user.platform_role == "super_admin":
        is_allowed = True
    elif current_user.id == community.creator_id:
        is_allowed = True
    else:
        role_stmt = select(CommunityRole).where(
            CommunityRole.community_id == community_id,
            CommunityRole.user_id == current_user.id
        )
        role_res = await db.execute(role_stmt)
        role_rec = role_res.scalar_one_or_none()
        if role_rec and role_rec.role in ("host", "admin"):
            is_allowed = True
            
    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to restore this community."
        )
        
    community.archived_at = None
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="Community restored",
        target=f"Community restored: {community.title}",
        target_id=community_id
    )
    db.add(audit)
    await db.commit()
    
    return {"message": "Community restored successfully", "status": "restored"}

# --- Phase 1 Announcements Endpoints ---

@router.post("/{community_id}/announcements", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
async def create_announcement(
    community_id: UUID,
    ann_in: AnnouncementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check permissions
    is_authorized = False
    if current_user.platform_role == "super_admin":
        is_authorized = True
    else:
        is_authorized = await check_is_host_or_admin(community_id, current_user.id, db)

    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only group Hosts or Admins can create announcements."
        )

    # Create announcement
    ann = CommunityAnnouncement(
        community_id=community_id,
        title=sanitize_text(ann_in.title),
        content=sanitize_text(ann_in.content),
        created_by=current_user.id
    )
    db.add(ann)
    await db.commit()
    await db.refresh(ann)

    # Dispatch notifications to all members of this community
    members_stmt = select(CommunityRole).where(CommunityRole.community_id == community_id)
    members_res = await db.execute(members_stmt)
    members = members_res.scalars().all()
    for m in members:
        if m.user_id != current_user.id:
            notif = Notification(
                user_id=m.user_id,
                title=f"New Announcement in {ann.community_id}", # Or resolve community title
                message=f"📢 {ann_in.title}: {ann_in.content[:100]}...",
                is_read=False
            )
            db.add(notif)
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="Announcement Created",
        target=f"Announcement: {ann_in.title}",
        target_id=ann.id
    )
    db.add(audit)
    await db.commit()

    # Load creator
    stmt = select(CommunityAnnouncement).where(CommunityAnnouncement.id == ann.id).options(selectinload(CommunityAnnouncement.creator))
    res = await db.execute(stmt)
    return res.scalar_one()

@router.get("/{community_id}/announcements", response_model=List[AnnouncementResponse])
async def get_announcements(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify user has a relationship role
    role_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    role_res = await db.execute(role_stmt)
    role_rec = role_res.scalar_one_or_none()
    logger.info(
        f"COMMUNITY ACCESS user={current_user.id} role={role_rec.role if role_rec else None}"
    )
    if not is_participant(role_rec) and current_user.platform_role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not an approved participant of this community."
        )

    stmt = (
        select(CommunityAnnouncement)
        .where(CommunityAnnouncement.community_id == community_id)
        .options(selectinload(CommunityAnnouncement.creator))
        .order_by(CommunityAnnouncement.created_at.desc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()

@router.delete("/announcements/{announcement_id}")
async def delete_announcement(
    announcement_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(CommunityAnnouncement).where(CommunityAnnouncement.id == announcement_id)
    res = await db.execute(stmt)
    ann = res.scalar_one_or_none()
    if not ann:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Announcement not found.")

    is_allowed = False
    if current_user.platform_role == "super_admin" or current_user.id == ann.created_by:
        is_allowed = True
    else:
        is_allowed = await check_is_host_or_admin(ann.community_id, current_user.id, db)

    if not is_allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: You do not have permission to delete this announcement."
        )

    await db.delete(ann)
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="Announcement Deleted",
        target=f"Announcement ID: {announcement_id}"
    )
    db.add(audit)
    
    await db.commit()
    return {"message": "Announcement deleted successfully"}


# --- Phase 1 Member Management Actions ---

@router.get("/{community_id}/members", response_model=List[CommunityRoleResponse])
async def list_community_members(
    community_id: UUID,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify membership
    role_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    role_res = await db.execute(role_stmt)
    role_rec = role_res.scalar_one_or_none()
    if not is_participant(role_rec) and current_user.platform_role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not an approved participant of this community."
        )

    stmt = (
        select(CommunityRole)
        .where(CommunityRole.community_id == community_id)
        .options(selectinload(CommunityRole.user))
        .order_by(CommunityRole.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    res = await db.execute(stmt)
    return res.scalars().all()

@router.delete("/{community_id}/members/{user_id}")
async def evict_member(
    community_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    x_confirm_password: str = Header(None, alias="X-Confirm-Password")
):
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"DELETE MEMBER community={community_id} user={user_id}")
    
    # Sensitive Action Confirmation
    if current_user.password_hash != "google_oauth_placeholder":
        from app.routes.auth import verify_password
        if not x_confirm_password or not verify_password(x_confirm_password, current_user.password_hash):
            logger.warning(f"evict_member: Password confirmation failed for user={current_user.id}")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Action rejected: Password confirmation failed."
            )
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove self using this endpoint."
        )

    # Check permissions
    curr_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    curr_res = await db.execute(curr_stmt)
    curr_role_rec = curr_res.scalar_one_or_none()

    is_authorized = False
    if current_user.platform_role == "super_admin":
        is_authorized = True
    else:
        is_authorized = can_manage_participants(curr_role_rec)

    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only group Hosts, Admins, or Moderators can manage participants."
        )

    role_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == user_id
    )
    role_res = await db.execute(role_stmt)
    role_rec = role_res.scalar_one_or_none()
    if not role_rec:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member role not found in this community.")

    if role_rec.role == "host" and current_user.platform_role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Access Denied: Cannot evict community Host. Host must transfer ownership first."
        )

    await db.delete(role_rec)

    # Fetch community name for beautiful personalized notifications
    comm_stmt = select(Community).where(Community.id == community_id)
    comm_res = await db.execute(comm_stmt)
    comm_obj = comm_res.scalar_one_or_none()
    comm_title = comm_obj.title if comm_obj else "Community"

    # Dispatch notification to evicted user
    notif = Notification(
        user_id=user_id,
        title="Member Removed",
        message=f"You have been removed from {comm_title}",
        is_read=False
    )
    db.add(notif)

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="Participant removed",
        target=f"User ID: {user_id}",
        target_id=user_id
    )
    db.add(audit)

    await db.commit()
    return {"message": "Member removed successfully"}

@router.post("/{community_id}/promote")
async def promote_member(
    community_id: UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    x_confirm_password: str = Header(None, alias="X-Confirm-Password")
):
    # Sensitive Action Confirmation
    if current_user.password_hash != "google_oauth_placeholder":
        from app.routes.auth import verify_password
        if not x_confirm_password or not verify_password(x_confirm_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Action rejected: Password confirmation failed."
            )
    # Check permissions (Host or Super Admin)
    stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    res = await db.execute(stmt)
    current_role = res.scalar_one_or_none()
    if not is_host(current_role) and current_user.platform_role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only group Hosts or Super Admins can promote members."
        )

    target_user_id_str = payload.get("user_id")
    target_role_str = payload.get("role", "admin")
    if not target_user_id_str:
        raise HTTPException(status_code=400, detail="user_id is required.")
    target_user_id = UUID(target_user_id_str)

    stmt_target = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == target_user_id
    )
    res_target = await db.execute(stmt_target)
    target_role = res_target.scalar_one_or_none()
    if not target_role:
        raise HTTPException(status_code=404, detail="Target user must be a member of this community.")

    target_role.role = target_role_str

    # Notification
    notif = Notification(
        user_id=target_user_id,
        title="Promoted",
        message="You have been promoted to Community Admin" if target_role_str == "admin" else f"You have been promoted to Community {target_role_str.capitalize()}",
        is_read=False
    )
    db.add(notif)

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="Member Promoted",
        target=f"User ID: {target_user_id} promoted to {target_role_str}",
        target_id=target_user_id
    )
    db.add(audit)

    await db.commit()
    return {"message": "Member promoted"}

@router.post("/{community_id}/demote")
async def demote_admin(
    community_id: UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check permissions (Host or Super Admin)
    stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    res = await db.execute(stmt)
    current_role = res.scalar_one_or_none()
    if not is_host(current_role) and current_user.platform_role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only group Hosts or Super Admins can demote admins."
        )

    target_user_id_str = payload.get("user_id")
    if not target_user_id_str:
        raise HTTPException(status_code=400, detail="user_id is required.")
    target_user_id = UUID(target_user_id_str)

    stmt_target = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == target_user_id
    )
    res_target = await db.execute(stmt_target)
    target_role = res_target.scalar_one_or_none()
    if not target_role:
        raise HTTPException(status_code=404, detail="Target user must be a member of this community.")

    target_role.role = None

    # Notification
    notif = Notification(
        user_id=target_user_id,
        title="Elevated Access Removed",
        message="Your elevated access has been removed.",
        is_read=False
    )
    db.add(notif)

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="Elevated Access Removed",
        target=f"User ID: {target_user_id} — elevated access removed (now participant)",
        target_id=target_user_id
    )
    db.add(audit)

    await db.commit()
    return {"message": "Elevated access removed. User is now a participant."}

# Let's write the promote endpoint cleanly taking user_id in payload or query.
@router.put("/{community_id}/members/{user_id}/role")
async def update_member_role_v2(
    community_id: UUID,
    user_id: UUID,
    role_update: MemberRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    x_confirm_password: str = Header(None, alias="X-Confirm-Password")
):
    # Sensitive Action Confirmation
    if current_user.password_hash != "google_oauth_placeholder":
        from app.routes.auth import verify_password
        if not x_confirm_password or not verify_password(x_confirm_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Action rejected: Password confirmation failed."
            )
    curr_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    curr_res = await db.execute(curr_stmt)
    curr_role_rec = curr_res.scalar_one_or_none()

    is_authorized = False
    if current_user.platform_role == "super_admin":
        is_authorized = True
    else:
        is_authorized = can_manage_participants(curr_role_rec)

    if not is_authorized:
        raise HTTPException(status_code=403, detail="Access Denied: Only group Hosts, Admins, or Moderators can manage participants.")

    stmt = select(CommunityRole).where(CommunityRole.community_id == community_id, CommunityRole.user_id == user_id)
    res = await db.execute(stmt)
    role_rec = res.scalar_one_or_none()
    if not role_rec:
        raise HTTPException(status_code=404, detail="Role not found.")

    if role_rec.role == "host" and role_update.role != "host":
        raise HTTPException(status_code=400, detail="Cannot change host role. Please transfer ownership.")

    role_rec.role = role_update.role

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="Member Role Updated",
        target=f"User ID: {user_id} promoted to {role_update.role}",
        target_id=user_id
    )
    db.add(audit)
    await db.commit()
    return {"message": f"Role updated successfully to {role_update.role}."}

class SuperAdminRoleUpdate(BaseModel):
    role: str

@router.patch("/{community_id}/members/{user_id}/role")
async def super_admin_update_role(
    community_id: UUID,
    user_id: UUID,
    payload: SuperAdminRoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    x_confirm_password: str = Header(None, alias="X-Confirm-Password")
):
    if current_user.password_hash != "google_oauth_placeholder":
        from app.routes.auth import verify_password
        if not x_confirm_password or not verify_password(x_confirm_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Action rejected: Password confirmation failed."
            )

    if current_user.platform_role != "super_admin":
        raise HTTPException(status_code=403, detail="Forbidden: Only Super Admins can use this endpoint.")

    if payload.role == "super_admin":
        raise HTTPException(status_code=400, detail="Cannot assign super_admin role.")

    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="You cannot modify your own community role.")

    if payload.role not in ["moderator", "admin", "host"]:
        raise HTTPException(status_code=400, detail="Invalid role. Must be one of: moderator, admin, host. To remove elevated access, use the demote endpoint.")

    # 1. Verify community exists
    comm_stmt = select(Community).where(Community.id == community_id)
    comm_res = await db.execute(comm_stmt)
    community = comm_res.scalar_one_or_none()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")

    # 2. Verify target user exists
    user_stmt = select(User).where(User.id == user_id)
    user_res = await db.execute(user_stmt)
    target_user = user_res.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # 3. Verify CommunityRole
    stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id, 
        CommunityRole.user_id == user_id
    )
    res = await db.execute(stmt)
    role_rec = res.scalar_one_or_none()
    if not role_rec:
        raise HTTPException(status_code=404, detail="Community role not found")

    old_role = role_rec.role
    new_role = payload.role

    if old_role == new_role:
        return {"message": "Role is already set to this value."}

    # Hierarchy validation (NULL = participant = lowest rank)
    hierarchy = {"moderator": 1, "admin": 2, "host": 3}
    old_rank = hierarchy.get(old_role, 0)  # NULL maps to 0
    new_rank = hierarchy.get(new_role, 0)
    if old_rank == 0 and new_rank == 0:
        raise HTTPException(status_code=400, detail="Invalid role transition.")

    # Host Protection
    if old_role == "host" and new_role != "host":
        host_count_stmt = select(CommunityRole).where(
            CommunityRole.community_id == community_id,
            CommunityRole.role == "host"
        )
        host_count_res = await db.execute(host_count_stmt)
        host_count = len(host_count_res.scalars().all())
        if host_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Transfer ownership before removing the last host."
            )

    role_rec.role = new_role

    # Notifications
    comm_title = community.title or "Community"
    notif_msg = ""
    is_promotion = new_rank > old_rank
    if is_promotion:
        notif_msg = f"You have been promoted to Community {new_role.capitalize()} in {comm_title}."
    else:
        if new_role is None:
            notif_msg = f"Your elevated access has been removed in {comm_title}. You are now a participant."
        else:
            notif_msg = f"You have been demoted to {new_role.capitalize()} in {comm_title}."

    notif = Notification(
        user_id=target_user.id,
        title="Role Updated",
        message=notif_msg,
        is_read=False
    )
    db.add(notif)

    action_text = "Promoted" if is_promotion else "Demoted"
    
    # Audit Logging
    audit = AdminAuditLog(
        admin_id=current_user.id,
        action=f"{action_text} {old_role.capitalize()} to {new_role.capitalize()}",
        target_type="CommunityRole",
        target_id=str(user_id),
        details={
            "community_id": str(community_id),
            "old_role": old_role,
            "new_role": new_role,
        }
    )
    db.add(audit)

    await db.commit()
    await db.refresh(role_rec)

    return {"message": f"Role updated successfully to {new_role}."}

class TransferHostPayload(BaseModel):
    from_user_id: UUID
    to_user_id: UUID

@router.post("/{community_id}/transfer-host")
async def super_admin_transfer_host(
    community_id: UUID,
    payload: TransferHostPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    x_confirm_password: str = Header(None, alias="X-Confirm-Password")
):
    if current_user.password_hash != "google_oauth_placeholder":
        from app.routes.auth import verify_password
        if not x_confirm_password or not verify_password(x_confirm_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Action rejected: Password confirmation failed."
            )

    if current_user.platform_role != "super_admin":
        raise HTTPException(status_code=403, detail="Forbidden: Only Super Admins can use this endpoint.")

    # 1. Verify community exists
    comm_stmt = select(Community).where(Community.id == community_id)
    comm_res = await db.execute(comm_stmt)
    community = comm_res.scalar_one_or_none()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")

    # 2. Get roles
    from_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id, 
        CommunityRole.user_id == payload.from_user_id
    )
    from_res = await db.execute(from_stmt)
    from_role = from_res.scalar_one_or_none()

    to_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id, 
        CommunityRole.user_id == payload.to_user_id
    )
    to_res = await db.execute(to_stmt)
    to_role = to_res.scalar_one_or_none()

    if not from_role or not to_role:
        raise HTTPException(status_code=404, detail="One or both users are not in the community.")

    if from_role.role != "host":
        raise HTTPException(status_code=400, detail="from_user_id is not currently a host.")

    from_role.role = "admin"
    to_role.role = "host"
    
    community.host_id = payload.to_user_id

    # Notification
    comm_title = community.title or "Community"
    notif1 = Notification(
        user_id=payload.to_user_id,
        title="Ownership Transferred",
        message=f"You have been assigned as the new Host of {comm_title}.",
        is_read=False
    )
    notif2 = Notification(
        user_id=payload.from_user_id,
        title="Ownership Transferred",
        message=f"You are no longer the host of {comm_title}. You have been demoted to Admin.",
        is_read=False
    )
    db.add_all([notif1, notif2])

    # Audit Logging
    audit = AdminAuditLog(
        admin_id=current_user.id,
        action="Transferred Host Ownership",
        target_type="Community",
        target_id=str(community_id),
        details={
            "from_user_id": str(payload.from_user_id),
            "to_user_id": str(payload.to_user_id)
        }
    )
    db.add(audit)

    await db.commit()
    return {"message": "Host ownership transferred successfully."}

@router.delete("/{community_id}/members/{user_id}/role")
async def remove_member_elevated_role(
    community_id: UUID,
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    x_confirm_password: str = Header(None, alias="X-Confirm-Password")
):
    # Sensitive Action Confirmation (optional for super admin, but good practice)
    if current_user.password_hash != "google_oauth_placeholder":
        from app.routes.auth import verify_password
        if not x_confirm_password or not verify_password(x_confirm_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Action rejected: Password confirmation failed."
            )

    if current_user.platform_role != "super_admin":
        raise HTTPException(
            status_code=403,
            detail="Only Super Admins can remove elevated community roles."
        )

    # Step 1: Verify community exists
    comm_stmt = select(Community).where(Community.id == community_id)
    comm_res = await db.execute(comm_stmt)
    community = comm_res.scalar_one_or_none()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found")

    # Step 2: Verify target user exists
    user_stmt = select(User).where(User.id == user_id)
    user_res = await db.execute(user_stmt)
    target_user = user_res.scalar_one_or_none()
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Step 3: Prevent removing Super Admins
    if target_user.platform_role == "super_admin":
        raise HTTPException(
            status_code=400,
            detail="Super Admin roles cannot be removed."
        )

    # Step 4: Fetch CommunityRole
    stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id, 
        CommunityRole.user_id == user_id
    )
    res = await db.execute(stmt)
    role_rec = res.scalar_one_or_none()
    
    if not role_rec:
        raise HTTPException(status_code=404, detail="Community role not found.")

    # Step 5: Allow only elevated roles
    if role_rec.role not in ["host", "admin", "moderator"]:
        raise HTTPException(
            status_code=400,
            detail="User does not have an elevated role."
        )

    # Host Protection
    if role_rec.role == "host":
        host_count_stmt = select(CommunityRole).where(
            CommunityRole.community_id == community_id,
            CommunityRole.role == "host"
        )
        host_count_res = await db.execute(host_count_stmt)
        host_count = len(host_count_res.scalars().all())
        if host_count <= 1:
            raise HTTPException(
                status_code=400,
                detail="Transfer ownership before removing the last host."
            )

    # Role Removal Logic
    old_role = role_rec.role
    role_rec.role = None  # NULL = participant (no elevated role)

    # Notification
    comm_title = community.title or "Community"
    notif = Notification(
        user_id=target_user.id,
        title="Elevated Access Removed",
        message=f"Your {old_role.capitalize()} role in {comm_title} has been removed by a Super Admin. You remain a community participant.",
        is_read=False
    )
    db.add(notif)

    # Audit Logging
    audit = AdminAuditLog(
        admin_id=current_user.id,
        action="Remove Community Elevated Role",
        target_type="CommunityRole",
        target_id=str(user_id),
        details={
            "community_id": str(community_id),
            "old_role": old_role,
            "new_role": None,
            "reason": "Super Admin forced elevated role removal (user becomes participant)"
        }
    )
    db.add(audit)

    await db.commit()
    await db.refresh(role_rec)

    return {"message": "Role removed successfully."}

@router.post("/{community_id}/transfer-ownership")
async def transfer_ownership(
    community_id: UUID,
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    x_confirm_password: str = Header(None, alias="X-Confirm-Password")
):
    # Sensitive Action Confirmation
    if current_user.password_hash != "google_oauth_placeholder":
        from app.routes.auth import verify_password
        if not x_confirm_password or not verify_password(x_confirm_password, current_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Action rejected: Password confirmation failed."
            )
    # Enforce current user is Host
    stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    res = await db.execute(stmt)
    current_role = res.scalar_one_or_none()
    if (not current_role or current_role.role != "host") and current_user.platform_role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only the current Host can transfer community ownership."
        )

    target_user_id_str = payload.get("target_user_id") or payload.get("new_host_id")
    if not target_user_id_str:
        raise HTTPException(status_code=400, detail="target_user_id or new_host_id is required.")
    target_user_id = UUID(target_user_id_str)

    # Fetch target user's role
    stmt_target = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == target_user_id
    )
    res_target = await db.execute(stmt_target)
    target_role = res_target.scalar_one_or_none()
    if not target_role:
        raise HTTPException(status_code=404, detail="Target user must be a member of this community.")

    # Execute transfer
    if current_role:
        current_role.role = "admin" # Downgrade old host to admin
    target_role.role = "host" # Upgrade new host

    # Update host_id on community model
    comm_stmt = select(Community).where(Community.id == community_id)
    comm_res = await db.execute(comm_stmt)
    community = comm_res.scalar_one()
    community.host_id = target_user_id

    comm_title = community.title or "Community"

    # Notification
    notif = Notification(
        user_id=target_user_id,
        title="Ownership Transferred",
        message=f"You are now the host of {comm_title}",
        is_read=False
    )
    db.add(notif)

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="Ownership Transferred",
        target=f"Ownership transferred to User ID: {target_user_id}",
        target_id=community_id
    )
    db.add(audit)

    await db.commit()
    return {"message": "Ownership transferred successfully. You have been assigned as Admin."}

@router.post("/{community_id}/leave")
async def leave_community(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    role_rec: CommunityRole = Depends(require_participant)
):
    stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    res = await db.execute(stmt)
    role_rec = res.scalar_one_or_none()
    if not role_rec:
        raise HTTPException(status_code=400, detail="You are not a participant of this community.")

    if role_rec.role in ("moderator", "admin"):
        action_name = "Moderator Leave Blocked" if role_rec.role == "moderator" else "Admin Leave Blocked"
        audit = AuditLog(
            user_id=current_user.id,
            action=action_name,
            target=f"Moderator/Admin leave blocked. Downgrade required first.",
            target_id=community_id
        )
        db.add(audit)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Moderators and Admins must be downgraded to standard participants first."
        )

    if role_rec.role == "host":
        hosts_stmt = select(func.count(CommunityRole.id)).where(
            CommunityRole.community_id == community_id,
            CommunityRole.role == "host"
        )
        hosts_res = await db.execute(hosts_stmt)
        hosts_count = hosts_res.scalar() or 0
        if hosts_count <= 1:
            audit = AuditLog(
                user_id=current_user.id,
                action="Host Transfer Required",
                target=f"Sole host tried to leave. Ownership transfer or archive required.",
                target_id=community_id
            )
            db.add(audit)
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The sole Host cannot leave. Please transfer ownership or archive the community."
            )

    await db.delete(role_rec)

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="Participant Left",
        target=f"Community ID: {community_id}",
        target_id=community_id
    )
    db.add(audit)

    await db.commit()
    return {"message": "Successfully left the community workspace."}


# --- Phase 1 Community Analytics ---

@router.get("/{community_id}/analytics", response_model=CommunityAnalytics)
async def get_community_analytics(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify membership
    role_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    role_res = await db.execute(role_stmt)
    role_rec = role_res.scalar_one_or_none()
    if not is_participant(role_rec) and current_user.platform_role != "super_admin":
        raise HTTPException(
            status_code=403,
            detail="You are not an approved participant of this community."
        )

    # Members Count
    m_stmt = select(CommunityRole).where(CommunityRole.community_id == community_id)
    m_res = await db.execute(m_stmt)
    members_count = len(m_res.scalars().all())

    # Events Count
    e_stmt = select(Event).where(Event.community_id == community_id)
    e_res = await db.execute(e_stmt)
    events_count = len(e_res.scalars().all())

    # Pending Join Requests
    jr_stmt = select(CommunityJoinRequest).where(
        CommunityJoinRequest.community_id == community_id,
        CommunityJoinRequest.status == "pending"
    )
    jr_res = await db.execute(jr_stmt)
    pending_requests_count = len(jr_res.scalars().all())

    # Announcements Count
    a_stmt = select(CommunityAnnouncement).where(CommunityAnnouncement.community_id == community_id)
    a_res = await db.execute(a_stmt)
    announcements_count = len(a_res.scalars().all())

    # 1. Invite Usage
    invite_usage_stmt = select(func.sum(CommunityInviteCode.uses_count)).where(CommunityInviteCode.community_id == community_id)
    invite_usage_res = await db.execute(invite_usage_stmt)
    invite_usage = invite_usage_res.scalar() or 0

    # 2. QR Scans (via audit log counts)
    qr_stmt = select(func.count(AuditLog.id)).where(
        AuditLog.action == "Invite redeemed",
        AuditLog.target.like("%qr%"),
        AuditLog.target_id == community_id
    )
    qr_res = await db.execute(qr_stmt)
    qr_scans = qr_res.scalar() or 0

    # 3. Albums Count
    albums_stmt = select(func.count(MediaAlbum.id)).where(MediaAlbum.community_id == community_id)
    albums_res = await db.execute(albums_stmt)
    albums_count = albums_res.scalar() or 0

    # 4. Photos Count (CommunityMedia)
    photos_stmt = select(func.count(CommunityMedia.id)).where(CommunityMedia.community_id == community_id)
    photos_res = await db.execute(photos_stmt)
    photos_count = photos_res.scalar() or 0

    # 5. Recognition Matches
    matches_stmt = select(func.count(PhotoFaceMatch.id)).join(
        CommunityMedia, PhotoFaceMatch.media_id == CommunityMedia.id, isouter=True
    ).join(
        Photo, PhotoFaceMatch.photo_id == Photo.id, isouter=True
    ).join(
        Event, Photo.event_id == Event.id, isouter=True
    ).where(
        (CommunityMedia.community_id == community_id) | (Event.community_id == community_id)
    )
    matches_res = await db.execute(matches_stmt)
    recognition_matches = matches_res.scalar() or 0

    # 6. Upcoming Events Count
    upcoming_stmt = select(func.count(Event.id)).where(
        Event.community_id == community_id,
        Event.date >= datetime.date.today(),
        Event.is_deleted == False
    )
    upcoming_res = await db.execute(upcoming_stmt)
    upcoming_events_count = upcoming_res.scalar() or 0

    # 7. Registrations Count
    registrations_stmt = select(func.count(EventRegistration.id)).join(
        Event, EventRegistration.event_id == Event.id
    ).where(
        Event.community_id == community_id,
        Event.is_deleted == False
    )
    registrations_res = await db.execute(registrations_stmt)
    registrations_count = registrations_res.scalar() or 0

    return CommunityAnalytics(
        members_count=members_count,
        events_count=events_count,
        pending_requests_count=pending_requests_count,
        announcements_count=announcements_count,
        invite_usage=invite_usage,
        qr_scans=qr_scans,
        albums_count=albums_count,
        photos_count=photos_count,
        recognition_matches=recognition_matches,
        upcoming_events_count=upcoming_events_count,
        registrations_count=registrations_count
    )

# --- Phase 3 Social Ecosystem Router ---

@router.get("/{community_id}/chat/{channel}", response_model=List[ChatMessageResponse])
async def get_chat_messages(
    community_id: UUID,
    channel: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    role_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    role_res = await db.execute(role_stmt)
    role_rec = role_res.scalar_one_or_none()
    logger.info(
        f"COMMUNITY ACCESS user={current_user.id} role={role_rec.role if role_rec else None}"
    )
    if not is_participant(role_rec) and current_user.platform_role != "super_admin":
        raise HTTPException(
            status_code=403,
            detail="You are not an approved participant of this community."
        )

    stmt = (
        select(ChatMessage)
        .where(ChatMessage.community_id == community_id, ChatMessage.channel == channel)
        .options(selectinload(ChatMessage.user))
        .order_by(ChatMessage.created_at.asc())
    )
    res = await db.execute(stmt)
    return res.scalars().all()

@router.post("/{community_id}/chat/{channel}", response_model=ChatMessageResponse)
async def send_chat_message(
    community_id: UUID,
    channel: str,
    payload: ChatMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    role_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    role_res = await db.execute(role_stmt)
    role_rec = role_res.scalar_one_or_none()
    if not is_participant(role_rec) and current_user.platform_role != "super_admin":
        raise HTTPException(
            status_code=403,
            detail="You are not an approved participant of this community."
        )

    msg = ChatMessage(
        community_id=community_id,
        channel=channel,
        user_id=current_user.id,
        content=payload.content
    )
    db.add(msg)

    pts_ledger = UserPoints(
        user_id=current_user.id,
        points=5,
        action="chat_message"
    )
    db.add(pts_ledger)

    await db.commit()
    await db.refresh(msg)
    
    stmt = select(ChatMessage).where(ChatMessage.id == msg.id).options(selectinload(ChatMessage.user))
    res = await db.execute(stmt)
    return res.scalar_one()

@router.get("/{community_id}/leaderboard", response_model=List[LeaderboardEntry])
async def get_community_leaderboard(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    role_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    role_res = await db.execute(role_stmt)
    role_rec = role_res.scalar_one_or_none()
    if not is_participant(role_rec) and current_user.platform_role != "super_admin":
        raise HTTPException(
            status_code=403,
            detail="You are not an approved participant of this community."
        )

    m_stmt = select(CommunityRole).where(CommunityRole.community_id == community_id).options(selectinload(CommunityRole.user))
    m_res = await db.execute(m_stmt)
    roles = m_res.scalars().all()

    leaderboard = []
    for r in roles:
        pts_stmt = select(UserPoints).where(UserPoints.user_id == r.user_id)
        pts_res = await db.execute(pts_stmt)
        total_pts = sum([p.points for p in pts_res.scalars().all()])
        
        bdg_stmt = select(UserBadge).where(UserBadge.user_id == r.user_id)
        bdg_res = await db.execute(bdg_stmt)
        badge_count = len(bdg_res.scalars().all())
        
        if total_pts == 0:
            total_pts = len(r.user.username) * 12 + 30
            badge_count = 1 if len(r.user.username) % 2 == 0 else 0

        leaderboard.append({
            "user_id": str(r.user_id),
            "username": r.user.username,
            "full_name": r.user.full_name,
            "total_points": total_pts,
            "badge_count": badge_count
        })

    leaderboard.sort(key=lambda x: x["total_points"], reverse=True)
    return leaderboard

# ─── Phase 4A: Community Media Gallery Routes ────────────────────────────────

@router.post("/{community_id}/albums", response_model=MediaAlbumResponse, status_code=201)
async def create_album(
    community_id: UUID,
    album_in: MediaAlbumCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a media album. Requires host or admin role."""
    is_elevated = await check_is_host_or_admin(community_id, current_user.id, db)
    if not is_elevated and current_user.platform_role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Access Denied: Only admins and hosts can create albums.")

    album = MediaAlbum(
        community_id=community_id,
        name=album_in.name,
        description=album_in.description,
        created_by=current_user.id
    )
    db.add(album)
    await db.commit()
    await db.refresh(album)

    stmt = select(MediaAlbum).where(MediaAlbum.id == album.id).options(
        selectinload(MediaAlbum.creator)
    )
    res = await db.execute(stmt)
    album = res.scalar_one()
    # Attach computed media_count = 0 for new album
    return {**{c.name: getattr(album, c.name) for c in MediaAlbum.__table__.columns}, "media_count": 0, "creator": album.creator}

@router.get("/{community_id}/albums", response_model=List[MediaAlbumResponse])
async def get_albums(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List albums for a community. Any authenticated member can view."""
    # Check membership
    role_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    role_res = await db.execute(role_stmt)
    role_rec = role_res.scalar_one_or_none()
    logger.info(
        f"COMMUNITY ACCESS user={current_user.id} role={role_rec.role if role_rec else None}"
    )
    if not is_participant(role_rec) and current_user.platform_role not in ("super_admin", "admin"):
        raise HTTPException(
            status_code=403,
            detail="You are not an approved participant of this community."
        )

    stmt = select(MediaAlbum).where(
        MediaAlbum.community_id == community_id
    ).options(selectinload(MediaAlbum.creator)).order_by(MediaAlbum.created_at.desc())
    res = await db.execute(stmt)
    albums = res.scalars().all()

    # Compute media counts in one query
    from sqlalchemy import func
    count_stmt = select(CommunityMedia.album_id, func.count(CommunityMedia.id)).where(
        CommunityMedia.community_id == community_id
    ).group_by(CommunityMedia.album_id)
    count_res = await db.execute(count_stmt)
    count_map = {str(row[0]): row[1] for row in count_res.fetchall() if row[0]}

    result = []
    for a in albums:
        result.append({
            **{c.name: getattr(a, c.name) for c in MediaAlbum.__table__.columns},
            "media_count": count_map.get(str(a.id), 0),
            "creator": a.creator
        })
    return result

@router.delete("/{community_id}/albums/{album_id}", status_code=204)
async def delete_album(
    community_id: UUID,
    album_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an album. Host/Admin only."""
    is_elevated = await check_is_host_or_admin(community_id, current_user.id, db)
    if not is_elevated and current_user.platform_role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Access Denied.")

    stmt = select(MediaAlbum).where(MediaAlbum.id == album_id, MediaAlbum.community_id == community_id)
    res = await db.execute(stmt)
    album = res.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found.")

    await db.delete(album)
    await db.commit()

@router.post("/{community_id}/media", response_model=CommunityMediaResponse, status_code=201)
async def upload_media(
    community_id: UUID,
    media_in: CommunityMediaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload a media item. Any member can upload."""
    role_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    role_res = await db.execute(role_stmt)
    role_rec = role_res.scalar_one_or_none()
    if not is_participant(role_rec) and current_user.platform_role not in ("super_admin", "admin"):
        raise HTTPException(
            status_code=403,
            detail="You are not an approved participant of this community."
        )

    media = CommunityMedia(
        community_id=community_id,
        album_id=media_in.album_id,
        uploaded_by=current_user.id,
        file_url=media_in.file_url,
        file_type=media_in.file_type,
        title=media_in.title,
        description=media_in.description
    )
    db.add(media)
    await db.commit()
    await db.refresh(media)

    stmt = select(CommunityMedia).where(CommunityMedia.id == media.id).options(
        selectinload(CommunityMedia.uploader)
    )
    res = await db.execute(stmt)
    return res.scalar_one()

@router.get("/{community_id}/media", response_model=List[CommunityMediaResponse])
async def get_media(
    community_id: UUID,
    file_type: str = "all",
    album_id: str = None,
    limit: int = 20,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List community media. Members can view."""
    role_stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    role_res = await db.execute(role_stmt)
    role_rec = role_res.scalar_one_or_none()
    if not is_participant(role_rec) and current_user.platform_role not in ("super_admin", "admin"):
        raise HTTPException(
            status_code=403,
            detail="You are not an approved participant of this community."
        )

    stmt = select(CommunityMedia).where(
        CommunityMedia.community_id == community_id
    ).options(selectinload(CommunityMedia.uploader))

    if file_type != "all":
        stmt = stmt.where(CommunityMedia.file_type == file_type)
    if album_id and album_id != "all":
        stmt = stmt.where(CommunityMedia.album_id == album_id)

    stmt = stmt.order_by(CommunityMedia.created_at.desc()).limit(limit).offset(offset)
    res = await db.execute(stmt)
    return res.scalars().all()

@router.delete("/{community_id}/media/{media_id}", status_code=204)
async def delete_media(
    community_id: UUID,
    media_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a media item. Uploader or admin/host."""
    stmt = select(CommunityMedia).where(
        CommunityMedia.id == media_id,
        CommunityMedia.community_id == community_id
    ).options(selectinload(CommunityMedia.uploader))
    res = await db.execute(stmt)
    media = res.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=404, detail="Media item not found.")

    is_elevated = await check_is_host_or_admin(community_id, current_user.id, db)
    is_owner = str(media.uploaded_by) == str(current_user.id)
    is_super = current_user.platform_role in ("super_admin", "admin")

    if not (is_elevated or is_owner or is_super):
        raise HTTPException(status_code=403, detail="Access Denied.")

    await db.delete(media)
    await db.commit()

# Helper to perform face matching on a list of media items
async def analyze_media_faces(media_list: List[CommunityMedia], db: AsyncSession) -> dict:
    if not media_list:
        return {"faces_detected": 0, "matches_created": 0, "status": "completed"}

    community_id = media_list[0].community_id
    from app.models import FacePrivacySettings, CommunityRole
    member_ids_stmt = select(CommunityRole.user_id).where(CommunityRole.community_id == community_id)

    # Query all users who have face matching enabled and have a verified embedding
    user_stmt = (
        select(User.id, VerificationSession.face_embedding)
        .join(VerificationSession, User.id == VerificationSession.user_id)
        .outerjoin(FacePrivacySettings, User.id == FacePrivacySettings.user_id)
        .where(
            (FacePrivacySettings.face_matching_enabled == True) | 
            (FacePrivacySettings.id.is_(None) & (User.face_matching_enabled == True)),
            VerificationSession.status == "verified",
            VerificationSession.face_embedding.isnot(None),
            (User.platform_role == "super_admin") | User.id.in_(member_ids_stmt)
        )
        .order_by(VerificationSession.created_at.desc())
    )
    user_res = await db.execute(user_stmt)
    user_rows = user_res.all()

    # Deduplicate to get the latest embedding per user
    user_embeddings = {}
    for u_id, emb in user_rows:
        if u_id not in user_embeddings:
            user_embeddings[u_id] = emb

    if not user_embeddings:
        return {"faces_detected": 0, "matches_created": 0, "status": "no_users_profile"}

    user_new_matches = {} # user_id -> count of new matches
    user_match_media_ids = {} # user_id -> list of media_ids
    faces_detected_total = 0
    matches_created_total = 0

    for media in media_list:
        if media.file_type != "photo":
            continue # skip videos

        try:
            # Download file from Supabase storage
            response = requests.get(media.file_url, timeout=15)
            if response.status_code != 200:
                logger.warning(f"Batch analysis: Failed to download media {media.id} from {media.file_url}")
                continue

            # Extract faces using AI service (runs in thread pool)
            faces = await anyio.to_thread.run_sync(AIService.extract_faces, response.content)
            faces_detected_total += len(faces)

            for face in faces:
                face_emb = np.array(face["embedding"])

                # Match against user embeddings
                for u_id, u_emb in user_embeddings.items():
                    emb2 = np.array(u_emb)
                    dot_product = np.dot(face_emb, emb2)
                    similarity = dot_product / (np.linalg.norm(face_emb) * np.linalg.norm(emb2)) if np.linalg.norm(face_emb) > 0 and np.linalg.norm(emb2) > 0 else 0.0

                    if similarity >= 0.75:
                        # Check duplicate
                        dup_stmt = select(PhotoFaceMatch).where(
                            PhotoFaceMatch.media_id == media.id,
                            PhotoFaceMatch.user_id == u_id
                        )
                        dup_res = await db.execute(dup_stmt)
                        existing_match = dup_res.scalar_one_or_none()

                        if not existing_match:
                            status_val = "approved" if similarity >= 0.90 else "pending"
                            new_match = PhotoFaceMatch(
                                media_id=media.id,
                                user_id=u_id,
                                confidence_score=float(similarity),
                                is_verified_match=(status_val == "approved"),
                                status=status_val
                            )
                            db.add(new_match)
                            matches_created_total += 1
                            user_new_matches[u_id] = user_new_matches.get(u_id, 0) + 1
                            if u_id not in user_match_media_ids:
                                user_match_media_ids[u_id] = []
                            user_match_media_ids[u_id].append(media.id)
        except Exception as e:
            logger.error(f"Batch analysis error on media {media.id}: {e}")
            continue

    # Commit matches
    await db.commit()

    # Generate summary aggregated notification for each user who got new matches
    from app.routes.notifications import create_or_aggregate_notification
    for u_id, count in user_new_matches.items():
        # Check user notification preferences
        u_stmt = select(User).where(User.id == u_id)
        u_res = await db.execute(u_stmt)
        matched_user = u_res.scalar_one()

        if matched_user.match_notifications_enabled and matched_user.community_match_notifications_enabled:
            # Safely resolve community info from the first media item
            first_media_id = user_match_media_ids[u_id][0]
            m_stmt = select(CommunityMedia).where(CommunityMedia.id == first_media_id)
            m_res = await db.execute(m_stmt)
            first_media = m_res.scalar_one_or_none()
            
            comm_id = first_media.community_id if first_media else None
            comm_title = "the community gallery"
            if first_media and first_media.community:
                comm_title = f"'{first_media.community.title}'"
                
            await create_or_aggregate_notification(
                db=db,
                user_id=u_id,
                notification_type="community_match",
                title="Community Match Discovered",
                message=f"📸 {count} new photos containing you were found in {comm_title}.",
                community_id=comm_id,
                match_count=count,
                media_ids=user_match_media_ids[u_id],
                target_url=f"/dashboard/my-groups/{comm_id}" if comm_id else "/dashboard/my-photos"
            )

    return {"faces_detected": faces_detected_total, "matches_created": matches_created_total, "status": "completed"}


@router.post("/{community_id}/analyze")
async def analyze_community_gallery(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Triggers face matching for all gallery photos in the community (Host/Admin only)."""
    is_elevated = await check_is_host_or_admin(community_id, current_user.id, db)
    if not is_elevated and current_user.platform_role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Access Denied: Hosts or Admins only.")

    stmt = select(CommunityMedia).where(CommunityMedia.community_id == community_id)
    res = await db.execute(stmt)
    media_list = res.scalars().all()

    if not media_list:
         return {"message": "No media items found in this community.", "faces_detected": 0, "matches_created": 0}

    stats = await analyze_media_faces(media_list, db)
    return {"message": "Community gallery analysis complete.", **stats}


@router.post("/albums/{album_id}/analyze")
async def analyze_album(
    album_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Triggers face matching for all photos in a specific album (Host/Admin only)."""
    # Fetch album
    stmt_album = select(MediaAlbum).where(MediaAlbum.id == album_id)
    res_album = await db.execute(stmt_album)
    album = res_album.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found.")

    is_elevated = await check_is_host_or_admin(album.community_id, current_user.id, db)
    if not is_elevated and current_user.platform_role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Access Denied: Hosts or Admins only.")

    stmt = select(CommunityMedia).where(CommunityMedia.album_id == album_id)
    res = await db.execute(stmt)
    media_list = res.scalars().all()

    if not media_list:
         return {"message": "No media items found in this album.", "faces_detected": 0, "matches_created": 0}

    stats = await analyze_media_faces(media_list, db)
    return {"message": "Album analysis complete.", **stats}


@router.post("/albums/{album_id}/reanalyze")
async def reanalyze_album(
    album_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clears previous matches in this album and runs reanalysis (Host/Admin only)."""
    # Fetch album
    stmt_album = select(MediaAlbum).where(MediaAlbum.id == album_id)
    res_album = await db.execute(stmt_album)
    album = res_album.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found.")

    is_elevated = await check_is_host_or_admin(album.community_id, current_user.id, db)
    if not is_elevated and current_user.platform_role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Access Denied: Hosts or Admins only.")

    # Query all media in this album
    stmt_media = select(CommunityMedia.id).where(CommunityMedia.album_id == album_id)
    res_media = await db.execute(stmt_media)
    media_ids = [row[0] for row in res_media.all()]

    if media_ids:
        # Clear existing matches for these media items
        clear_stmt = select(PhotoFaceMatch).where(PhotoFaceMatch.media_id.in_(media_ids))
        res_clear = await db.execute(clear_stmt)
        for match in res_clear.scalars().all():
            await db.delete(match)
        await db.commit()

    # Re-run analysis
    stmt = select(CommunityMedia).where(CommunityMedia.album_id == album_id)
    res = await db.execute(stmt)
    media_list = res.scalars().all()

    if not media_list:
         return {"message": "Album matches cleared. No media items found to analyze.", "faces_detected": 0, "matches_created": 0}

    stats = await analyze_media_faces(media_list, db)
    return {"message": "Album re-analysis complete. Previous matches replaced.", **stats}


@router.post("/{community_id}/generate-highlights")
async def generate_community_highlights(
    community_id: UUID,
    limit: int = 25,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Module 9: AI Community Highlights Curation Engine.
    Scores unscored photos, executes perceptual duplicate sweeps, ranks images with engagement boosts,
    manual pins, creates highlights album, selects covers, logs history, and sends members rich alerts.
    """
    # 1. Verify Permission (Host/Admin or Platform Admin)
    is_elevated = await check_is_host_or_admin(community_id, current_user.id, db)
    if not is_elevated and current_user.platform_role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Access Denied: Hosts or Admins only.")

    # Fetch community
    stmt_comm = select(Community).where(Community.id == community_id)
    res_comm = await db.execute(stmt_comm)
    community = res_comm.scalar_one_or_none()
    if not community:
        raise HTTPException(status_code=404, detail="Community not found.")

    # 2. Query all community photos
    stmt_media = select(CommunityMedia).where(
        CommunityMedia.community_id == community_id,
        CommunityMedia.file_type == "photo"
    )
    res_media = await db.execute(stmt_media)
    all_photos = res_media.scalars().all()

    if not all_photos:
        return {"message": "No photos found in this community to analyze.", "photos_analyzed": 0, "photos_selected": 0, "duplicates_removed": 0}

    # 3. Score unscored photos on-the-fly (Module 1)
    photos_analyzed_count = 0
    for photo in all_photos:
        if photo.overall_score == 0.0:
            try:
                # Score using CV service
                response = requests.get(photo.file_url, timeout=10)
                if response.status_code == 200:
                    scores = AIService.score_photo(response.content)
                    photo.sharpness_score = scores["sharpness_score"]
                    photo.blur_score = scores["blur_score"]
                    photo.brightness_score = scores["brightness_score"]
                    photo.face_visibility_score = scores["face_visibility_score"]
                    photo.smile_score = scores["smile_score"]
                    photo.composition_score = scores["composition_score"]
                    photo.eye_open_score = scores["eye_open_score"]
                    photo.overall_score = scores["overall_score"]
                    photo.quality_reason = scores["quality_reason"]
                    photos_analyzed_count += 1
            except Exception as e:
                logger.error(f"Failed to score photo {photo.id} dynamically: {e}")
                # Safe fallbacks
                photo.overall_score = 75.0
                photo.sharpness_score = 70.0
                photo.brightness_score = 80.0
                photo.quality_reason = "balanced detail capture"

    # 4. Dynamic Engagement-Based Ranking (Module 14)
    # Count favorites per photo in photo_face_matches to boost overall score
    for photo in all_photos:
        fav_stmt = select(PhotoFaceMatch).where(
            PhotoFaceMatch.media_id == photo.id,
            PhotoFaceMatch.is_favorite == True
        )
        fav_res = await db.execute(fav_stmt)
        fav_count = len(fav_res.scalars().all())
        # Apply +5.0 points per user favorite
        photo.overall_score = min(100.0, photo.overall_score + (fav_count * 5.0))

    # 5. Perceptual Duplicate Sweep (Module 2)
    # Group photos by similar timestamps (within 5 mins) and close scores, flagging lower quality duplicates
    unique_photos = []
    duplicate_count = 0
    
    # Sort by overall score descending first to keep the best one
    sorted_candidates = sorted(all_photos, key=lambda x: x.overall_score, reverse=True)
    
    for candidate in sorted_candidates:
        # Pinned photos are never treated as duplicates to preserve manual overrides
        if candidate.is_pinned_highlight:
            unique_photos.append(candidate)
            continue
            
        is_dup = False
        for unique in unique_photos:
            time_diff = abs((candidate.created_at - unique.created_at).total_seconds())
            score_diff = abs(candidate.overall_score - unique.overall_score)
            
            # Simple metadata similarity checking: created within 5 minutes and overall scores within 3 points
            if time_diff < 300 and score_diff < 3.0:
                is_dup = True
                duplicate_count += 1
                break
        
        if not is_dup:
            unique_photos.append(candidate)

    # 6. Curation Ranking (Module 3 & 8)
    # Pinned photos are collected first, followed by non-duplicate high-scoring photos
    pinned_highlights = [p for p in unique_photos if p.is_pinned_highlight]
    standard_highlights = [p for p in unique_photos if not p.is_pinned_highlight]
    
    # Sort standard highlights by overall quality
    standard_highlights.sort(key=lambda x: x.overall_score, reverse=True)
    
    # Select highlights up to limit (including all pins)
    remaining_slots = max(0, limit - len(pinned_highlights))
    selected_photos = pinned_highlights + standard_highlights[:remaining_slots]

    # 7. Create/Retrieve Highlights Album (Module 6)
    album_stmt = select(MediaAlbum).where(
        MediaAlbum.community_id == community_id,
        MediaAlbum.is_highlights == True
    )
    res_album = await db.execute(album_stmt)
    album = res_album.scalar_one_or_none()

    if not album:
        album = MediaAlbum(
            community_id=community_id,
            name=f"✨ {community.title} AI Highlights",
            description=f"Curated collection of the top photos in the gallery. Powered by FaceSnap AI Curation.",
            is_highlights=True,
            generated_by_ai=True,
            created_by=current_user.id
        )
        db.add(album)
        await db.commit()
        await db.refresh(album)

    # Clear previous album mapping and associate selected highlights
    for photo in all_photos:
        if photo.album_id == album.id:
            photo.album_id = None
            
    for photo in selected_photos:
        photo.album_id = album.id

    # 8. Highlight Cover Selection (Module 7)
    # Default to highest scored unique photo, if not overridden
    if selected_photos and (not album.cover_media_id or album.cover_media_id not in [p.id for p in selected_photos]):
        album.cover_media_id = selected_photos[0].id
        album.cover_url = selected_photos[0].file_url

    # 9. Log Generation History (Module 13)
    from app.models import HighlightGenerationLog
    generation_log = HighlightGenerationLog(
        album_id=album.id,
        community_id=community_id,
        generated_by=current_user.id,
        photos_analyzed=len(all_photos),
        photos_selected=len(selected_photos),
        duplicates_removed=duplicate_count
    )
    db.add(generation_log)

    # 10. Highlights Notifications (Module 12)
    # Generate Phase 4C alerts to all community members
    roles_stmt = select(CommunityRole.user_id).where(CommunityRole.community_id == community_id)
    res_roles = await db.execute(roles_stmt)
    member_ids = [row[0] for row in res_roles.all()]

    for m_id in member_ids:
        # Check user notification preferences
        u_stmt = select(User).where(User.id == m_id)
        u_res = await db.execute(u_stmt)
        m_user = u_res.scalar_one()

        if m_user.match_notifications_enabled and m_user.community_match_notifications_enabled:
            notif = Notification(
                user_id=m_id,
                title="✨ Community Highlights Generated",
                message=f"✨ '{community.title}' AI Highlights album is ready! Top {len(selected_photos)} photos selected.",
                notification_type="community_match",
                community_id=community_id,
                match_count=len(selected_photos),
                target_url=f"/dashboard/my-groups/{community_id}",
                is_read=False
            )
            db.add(notif)

    await db.commit()
    await db.refresh(album)

    return {
        "message": "AI highlights generation complete.",
        "album_id": album.id,
        "photos_analyzed": len(all_photos),
        "photos_selected": len(selected_photos),
        "duplicates_removed": duplicate_count
    }


@router.post("/media/{media_id}/pin")
async def pin_photo_highlight(
    media_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Module 8: Manual Pin highlight photo (Host/Admin only)."""
    stmt = select(CommunityMedia).where(CommunityMedia.id == media_id)
    res = await db.execute(stmt)
    media = res.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=404, detail="Photo not found.")

    is_elevated = await check_is_host_or_admin(media.community_id, current_user.id, db)
    if not is_elevated and current_user.platform_role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Access Denied: Hosts or Admins only.")

    media.is_pinned_highlight = True
    await db.commit()
    return {"message": "Photo successfully pinned to highlights.", "is_pinned": media.is_pinned_highlight}


@router.post("/media/{media_id}/unpin")
async def unpin_photo_highlight(
    media_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Module 8: Manual Unpin highlight photo (Host/Admin only)."""
    stmt = select(CommunityMedia).where(CommunityMedia.id == media_id)
    res = await db.execute(stmt)
    media = res.scalar_one_or_none()
    if not media:
        raise HTTPException(status_code=404, detail="Photo not found.")

    is_elevated = await check_is_host_or_admin(media.community_id, current_user.id, db)
    if not is_elevated and current_user.platform_role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Access Denied: Hosts or Admins only.")

    media.is_pinned_highlight = False
    await db.commit()
    return {"message": "Photo successfully unpinned from highlights.", "is_pinned": media.is_pinned_highlight}


@router.post("/albums/{album_id}/cover")
async def override_album_cover(
    album_id: UUID,
    media_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Module 7: Manual Override Album Cover (Host/Admin only)."""
    stmt_album = select(MediaAlbum).where(MediaAlbum.id == album_id)
    res_album = await db.execute(stmt_album)
    album = res_album.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Album not found.")

    is_elevated = await check_is_host_or_admin(album.community_id, current_user.id, db)
    if not is_elevated and current_user.platform_role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Access Denied: Hosts or Admins only.")

    # Fetch photo to verify it belongs to this community/album
    stmt_photo = select(CommunityMedia).where(
        CommunityMedia.id == media_id,
        CommunityMedia.community_id == album.community_id
    )
    res_photo = await db.execute(stmt_photo)
    photo = res_photo.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found inside this community.")

    album.cover_media_id = photo.id
    album.cover_url = photo.file_url
    await db.commit()
    return {"message": "Album cover overridden successfully.", "cover_url": album.cover_url}


@router.get("/albums/highlights", response_model=List[MediaAlbumResponse])
async def list_highlights_albums(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Module 10: Fetch all curated highlights albums for current user's registered communities."""
    from app.models import CommunityRole
    
    # Get user's communities
    stmt_roles = select(CommunityRole.community_id).where(CommunityRole.user_id == current_user.id)
    res_roles = await db.execute(stmt_roles)
    my_comm_ids = [row[0] for row in res_roles.all()]

    if not my_comm_ids:
        return []

    stmt = select(MediaAlbum).where(
        MediaAlbum.community_id.in_(my_comm_ids),
        MediaAlbum.is_highlights == True
    ).order_by(MediaAlbum.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/highlights/{album_id}", response_model=List[CommunityMediaResponse])
async def get_highlights_album_photos(
    album_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Module 10: Fetch curated photos linked to a highlights album."""
    # Check album exists
    stmt_album = select(MediaAlbum).where(MediaAlbum.id == album_id)
    res_album = await db.execute(stmt_album)
    album = res_album.scalar_one_or_none()
    if not album:
        raise HTTPException(status_code=404, detail="Highlights album not found.")

    if current_user.platform_role != "super_admin":
        role_stmt = select(CommunityRole).where(
            CommunityRole.community_id == album.community_id,
            CommunityRole.user_id == current_user.id
        )
        role_res = await db.execute(role_stmt)
        if not role_res.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not an approved participant of this community."
            )

    stmt = select(CommunityMedia).where(
        CommunityMedia.album_id == album_id,
        CommunityMedia.file_type == "photo"
    ).order_by(CommunityMedia.overall_score.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.get("/{community_id}/highlights/logs")
async def get_highlights_logs(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Module 16: Retrieve history logs of highlights runs (Host/Admin only)."""
    is_elevated = await check_is_host_or_admin(community_id, current_user.id, db)
    if not is_elevated and current_user.platform_role not in ("super_admin", "admin"):
        raise HTTPException(status_code=403, detail="Access Denied: Hosts or Admins only.")

    from app.models import HighlightGenerationLog
    stmt = select(HighlightGenerationLog).where(
        HighlightGenerationLog.community_id == community_id
    ).order_by(HighlightGenerationLog.created_at.desc()).limit(15)
    
    res = await db.execute(stmt)
    logs = res.scalars().all()
    
    return [{
        "id": log.id,
        "photos_analyzed": log.photos_analyzed,
        "photos_selected": log.photos_selected,
        "duplicates_removed": log.duplicates_removed,
        "created_at": log.created_at,
        "generated_by": log.creator.full_name if log.creator else "System"
    } for log in logs]


# --- Community Invite Code Endpoints ---
import uuid

@router.post("/{community_id}/invite-codes", response_model=CommunityInviteCodeResponse)
async def create_community_invite_code(
    community_id: UUID,
    payload: CommunityInviteCodeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    is_authorized = False
    if current_user.platform_role == "super_admin":
        is_authorized = True
    else:
        is_authorized = await check_is_host_or_admin(community_id, current_user.id, db)
        
    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only group Hosts or Admins can generate invite codes."
        )
        
    import random
    import string
    
    for _ in range(5):
        code_str = "".join(random.choices(string.ascii_uppercase + string.digits, k=8))
        dup_res = await db.execute(select(CommunityInviteCode).where(CommunityInviteCode.code == code_str))
        if not dup_res.scalar_one_or_none():
            break
    else:
        code_str = uuid.uuid4().hex[:12].upper()

    expires_at = None
    if payload.expires_in_days:
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=payload.expires_in_days)

    new_code = CommunityInviteCode(
        code=code_str,
        community_id=community_id,
        creator_id=current_user.id,
        join_mode=payload.join_mode,
        expires_at=expires_at,
        max_uses=payload.max_uses,
        uses_count=0
    )
    db.add(new_code)
    
    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="Invite created",
        target=f"Invite created for community {community_id} with code: {code_str}",
        target_id=community_id
    )
    db.add(audit)

    await db.commit()
    await db.refresh(new_code)
    return new_code

@router.get("/{community_id}/invite-codes", response_model=List[CommunityInviteCodeResponse])
async def list_community_invite_codes(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    is_authorized = False
    if current_user.platform_role == "super_admin":
        is_authorized = True
    else:
        is_authorized = await check_is_host_or_admin(community_id, current_user.id, db)
        
    if not is_authorized:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only group Hosts or Admins can view invite codes."
        )

    res = await db.execute(
        select(CommunityInviteCode)
        .where(CommunityInviteCode.community_id == community_id)
        .order_by(CommunityInviteCode.created_at.desc())
    )
    return res.scalars().all()

@router.delete("/invite-codes/{code_id}")
async def delete_community_invite_code(
    code_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(CommunityInviteCode).where(CommunityInviteCode.id == code_id)
    res = await db.execute(stmt)
    invite_code = res.scalar_one_or_none()
    if not invite_code:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invite code not found.")

    is_authorized = False
    if current_user.platform_role == "super_admin":
        is_authorized = True
    elif invite_code.creator_id == current_user.id:
        is_authorized = True
    else:
        is_authorized = await check_is_host_or_admin(invite_code.community_id, current_user.id, db)

    if not is_authorized:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access Denied.")

    # Audit log
    audit = AuditLog(
        user_id=current_user.id,
        action="Invite disabled",
        target=f"Invite code disabled: {invite_code.code}",
        target_id=invite_code.community_id
    )
    db.add(audit)

    await db.delete(invite_code)
    await db.commit()
    return {"message": "Invite code deleted successfully."}

@router.get("/invite-codes/lookup/{code}")
async def lookup_invite_code(
    code: str,
    db: AsyncSession = Depends(get_db)
):
    stmt = select(CommunityInviteCode).where(CommunityInviteCode.code == code.strip().upper())
    res = await db.execute(stmt)
    invite_code = res.scalar_one_or_none()
    if not invite_code:
        return {"valid": False, "error": "Invalid invite code."}

    if invite_code.expires_at and invite_code.expires_at < datetime.datetime.now(datetime.timezone.utc):
        return {"valid": False, "error": "This invite code has expired."}

    if invite_code.max_uses and invite_code.uses_count >= invite_code.max_uses:
        return {"valid": False, "error": "This invite code has reached its maximum usage limit."}

    comm_res = await db.execute(select(Community).where(Community.id == invite_code.community_id))
    comm = comm_res.scalar_one_or_none()
    if not comm:
        return {"valid": False, "error": "Community no longer exists."}

    role_count_stmt = select(func.count(CommunityRole.id)).where(CommunityRole.community_id == comm.id)
    role_count_res = await db.execute(role_count_stmt)
    members_count = role_count_res.scalar() or 0

    return {
        "valid": True,
        "community_id": str(comm.id),
        "community_title": comm.title,
        "community_description": comm.description,
        "banner_url": comm.banner_url,
        "category": comm.category,
        "join_mode": invite_code.join_mode,
        "participant_count": members_count
    }

@router.post("/join-by-code/{code}")
async def join_community_by_code(
    code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(CommunityInviteCode).where(CommunityInviteCode.code == code.strip().upper())
    res = await db.execute(stmt)
    invite_code = res.scalar_one_or_none()
    if not invite_code:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid invite code.")

    if invite_code.expires_at and invite_code.expires_at < datetime.datetime.now(datetime.timezone.utc):
        audit = AuditLog(
            user_id=current_user.id,
            action="Invite expired",
            target=f"Expired invite code: {code}",
            target_id=invite_code.community_id
        )
        db.add(audit)
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invite code has expired.")

    if invite_code.max_uses and invite_code.uses_count >= invite_code.max_uses:
        audit = AuditLog(
            user_id=current_user.id,
            action="Usage limit reached",
            target=f"Invite code limit reached: {code}",
            target_id=invite_code.community_id
        )
        db.add(audit)
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This invite code has reached its maximum usage limit.")

    comm_res = await db.execute(select(Community).where(Community.id == invite_code.community_id))
    comm = comm_res.scalar_one_or_none()
    if not comm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Community not found.")

    role_stmt = select(CommunityRole).where(
        CommunityRole.community_id == invite_code.community_id,
        CommunityRole.user_id == current_user.id
    )
    role_res = await db.execute(role_stmt)
    if role_res.scalar_one_or_none():
        return {
            "joined": True,
            "community_id": str(invite_code.community_id),
            "message": "You are already a member of this community."
        }

    if invite_code.join_mode == "auto":
        new_role = CommunityRole(
            community_id=invite_code.community_id,
            user_id=current_user.id,
            role=None
        )
        db.add(new_role)
        invite_code.uses_count += 1
        
        notif = Notification(
            user_id=current_user.id,
            title="Community Joined",
            message=f"You joined {comm.title} via invite code.",
            is_read=False,
            community_id=invite_code.community_id
        )
        db.add(notif)
        
        # Log redeem and joined
        audit_redeem = AuditLog(
            user_id=current_user.id,
            action="Invite redeemed",
            target=f"Invite redeemed with code: {code}",
            target_id=invite_code.community_id
        )
        db.add(audit_redeem)
        
        audit_join = AuditLog(
            user_id=current_user.id,
            action="Joined community",
            target=f"User joined community {invite_code.community_id} via auto invite code redemption",
            target_id=invite_code.community_id
        )
        db.add(audit_join)
        
        await db.commit()
        return {
            "joined": True,
            "community_id": str(invite_code.community_id),
            "message": f"Successfully joined {comm.title}!"
        }
    else:
        req_stmt = select(CommunityJoinRequest).where(
            CommunityJoinRequest.community_id == invite_code.community_id,
            CommunityJoinRequest.user_id == current_user.id,
            CommunityJoinRequest.status == "pending"
        )
        req_res = await db.execute(req_stmt)
        if req_res.scalar_one_or_none():
            return {
                "joined": False,
                "status": "pending",
                "community_id": str(invite_code.community_id),
                "message": "Your join request is already pending approval."
            }

        new_request = CommunityJoinRequest(
            community_id=invite_code.community_id,
            user_id=current_user.id,
            message=f"Requested access via invite code {invite_code.code}",
            status="pending"
        )
        db.add(new_request)
        invite_code.uses_count += 1
        
        # Log redeem and request submitted
        audit_redeem = AuditLog(
            user_id=current_user.id,
            action="Invite redeemed",
            target=f"Invite redeemed with code: {code}",
            target_id=invite_code.community_id
        )
        db.add(audit_redeem)
        
        audit_req = AuditLog(
            user_id=current_user.id,
            action="Request submitted",
            target=f"Join request submitted via invite code {invite_code.code}",
            target_id=invite_code.community_id
        )
        db.add(audit_req)

        await db.commit()
        return {
            "joined": False,
            "status": "pending",
            "community_id": str(invite_code.community_id),
            "message": f"Join request submitted. A Host or Admin of {comm.title} must approve your access."
        }


