from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from jose import jwt, JWTError
import bcrypt
import datetime
import re
from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import Optional

from app.database import get_db
from app.models import User, AuditLog, SecurityIncident, Notification, UserSession, LoginEvent
import uuid
from app.schemas import UserRegister, UserLogin, UserResponse, Token
from app.config import settings
from app.services.cache_service import cache
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# --- Security Helpers ---
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    now = datetime.datetime.utcnow()
    expire = now + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": now})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM], options={"leeway": 60})
        user_id: str = payload.get("sub")
        jti: str = payload.get("jti")
        if user_id is None:
            raise credentials_exception
        
        # Redis Session Blacklisting validation
        # 1. Specific Token Check
        if cache.redis_client:
            if cache.redis_client.get(f"bl_token:{token}"):
                raise credentials_exception
            # 2. Global Revocation Check
            revoked_time_str = cache.redis_client.get(f"user_revoked_before:{user_id}")
            if revoked_time_str:
                revoked_time = float(revoked_time_str)
                iat = payload.get("iat")
                if iat and iat < revoked_time:
                    raise credentials_exception
        else:
            if cache.get(f"bl_token:{token}"):
                raise credentials_exception
            revoked_time = cache.get(f"user_revoked_before:{user_id}")
            if revoked_time:
                iat = payload.get("iat")
                if iat and iat < float(revoked_time):
                    raise credentials_exception

        # Check DB for session revoked status
        if jti:
            session_result = await db.execute(select(UserSession).where(UserSession.jti == jti))
            user_session = session_result.scalar_one_or_none()
            if not user_session or user_session.is_revoked:
                raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user

