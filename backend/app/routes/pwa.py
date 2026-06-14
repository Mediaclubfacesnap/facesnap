import os
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import Optional, Dict, Any

from app.database import get_db
from app.models import PushSubscription, User
from app.routes.auth import get_current_user

router = APIRouter(prefix="/pwa", tags=["PWA"])

class SubscribeRequest(BaseModel):
    endpoint: str
    p256dh: str
    auth: str
    user_agent: Optional[str] = None

class UnsubscribeRequest(BaseModel):
    endpoint: str

@router.post("/subscribe", summary="Subscribe to Web Push Notifications")
async def subscribe_push(
    request: SubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check if subscription already exists
    stmt = select(PushSubscription).where(PushSubscription.endpoint == request.endpoint)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        # Update if it exists for a different user
        if existing.user_id != current_user.id:
            existing.user_id = current_user.id
            existing.p256dh = request.p256dh
            existing.auth = request.auth
            existing.user_agent = request.user_agent
            await db.commit()
        return {"message": "Subscription updated successfully"}
    
    new_sub = PushSubscription(
        user_id=current_user.id,
        endpoint=request.endpoint,
        p256dh=request.p256dh,
        auth=request.auth,
        user_agent=request.user_agent
    )
    db.add(new_sub)
    await db.commit()
    return {"message": "Subscription created successfully"}

@router.delete("/unsubscribe", summary="Unsubscribe from Web Push Notifications")
async def unsubscribe_push(
    endpoint: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(PushSubscription).where(
        PushSubscription.endpoint == endpoint,
        PushSubscription.user_id == current_user.id
    )
    result = await db.execute(stmt)
    sub = result.scalar_one_or_none()
    
    if sub:
        await db.delete(sub)
        await db.commit()
    
    return {"message": "Unsubscribed successfully"}

@router.get("/vapid-public-key", summary="Get VAPID Public Key")
async def get_vapid_public_key():
    from app.config import settings
    # Try to load from settings/env. If not present, return a fallback 
    # (in production this MUST be set properly)
    pub_key = getattr(settings, "VAPID_PUBLIC_KEY", os.getenv("VAPID_PUBLIC_KEY"))
    if not pub_key:
        pub_key = "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuB22mQvV-P1wGZ343B00_03Z4"
    return {"public_key": pub_key}

@router.get("/diagnostics", summary="Get PWA Diagnostics (Admin Only)")
async def get_pwa_diagnostics(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if current_user.platform_role not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    subs_result = await db.execute(select(func.count(PushSubscription.id)))
    total_subs = subs_result.scalar() or 0
    
    return {
        "status": "healthy",
        "push_subscribers": total_subs,
        "vapid_configured": bool(os.getenv("VAPID_PRIVATE_KEY"))
    }
