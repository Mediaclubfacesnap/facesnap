from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import logging
import os
import traceback
from typing import Dict, List
from app.config import settings

# Validate environment configurations at startup
from app.startup import validate_environment
validate_environment()

from app.routes import (
    admin_operations, auth, communities, events, jobs, memories, messages,
    monitoring, notifications, photos, privacy, pwa, recovery, search,
    security, uploads, verification
)
from sqlalchemy import text
from app.database import engine


# Initialize Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Triggering reload for analytics debug


app = FastAPI(
    title="FaceSnap AI Memory Retrieval OS API",
    description="Futuristic AI-native memory retrieval platform backend, featuring pgvector HNSW indexing, Supabase Storage, and PyTorch MTCNN liveness pipelines.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Initialize Sentry if DSN is set and package is installed
try:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastAPIIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
    from app.config import settings

    sentry_dsn = getattr(settings, "SENTRY_DSN", os.getenv("SENTRY_DSN"))
    if sentry_dsn:
        sentry_sdk.init(
            dsn=sentry_dsn,
            integrations=[
                FastAPIIntegration(),
                SqlalchemyIntegration(),
            ],
            traces_sample_rate=1.0,
        )
        logger.info("Sentry initialized successfully.")
except ImportError:
    logger.warning("sentry-sdk package not installed. Skipping Sentry initialization.")
except Exception as e:
    logger.error(f"Failed to initialize Sentry: {e}")

# --- Global Exception Handler (Module 5 & 11) ---
from fastapi import Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exc()
    logger.error(f"Global unhandled exception on {request.method} {request.url.path}: {exc}\n{tb}")

    # Capture in Sentry
    try:
        import sentry_sdk
        sentry_sdk.capture_exception(exc)
    except Exception:
        pass

    # Log to ErrorLog and SecurityIncident
    try:
        from app.database import AsyncSessionLocal
        from app.models import ErrorLog, SecurityIncident, Notification, User
        from jose import jwt
        from app.config import settings
        from sqlalchemy import select
        from uuid import UUID

        # Resolve user
        user_uuid = None
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM], options={"verify_exp": False})
                sub = payload.get("sub")
                if sub:
                    user_uuid = UUID(sub)
            except Exception:
                pass

        ip = request.client.host if request.client else "unknown_ip"

        async def save_error_records():
            async with AsyncSessionLocal() as db:
                error_entry = ErrorLog(
                    message=str(exc),
                    traceback=tb,
                    endpoint=request.url.path,
                    method=request.method,
                    user_id=user_uuid,
                    ip_address=ip
                )
                db.add(error_entry)

                # Incidents tracking for 500 errors
                incident = SecurityIncident(
                    user_id=user_uuid,
                    incident_type="system_error",
                    severity="high",
                    ip_address=ip,
                    description=f"Unhandled internal server error on {request.method} {request.url.path}: {str(exc)}"
                )
                db.add(incident)

                # Dispatch notifications to Super Admins
                admin_res = await db.execute(select(User).where(User.platform_role == "super_admin"))
                admins = admin_res.scalars().all()
                for admin in admins:
                    notif = Notification(
                        user_id=admin.id,
                        title="Critical System Error Alert",
                        message=f"Critical service error on {request.method} {request.url.path}: {str(exc)[:120]}",
                        notification_type="system",
                        target_url="/dashboard/admin/monitoring"
                    )
                    db.add(notif)

                await db.commit()

        import asyncio
        asyncio.create_task(save_error_records())
    except Exception as db_err:
        logger.error(f"Failed to record unhandled exception to database: {db_err}")

    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error"}
    )

from fastapi.middleware.gzip import GZipMiddleware