@router.post("/signup", response_model=Token, status_code=status.HTTP_201_CREATED)
async def signup(user_in: UserRegister, db: AsyncSession = Depends(get_db)) -> dict:
    raw_username = user_in.username.strip().lower()
    if not raw_username.startswith("@"):
        raw_username = f"@{raw_username}"
    if not re.match(r"^@[a-z0-9_]{2,19}$", raw_username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be alphanumeric and between 2 to 20 characters after @."
        )
    username_check = await db.execute(select(User).where(User.username == raw_username))
    if username_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This username is already taken."
        )
    email_check = await db.execute(select(User).where(User.email == user_in.email))
    if email_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email is already registered."
        )
    new_user = User(
        username=raw_username,
        email=user_in.email,
        password_hash=hash_password(user_in.password),
        full_name=user_in.full_name,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    jti = str(uuid.uuid4())
    token = create_access_token({"sub": str(new_user.id), "jti": jti})
    
    # Create UserSession for signup
    user_session = UserSession(
        user_id=new_user.id,
        jti=jti,
        device_name="Unknown",
        browser="Unknown",
        os="Unknown",
        ip_address=None,
        is_current=True,
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    db.add(user_session)
    await db.commit()
    
    return {"access_token": token, "token_type": "bearer", "user": new_user}

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, request: Request, db: AsyncSession = Depends(get_db)) -> Token:
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalar_one_or_none()
    
    now = datetime.datetime.utcnow()
    ip = request.client.host if request.client else None
    ua_string = request.headers.get("user-agent", "") if request else ""
    
    # Parse browser/OS simply
    browser = "Unknown"
    os_name = "Unknown"
    if ua_string:
        if "Chrome" in ua_string:
            browser = "Chrome"
        elif "Safari" in ua_string:
            browser = "Safari"
        elif "Firefox" in ua_string:
            browser = "Firefox"
        elif "Edge" in ua_string:
            browser = "Edge"
            
        if "Windows" in ua_string:
            os_name = "Windows"
        elif "Macintosh" in ua_string:
            os_name = "macOS"
        elif "Linux" in ua_string:
            os_name = "Linux"
        elif "Android" in ua_string:
            os_name = "Android"
        elif "iPhone" in ua_string or "iPad" in ua_string:
            os_name = "iOS"

    if user:
        # Check lockout
        if user.locked_until:
            locked_until_utc = user.locked_until
            if locked_until_utc.tzinfo is None:
                locked_until_utc = locked_until_utc.replace(tzinfo=datetime.timezone.utc)
            
            now_utc = datetime.datetime.now(datetime.timezone.utc)
            if locked_until_utc > now_utc:
                minutes_left = int((locked_until_utc - now_utc).total_seconds() / 60) + 1
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Account is temporarily locked. Try again in {minutes_left} minutes."
                )

        if not verify_password(credentials.password, user.password_hash):
            user.failed_login_count += 1
            if user.failed_login_count >= 5:
                user.locked_until = now + datetime.timedelta(minutes=15)
                # Create Security Incident for brute force
                incident = SecurityIncident(
                    user_id=user.id,
                    incident_type="brute_force",
                    severity="medium",
                    ip_address=ip,
                    description=f"Account locked due to 5 failed login attempts for email: {credentials.email}"
                )
                db.add(incident)
            
            # Log to AuditLog
            audit = AuditLog(
                user_id=user.id,
                action="login_failed",
                target="user",
                target_id=user.id,
                ip_address=ip,
                user_agent=ua_string,
                meta={"email": credentials.email}
            )
            db.add(audit)
            
            failed_event = LoginEvent(
                user_id=user.id,
                ip_address=ip,
                device=f"{browser} on {os_name}",
                browser=browser,
                os=os_name,
                country="Unknown",
                city="Unknown",
                success=False
            )
            db.add(failed_event)
            
            await db.commit()
            
            if user.failed_login_count >= 5:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Account has been locked for 15 minutes due to multiple failed login attempts."
                )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password."
            )
            
        # Successful Login logic
        # Check for suspicious device (IP or device not seen in last 10 successful logins)
        prior_stmt = select(AuditLog).where(
            AuditLog.user_id == user.id,
            AuditLog.action == "login_success"
        ).order_by(AuditLog.created_at.desc()).limit(10)
        prior_res = await db.execute(prior_stmt)
        prior_logs = prior_res.scalars().all()
        
        is_new_device = True
        is_new_ip = True
        
        if prior_logs:
            for log in prior_logs:
                if log.ip_address == ip:
                    is_new_ip = False
                if log.user_agent == ua_string:
                    is_new_device = False
                    
        if prior_logs and (is_new_ip or is_new_device):
            # Create user notification
            new_login_notif = Notification(
                user_id=user.id,
                title="New Device Login",
                message=f"A new login was detected from IP: {ip}, OS: {os_name}, Browser: {browser}. If this wasn't you, please log out and change your password.",
                notification_type="system",
                target_url="/dashboard/settings"
            )
            db.add(new_login_notif)
            
            # Create low severity incident
            sec_incident = SecurityIncident(
                user_id=user.id,
                incident_type="suspicious_login",
                severity="low",
                ip_address=ip,
                description=f"Suspicious login: new device or IP detected. OS: {os_name}, Browser: {browser}"
            )
            db.add(sec_incident)

        # Reset login failures
        user.failed_login_count = 0
        user.locked_until = None
        
        # Log successful login
        success_audit = AuditLog(
            user_id=user.id,
            action="login_success",
            target="user",
            target_id=user.id,
            ip_address=ip,
            user_agent=ua_string,
            meta={"browser": browser, "os": os_name}
        )
        db.add(user)
        db.add(success_audit)
        
        # Sprint 2 & 3: Create UserSession and LoginEvent
        expire_at = now + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        jti = str(uuid.uuid4())
        
        user_session = UserSession(
            user_id=user.id,
            jti=jti,
            device_name=f"{browser} on {os_name}",
            browser=browser,
            os=os_name,
            ip_address=ip,
            country="Unknown", # Placeholder for GeoIP
            city="Unknown",    # Placeholder for GeoIP
            is_current=True,
            expires_at=expire_at
        )
        db.add(user_session)
        
        login_event = LoginEvent(
            user_id=user.id,
            ip_address=ip,
            device=f"{browser} on {os_name}",
            browser=browser,
            os=os_name,
            country="Unknown",
            city="Unknown",
            success=True
        )
        db.add(login_event)

        await db.commit()
        
        token = create_access_token({"sub": str(user.id), "jti": jti})
        return {"access_token": token, "token_type": "bearer", "user": user}
    else:
        # Non-existent email: audit trail (anonymous) and standard 401
        audit = AuditLog(
            user_id=None,
            action="login_failed",
            target="user",
            ip_address=ip,
            user_agent=ua_string,
            meta={"email": credentials.email, "reason": "Non-existent user email"}
        )
        db.add(audit)
        
        # Also log to LoginEvent
        failed_event = LoginEvent(
            user_id=None, # Will fail if user_id is NOT NULL, let me check models.
            # wait, LoginEvent user_id is NOT NULL in models.py, so we can't log if user doesn't exist unless we change model.
            ip_address=ip,
            device=f"{browser} on {os_name}",
            browser=browser,
            os=os_name,
            success=False
        )
        # Instead of saving failed_event, I'll just stick to AuditLog since LoginEvent user_id is NOT NULL.
        
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password."
        )

@router.get("/me", response_model=UserResponse)
async def read_current_user(current_user: User = Depends(get_current_user)) -> UserResponse:
    return current_user

