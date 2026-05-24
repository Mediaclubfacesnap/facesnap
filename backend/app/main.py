from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import logging
from typing import Dict, List
from app.routes import auth, communities, events, uploads, verification
from sqlalchemy import text
from app.database import engine

# Initialize Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="FaceSnap AI Memory Retrieval OS API",
    description="Futuristic AI-native memory retrieval platform backend, featuring pgvector HNSW indexing, Supabase Storage, and PyTorch MTCNN liveness pipelines.",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Configure CORS for Next.js Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins in development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Run Database Schema Synchronizations on Startup
@app.on_event("startup")
async def startup_event():
    logger.info("Executing automated database schema synchronization...")
    try:
        async with engine.begin() as conn:
            # Add hash column if not exists
            await conn.execute(text("ALTER TABLE photos ADD COLUMN IF NOT EXISTS hash TEXT;"))
            # Create unique index if not exists on (event_id, hash)
            await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_event_photo_hash ON photos (event_id, hash) WHERE hash IS NOT NULL;"))
            # Add recognition history columns to verification_sessions
            await conn.execute(text("ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS matched_photos_count INTEGER DEFAULT 0;"))
            await conn.execute(text("ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS average_confidence FLOAT DEFAULT 0.0;"))
            await conn.execute(text("ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER DEFAULT 0;"))
            await conn.execute(text("ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;"))
            await conn.execute(text("ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS device_info TEXT;"))
            await conn.execute(text("ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS face_embedding vector(512);"))
        logger.info("Database schema synchronization successfully complete!")
    except Exception as e:
        logger.error(f"Startup database schema synchronization failed: {e}")

# Include API Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(communities.router, prefix="/api/v1")
app.include_router(events.router, prefix="/api/v1")
app.include_router(uploads.router, prefix="/api/v1")
app.include_router(verification.router, prefix="/api/v1")

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