# Include Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(communities.router, prefix="/api/v1")
app.include_router(events.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(memories.router, prefix="/api/v1")
app.include_router(messages.router, prefix="/api/v1")
app.include_router(monitoring.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(photos.router, prefix="/api/v1")
app.include_router(privacy.router, prefix="/api/v1")
app.include_router(pwa.router, prefix="/api/v1")
app.include_router(recovery.router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")
app.include_router(security.router, prefix="/api/v1")
app.include_router(uploads.router, prefix="/api/v1")
app.include_router(verification.router, prefix="/api/v1")
app.include_router(admin_operations.router, prefix="/api/v1")


# Configure CORS for Next.js Frontend
cors_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]
if settings.ENVIRONMENT == "production":
    cors_origins = [
        "https://facesnap.app",
        "https://www.facesnap.app"
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Run Database Schema Synchronizations on Startup
@app.on_event("startup")
async def startup_event():
    import time
    t0 = time.time()
    logger.info("Initializing database and AI pipelines...")

    # Only run Base.metadata.create_all for totally missing tables.
    # No ALTER TABLE or CREATE INDEX statements are run here anymore.
    # Schema upgrades MUST be done using backend/scripts/migrate_schema.py!
    try:
        from app.database import Base
        import app.models  # noqa: F401
        async with engine.begin() as conn:
            await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, checkfirst=True))
        logger.info("create_all completed safely.")
    except Exception as e:
        logger.error(f"create_all failed: {e}")

    logger.info(f"Startup event completed in {time.time() - t0:.2f}s")

# NOTE: Routers are already registered above (lines 152-168). No second registration needed.


@app.get("/")
async def root():
    return {
        "platform": "FaceSnap Cinematic AI OS",
        "status": "online",
        "version": "1.0.0",
        "architecture": "FastAPI + Supabase PostgreSQL + pgvector + PyTorch"
    }

# --- Realtime WebSocket Connection Manager ---
class WebSocketManager:
    def __init__(self):
        # Maps event_id -> list of active websockets
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, event_id: str, websocket: WebSocket):
        await websocket.accept()
        if event_id not in self.active_connections:
            self.active_connections[event_id] = []
        self.active_connections[event_id].append(websocket)
        logger.info(f"WebSocket connected for Event {event_id}. Total active: {len(self.active_connections[event_id])}")

    def disconnect(self, event_id: str, websocket: WebSocket):
        if event_id in self.active_connections:
            self.active_connections[event_id].remove(websocket)
            if not self.active_connections[event_id]:
                del self.active_connections[event_id]
            logger.info(f"WebSocket disconnected for Event {event_id}.")

    async def broadcast_event_log(self, event_id: str, log_message: dict):
        if event_id in self.active_connections:
            for connection in self.active_connections[event_id]:
                try:
                    await connection.send_json(log_message)
                except Exception as e:
                    logger.error(f"Error broadcasting WebSocket message: {e}")

ws_manager = WebSocketManager()

@app.websocket("/ws/events/{event_id}")
async def websocket_endpoint(websocket: WebSocket, event_id: str):
    await ws_manager.connect(event_id, websocket)
    try:
        # Keep connection open and listen for client messages (if any)
        while True:
            data = await websocket.receive_text()
            # Simple heartbeat echo
            await websocket.send_json({"type": "heartbeat", "data": "pong"})
    except WebSocketDisconnect:
        ws_manager.disconnect(event_id, websocket)


# --- Performance Rate Limiting & Health Check Diagnostics ---
import time
import datetime
from fastapi import Request
from fastapi.responses import JSONResponse
from jose import jwt
from app.config import settings

class TokenBucketRateLimiter:
    def __init__(self):
        self.buckets: Dict[tuple, Dict[str, float]] = {}

    def is_allowed(self, key: str, endpoint_type: str, rate: float, capacity: float) -> bool:
        now = time.time()
        bucket_key = (key, endpoint_type)
        if bucket_key not in self.buckets:
            self.buckets[bucket_key] = {"tokens": capacity, "last_updated": now}
            return True

        bucket = self.buckets[bucket_key]
        elapsed = now - bucket["last_updated"]
        bucket["last_updated"] = now
        
        bucket["tokens"] = min(capacity, bucket["tokens"] + elapsed * rate)

        if bucket["tokens"] >= 1.0:
            bucket["tokens"] -= 1.0
            return True
        return False

rate_limiter = TokenBucketRateLimiter()