@router.post("/logout")
async def logout(
    token: str = Depends(oauth2_scheme), 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM], options={"leeway": 60})
        exp = payload.get("exp")
        now = datetime.datetime.utcnow().timestamp()
        ttl = int(exp - now) if exp else settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        if ttl > 0:
            if cache.redis_client:
                cache.redis_client.set(f"bl_token:{token}", "1", ex=ttl)
            else:
                cache.set(f"bl_token:{token}", "1", ttl_seconds=ttl)
    except Exception:
        if cache.redis_client:
            cache.redis_client.set(f"bl_token:{token}", "1", ex=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
        else:
            cache.set(f"bl_token:{token}", "1", ttl_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)

    # Log to AuditLog
    audit = AuditLog(
        user_id=current_user.id,
        action="logout",
        target="user",
        target_id=current_user.id,
        meta={"token_invalidated": True}
    )
    db.add(audit)
    await db.commit()
    return {"detail": "Successfully logged out."}

@router.post("/logout-all-devices")
async def logout_all_devices(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    now_timestamp = datetime.datetime.utcnow().timestamp()
    ttl = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
    if cache.redis_client:
        cache.redis_client.set(f"user_revoked_before:{current_user.id}", str(now_timestamp), ex=ttl)
    else:
        cache.set(f"user_revoked_before:{current_user.id}", str(now_timestamp), ttl_seconds=ttl)

    # Log to AuditLog
    audit = AuditLog(
        user_id=current_user.id,
        action="logout_all_devices",
        target="user",
        target_id=current_user.id,
        meta={"revoked_before": now_timestamp}
    )
    db.add(audit)
    
    # Create notification for user
    notif = Notification(
        user_id=current_user.id,
        title="Logout All Devices",
        message="You successfully logged out from all devices.",
        notification_type="system"
    )
    db.add(notif)
    
    await db.commit()
    return {"detail": "Successfully logged out from all devices."}

class OAuthSyncRequest(BaseModel):
    id: UUID
    email: str  # Plain str to avoid idna crash on Python 3.12
    full_name: str
    avatar_url: Optional[str] = None

@router.post("/sync-oauth", response_model=Token)
async def sync_oauth(payload: OAuthSyncRequest, db: AsyncSession = Depends(get_db)) -> Token:
    """Synchronize OAuth login/registration.

    Logs start, payload, and detailed traceback on failure.
    Returns a JWT access token and user data.
    """
    try:
        # Try to find an existing user by Supabase UUID
        result = await db.execute(select(User).where(User.id == payload.id))
        user = result.scalar_one_or_none()
        if not user:
            # Create a new user
            base_username = payload.email.split("@")[0]
            base_username = re.sub(r"[^a-z0-9_]", "", base_username.lower())
            if len(base_username) < 2:
                base_username = f"user_{base_username}"
            if len(base_username) > 15:
                base_username = base_username[:15]
            username = f"@{base_username}"
            counter = 1
            original_username = username
            while True:
                uname_check = await db.execute(select(User).where(User.username == username))
                if not uname_check.scalar_one_or_none():
                    break
                username = f"{original_username}{counter}"
                counter += 1
            user = User(
                id=payload.id,
                username=username,
                email=payload.email,
                password_hash="google_oauth_placeholder",
                full_name=payload.full_name,
                avatar_url=payload.avatar_url,
            )
            # Super admin auto‑creation
            if payload.email.lower() == "facesnap2k26@gmail.com":
                user.platform_role = "super_admin"
                user.can_create_communities = True
                user.can_create_events = True
            db.add(user)
            await db.commit()
            await db.refresh(user)
        else:
            # Update existing user fields
            user.full_name = payload.full_name
            user.avatar_url = payload.avatar_url
            # Ensure super admin flag on every login
            if payload.email.lower() == "facesnap2k26@gmail.com":
                user.platform_role = "super_admin"
                user.can_create_communities = True
                user.can_create_events = True
            db.add(user)
            await db.commit()
            await db.refresh(user)
        jti = str(uuid.uuid4())
        token = create_access_token({"sub": str(user.id), "jti": jti})
        
        # Create or refresh UserSession for OAuth user
        user_session = UserSession(
            user_id=user.id,
            jti=jti,
            device_name="OAuth (Google)",
            browser="OAuth",
            os="Unknown",
            ip_address=None,
            is_current=True,
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        db.add(user_session)
        await db.commit()
        
        return {"access_token": token, "token_type": "bearer", "user": user}
    except Exception as e:
        logger.exception("OAUTH FAILURE")
        raise HTTPException(status_code=500, detail="OAuth sync failed")
