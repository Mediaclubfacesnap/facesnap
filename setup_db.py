import asyncio
import asyncpg
import sys
import os
from dotenv import load_dotenv

# Load environment variables from local .env file
load_dotenv()

# Safely extract Database Connection URL from environment
RAW_DB_URL = os.getenv("DATABASE_URL")
if RAW_DB_URL:
    # asyncpg expects a raw postgresql:// protocol, so we convert any asyncpg-specific prefix
    if RAW_DB_URL.startswith("postgresql+asyncpg://"):
        DB_URL = RAW_DB_URL.replace("postgresql+asyncpg://", "postgresql://")
    else:
        DB_URL = RAW_DB_URL
    print("Database connection string dynamically resolved from local .env file!")
else:
    # Safe static fallback for standard setup
    DB_URL = "postgresql://postgres.bcahxnvuodsslmeqdnin:Mediaclubfacesnap@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres"
    print("No DATABASE_URL environment variable resolved. Using standard fallback connection string.")

MIGRATION_SQL = """
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing tables to start fresh and clean
DROP TABLE IF EXISTS verification_sessions CASCADE;
DROP TABLE IF EXISTS invitations CASCADE;
DROP TABLE IF EXISTS contributor_requests CASCADE;
DROP TABLE IF EXISTS photo_faces CASCADE;
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS community_roles CASCADE;
DROP TABLE IF EXISTS communities CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS community_stars CASCADE;

-- Create Users Table with Unique Username
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Communities Table (Groups)
CREATE TABLE communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    logo_url TEXT,
    banner_url TEXT,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Community Roles (Permissions)
CREATE TABLE community_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    role TEXT CHECK (role IN ('host', 'admin', 'contributor', 'gallery_access', 'member_access', 'member')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(community_id, user_id)
);

-- Create Contributor Requests
CREATE TABLE contributor_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    request_type TEXT CHECK (request_type IN ('contributor', 'upload', 'gallery', 'member')) DEFAULT 'gallery' NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(community_id, user_id, request_type)
);

-- Create Events Table scoped under Groups
CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    date DATE NOT NULL,
    status TEXT CHECK (status IN ('draft', 'uploading', 'processing', 'live', 'archived')) DEFAULT 'draft' NOT NULL,
    banner_url TEXT,
    creator_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Photos Table
CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    storage_path TEXT NOT NULL,
    filename TEXT NOT NULL,
    status TEXT CHECK (status IN ('processing', 'indexed', 'failed')) DEFAULT 'processing' NOT NULL,
    hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Unique Index on event_id and hash where hash is not null
CREATE UNIQUE INDEX IF NOT EXISTS uq_event_photo_hash ON photos (event_id, hash) WHERE hash IS NOT NULL;

-- Create Photo Faces Table (pgvector 512-D vectors)
CREATE TABLE photo_faces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID REFERENCES photos(id) ON DELETE CASCADE NOT NULL,
    bbox INTEGER[] NOT NULL, -- [ymin, xmin, ymax, xmax]
    embedding vector(512) NOT NULL, -- 512-dimensional face embedding
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Verification Sessions Table with complete audit and vector embedding columns
CREATE TABLE verification_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'verified', 'failed')) DEFAULT 'pending' NOT NULL,
    liveness_score FLOAT DEFAULT 0.0 NOT NULL,
    matched_photos_count INTEGER DEFAULT 0 NOT NULL,
    average_confidence FLOAT DEFAULT 0.0 NOT NULL,
    processing_time_ms INTEGER DEFAULT 0 NOT NULL,
    ip_address TEXT,
    device_info TEXT,
    face_embedding vector(512),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Invitations Table
CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE NOT NULL,
    inviter_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    invitee_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    status TEXT CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')) DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(community_id, invitee_id)
);

-- Create Community Stars Table
CREATE TABLE community_stars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(community_id, user_id)
);

-- Create HNSW Index
CREATE INDEX IF NOT EXISTS photo_faces_embedding_idx ON photo_faces USING hnsw (embedding vector_cosine_ops);
"""

async def run():
    # Hide raw password credentials from console output
    masked_url = DB_URL
    if "@" in DB_URL:
        protocol_part, credential_host = DB_URL.split("@", 1)
        if ":" in protocol_part:
            protocol, credentials = protocol_part.split(":", 1)
            masked_url = f"{protocol}:***@{credential_host}"

    print(f"Connecting to Database at {masked_url}...")
    try:
        conn = await asyncpg.connect(DB_URL, timeout=30, statement_cache_size=0)

    except Exception as e:
        print(f"Error connecting to database: {e}", file=sys.stderr)
        return

    print("Deploying updated private group-based database schema...")
    try:
        await conn.execute(MIGRATION_SQL)
        print("Schema successfully deployed!")
        
        # Verify vector extension and tables
        val = await conn.fetchval("SELECT extname FROM pg_extension WHERE extname = 'vector'")
        if val == 'vector':
            print("Verified: pgvector extension is ENABLED!")
        
        tables = await conn.fetch("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
        print(f"Verified: {len(tables)} tables created in public schema:")
        for t in tables:
            print(f" - {t['table_name']}")
            
    except Exception as e:
        print(f"Error executing migration: {e}", file=sys.stderr)
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(run())