@app.middleware("http")
async def performance_and_rate_limit_middleware(request: Request, call_next):
    try:
        path = request.url.path
        ip = request.headers.get("X-Test-IP") or (request.client.host if request.client else "unknown_ip")

        # Redirect HTTP to HTTPS in production
        if settings.ENVIRONMENT == "production" and request.headers.get("x-forwarded-proto", request.url.scheme) == "http":
            from fastapi.responses import RedirectResponse
            url = str(request.url).replace("http://", "https://", 1)
            return RedirectResponse(url, status_code=301)
    
        # Extract user key if JWT token is present in Authorization header
        auth_header = request.headers.get("Authorization")
        user_key = ip
        user_role = "user"
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
            try:
                payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM], options={"verify_exp": False, "leeway": 60})
                user_id = payload.get("sub")
                if user_id:
                    user_key = f"user_{user_id}"
                    # In a real app we'd query the DB for the role, but for maintenance middleware
                    # we'll allow /api/v1/admin/* routes to bypass maintenance if they have a token.
            except Exception:
                pass

        # --- Maintenance Mode Check ---
        if path.startswith("/api/") and not path.startswith("/api/v1/auth") and not path.startswith("/api/v1/admin"):
            try:
                from app.database import AsyncSessionLocal
                from app.models import SystemSettings
                from sqlalchemy import select
                async with AsyncSessionLocal() as db:
                    result = await db.execute(select(SystemSettings).limit(1))
                    settings_record = result.scalars().first()
                    if settings_record and settings_record.maintenance_mode:
                        return JSONResponse(
                            status_code=503,
                            content={"detail": "Maintenance Mode is active. Platform is temporarily unavailable."}
                        )
            except Exception:
                pass

        # Security Hardening: Banned IP check
        from app.services.cache_service import cache
        is_banned = False
        try:
            if cache.redis_client:
                is_banned = bool(cache.redis_client.get(f"banned_ip:{ip}"))
            else:
                is_banned = bool(cache.get(f"banned_ip:{ip}"))
        except Exception:
            pass
            
        if is_banned:
            return JSONResponse(
                status_code=403,
                content={"detail": "Access Denied: Your IP address has been blacklisted for security violations."}
            )

        # Enforce specific rate limits per route type (bypass for localhost)
        if ip not in ("127.0.0.1", "localhost", "::1"):
            if "/api/v1/auth/login" in path:
                if not rate_limiter.is_allowed(ip, "login", rate=20.0 / 3600.0, capacity=20.0):
                    try:
                        from app.database import AsyncSessionLocal
                        from app.models import SecurityIncident
                        async def log_login_limit():
                            async with AsyncSessionLocal() as db:
                                incident = SecurityIncident(
                                    incident_type="rate_limit",
                                    severity="medium",
                                    ip_address=ip,
                                    description="Brute force login rate limit hit (20 attempts/hour)."
                                )
                                db.add(incident)
                                await db.commit()
                        import asyncio
                        asyncio.create_task(log_login_limit())
                    except Exception:
                        pass
                    return JSONResponse(
                        status_code=429,
                        content={"detail": "Too many login attempts. Please try again in 1 hour."}
                    )
                    
            elif "/api/v1/auth/signup" in path:
                if not rate_limiter.is_allowed(ip, "signup", rate=3.0 / 900.0, capacity=3.0):
                    return JSONResponse(
                        status_code=429,
                        content={"detail": "Too many registration attempts. Please try again in 15 minutes."}
                    )
                    
            elif "/join-request" in path and request.method == "POST":
                if not rate_limiter.is_allowed(user_key, "join_request", rate=10.0 / 3600.0, capacity=10.0):
                    return JSONResponse(
                        status_code=429,
                        content={"detail": "Too many join requests. Max 10 requests per hour."}
                    )
                    
            elif "/join-by-code" in path and request.method == "POST":
                is_qr = request.query_params.get("src") == "qr"
                if is_qr:
                    if not rate_limiter.is_allowed(ip, "qr_redemption", rate=100.0 / 3600.0, capacity=100.0):
                        return JSONResponse(
                            status_code=429,
                            content={"detail": "Too many QR code redemption attempts. Max 100 per hour."}
                        )
                else:
                    if not rate_limiter.is_allowed(ip, "invite_redemption", rate=50.0 / 3600.0, capacity=50.0):
                        return JSONResponse(
                            status_code=429,
                            content={"detail": "Too many invite redemption attempts. Max 50 per hour."}
                        )
                    
            elif "/api/v1/search" in path:
                if not rate_limiter.is_allowed(user_key, "search", rate=1.0, capacity=60.0):
                    return JSONResponse(
                        status_code=429,
                        content={"detail": "Search rate limit exceeded (max 60 queries/minute)."}
                    )
                    
            elif "/api/v1/messages" in path and request.method == "POST":
                if not rate_limiter.is_allowed(user_key, "messages", rate=0.5, capacity=30.0):
                    return JSONResponse(
                        status_code=429,
                        content={"detail": "Messaging rate limit exceeded (max 30 messages/minute)."}
                    )
                    
            elif "/api/v1/uploads" in path:
                if not rate_limiter.is_allowed(user_key, "uploads", rate=10.0 / 60.0, capacity=10.0):
                    return JSONResponse(
                        status_code=429,
                        content={"detail": "Upload batch limit exceeded (max 10 batches/minute)."}
                    )
                    
            elif "/api/v1/verification" in path or "/api/v1/verify" in path:
                if not rate_limiter.is_allowed(user_key, "verification", rate=10.0 / 600.0, capacity=10.0):
                    try:
                        from app.database import AsyncSessionLocal
                        from app.models import SecurityIncident
                        async def log_verify_limit():
                            async with AsyncSessionLocal() as db:
                                incident = SecurityIncident(
                                    incident_type="verification_abuse",
                                    severity="medium",
                                    ip_address=ip,
                                    description=f"Face verification rate limit hit (10 attempts/10 minutes) for user: {user_key}."
                                )
                                db.add(incident)
                                await db.commit()
                        import asyncio
                        asyncio.create_task(log_verify_limit())
                    except Exception:
                        pass
                    return JSONResponse(
                        status_code=429,
                        content={"detail": "Too many verification attempts. Please try again in 10 minutes."}
                    )

        start_time = time.time()
        response = await call_next(request)
        duration_ms = (time.time() - start_time) * 1000

        # Inject Security Hardening HTTP Headers
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Permissions-Policy"] = "camera=(self), geolocation=(), microphone=()"
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https://*.supabase.co https://*.supabase.in; connect-src 'self' ws: wss: https://*.supabase.co https://*.supabase.in;"

        # Log metrics inside background task if > 500ms or search/messages route
        if duration_ms > 500 or any(p in path for p in ["/search", "/messages"]):
            try:
                from app.database import AsyncSessionLocal
                from app.models import PerformanceMetric

                async def log_perf():
                    async with AsyncSessionLocal() as db:
                        metric = PerformanceMetric(
                            endpoint=path,
                            method=request.method,
                            duration_ms=duration_ms,
                            query_count=0
                        )
                        db.add(metric)
                        await db.commit()
                
                import asyncio
                asyncio.create_task(log_perf())
            except Exception as e:
                pass

        # Log to ApiMetric for EVERY request in the background (Module 3 & 4)
        try:
            from app.database import AsyncSessionLocal
            from app.models import ApiMetric
            from uuid import UUID

            user_uuid = None
            if user_key and user_key.startswith("user_"):
                try:
                    user_uuid = UUID(user_key.replace("user_", ""))
                except Exception:
                    pass

            async def log_api_metric():
                async with AsyncSessionLocal() as db:
                    metric = ApiMetric(
                        endpoint=path,
                        method=request.method,
                        duration_ms=duration_ms,
                        status_code=response.status_code,
                        user_id=user_uuid,
                        ip_address=ip
                    )
                    db.add(metric)
                    await db.commit()

            import asyncio
            asyncio.create_task(log_api_metric())
        except Exception:
            pass

        return response
    except Exception as e:
        logger.exception("Unhandled middleware exception")
        headers = {
            "Access-Control-Allow-Origin": request.headers.get("origin", "http://localhost:3000"),
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error"},
            headers=headers
        )

