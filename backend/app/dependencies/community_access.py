from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import UUID
from app.database import get_db
from app.models import CommunityRole, User, Community
from app.routes.auth import get_current_user
import logging

logger = logging.getLogger(__name__)

async def require_participant(
    community_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
) -> CommunityRole:
    """Verifies the user is a participant of the community (or super admin)."""
    # Fetch community to verify it exists and is not archived
    comm_stmt = select(Community).where(Community.id == community_id)
    comm_res = await db.execute(comm_stmt)
    comm = comm_res.scalar_one_or_none()
    if not comm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Community not found"
        )
    if comm.archived_at is not None and current_user.platform_role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This community has been archived."
        )

    if current_user.platform_role == "super_admin":
        role_stmt = select(CommunityRole).where(
            CommunityRole.community_id == community_id,
            CommunityRole.user_id == current_user.id
        )
        role_res = await db.execute(role_stmt)
        role_rec = role_res.scalar_one_or_none()
        if not role_rec:
            # Mock role for super_admin
            role_rec = CommunityRole(community_id=community_id, user_id=current_user.id, role="admin")
        return role_rec

    stmt = select(CommunityRole).where(
        CommunityRole.community_id == community_id,
        CommunityRole.user_id == current_user.id
    )
    result = await db.execute(stmt)
    role_rec = result.scalar_one_or_none()
    if role_rec is None:
        logger.warning(f"Unauthorized community access attempt: user={current_user.id} community={community_id}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not an approved participant of this community."
        )
    return role_rec

async def require_moderator(
    role_rec: CommunityRole = Depends(require_participant),
    current_user: User = Depends(get_current_user)
) -> CommunityRole:
    """Verifies the user is a moderator, admin, or host (or super admin)."""
    if current_user.platform_role == "super_admin":
        return role_rec
    if role_rec.role not in ("moderator", "admin", "host"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Moderator privileges required."
        )
    return role_rec

async def require_admin(
    role_rec: CommunityRole = Depends(require_participant),
    current_user: User = Depends(get_current_user)
) -> CommunityRole:
    """Verifies the user is an admin or host (or super admin)."""
    if current_user.platform_role == "super_admin":
        return role_rec
    if role_rec.role not in ("admin", "host"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Admin privileges required."
        )
    return role_rec

async def require_host(
    role_rec: CommunityRole = Depends(require_participant),
    current_user: User = Depends(get_current_user)
) -> CommunityRole:
    """Verifies the user is the host (or super admin)."""
    if current_user.platform_role == "super_admin":
        return role_rec
    if role_rec.role != "host":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Only the group Host can perform this action."
        )
    return role_rec

async def require_super_admin(
    current_user: User = Depends(get_current_user)
) -> User:
    """Verifies the user is a super admin."""
    if current_user.platform_role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access Denied: Super Admin privileges required."
        )
    return current_user