@app.get("/api/v1/health")
async def health_check():
    """
    Ecosystem diagnostic endpoint tracking database, cache, and platform metrics.
    """
    db_status = "healthy"
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        db_status = "unhealthy"

    return {
        "status": "healthy" if db_status == "healthy" else "unhealthy",
        "database": db_status,
        "cache": "connected",
        "version": "5.0",
        "timestamp": datetime.datetime.utcnow().isoformat()
    }

@app.get("/api/v1/ready")
async def ready_check():
    """
    Ready probe checking database, Redis, and Supabase connectivity.
    """
    import requests
    # 1. Check database connectivity
    try:
        async with engine.begin() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"Ready probe database check failed: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Database connection failed")

    # 2. Check Redis connectivity
    try:
        from app.services.cache_service import cache
        if cache.redis_client:
            cache.redis_client.ping()
        else:
            import redis
            r = redis.from_url(settings.REDIS_URL)
            r.ping()
    except Exception as e:
        logger.error(f"Ready probe Redis check failed: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Redis connection failed")

    # 3. Check Supabase connectivity
    try:
        base_url = f"{settings.SUPABASE_URL}/storage/v1"
        headers = {
            "Authorization": f"Bearer {settings.SUPABASE_KEY}",
            "apikey": settings.SUPABASE_KEY
        }
        check_url = f"{base_url}/bucket/{settings.SUPABASE_BUCKET}"
        response = requests.get(check_url, headers=headers, timeout=5)
        if response.status_code not in (200, 404):
            raise Exception(f"Supabase responded with status {response.status_code}")
    except Exception as e:
        logger.error(f"Ready probe Supabase check failed: {e}")
        from fastapi import HTTPException
        raise HTTPException(status_code=503, detail="Supabase connection failed")

    return {"status": "ready"}

