import asyncio
import logging
from sqlalchemy import text
from app.database import engine, Base
import app.models

logger = logging.getLogger(__name__)

async def migrate():
    logger.info("Executing manual database schema synchronization...")

    # Step 0: Ensure PostgreSQL extensions exist
    extensions = [
        "CREATE EXTENSION IF NOT EXISTS pgcrypto;",
        "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";",
    ]
    for ext_sql in extensions:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(ext_sql))
        except Exception as e:
            logger.warning(f"Extension creation skipped (non-fatal): {ext_sql!r} — {e}")

    logger.info("Initializing database and AI pipelines...")
    try:
        # Run necessary migrations directly
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE;"))
            await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_opened BOOLEAN DEFAULT FALSE;"))
            await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_clicked BOOLEAN DEFAULT FALSE;"))
            await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_dismissed BOOLEAN DEFAULT FALSE;"))
            await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS opened_at TIMESTAMP WITH TIME ZONE;"))
            await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMP WITH TIME ZONE;"))
            await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMP WITH TIME ZONE;"))
            await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_sent BOOLEAN DEFAULT FALSE;"))
            await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;"))

        # Step 1: Create any completely missing tables (checkfirst=True skips existing ones safely)
        async with engine.begin() as conn:
            await conn.run_sync(lambda sync_conn: Base.metadata.create_all(sync_conn, checkfirst=True))
        logger.info("create_all completed.")
    except Exception as e:
        logger.error(f"create_all failed: {e}")

    # Step 1c: Explicitly alter notifications to add message column (migration v5)
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS message TEXT;"))
            await conn.execute(text("UPDATE notifications SET message = '' WHERE message IS NULL;"))
        logger.info("Migration v5 (notifications.message) inline applied successfully.")
    except Exception as e:
        logger.error(f"Migration v5 inline failed: {e}")

    # Step 1b: Explicit fallback table creation for critical tables that may have been
    #          missed if create_all failed (e.g. due to pgvector extension issues on other tables)
    fallback_tables = [
        """CREATE TABLE IF NOT EXISTS community_access_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            full_name VARCHAR(255),
            email VARCHAR(255),
            college VARCHAR(255),
            purpose TEXT,
            reason TEXT NOT NULL,
            status VARCHAR(50) DEFAULT 'pending' NOT NULL,
            reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
            reviewed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS event_access_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
            status VARCHAR(50) DEFAULT 'pending' NOT NULL,
            reason TEXT NOT NULL,
            reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
            reviewed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            action VARCHAR(255) NOT NULL,
            target VARCHAR(255),
            target_id UUID,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS community_join_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(50) DEFAULT 'pending' NOT NULL,
            message TEXT,
            reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
            reviewed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS community_announcements (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS event_registrations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(50) DEFAULT 'registered' NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            UNIQUE(event_id, user_id)
        );""",
        """CREATE TABLE IF NOT EXISTS event_waitlist (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            position INTEGER NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            UNIQUE(event_id, user_id)
        );""",
        """CREATE TABLE IF NOT EXISTS notifications (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS community_chat_messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
            channel VARCHAR(255) NOT NULL,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS event_discussions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS user_points_ledger (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            points INTEGER NOT NULL,
            action VARCHAR(255) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS user_badges (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            badge_type VARCHAR(255) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS media_albums (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            cover_url TEXT,
            created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS community_media (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
            album_id UUID REFERENCES media_albums(id) ON DELETE SET NULL,
            uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            file_url TEXT NOT NULL,
            file_type VARCHAR(50) DEFAULT 'photo' NOT NULL,
            title VARCHAR(255),
            description TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS photo_face_matches (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            media_id UUID REFERENCES community_media(id) ON DELETE CASCADE,
            photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            confidence_score DOUBLE PRECISION NOT NULL,
            is_verified_match BOOLEAN DEFAULT TRUE NOT NULL,
            status VARCHAR(50) DEFAULT 'pending' NOT NULL,
            is_favorite BOOLEAN DEFAULT FALSE NOT NULL,
            is_hidden BOOLEAN DEFAULT FALSE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            CHECK (media_id IS NOT NULL OR photo_id IS NOT NULL),
            UNIQUE(media_id, user_id),
            UNIQUE(photo_id, user_id)
        );""",
        """CREATE TABLE IF NOT EXISTS conversations (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            last_message_id UUID
        );""",
        """CREATE TABLE IF NOT EXISTS conversation_participants (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            last_read_message_id UUID,
            archived_at TIMESTAMPTZ,
            is_pinned BOOLEAN DEFAULT FALSE NOT NULL,
            UNIQUE(conversation_id, user_id)
        );""",
        """CREATE TABLE IF NOT EXISTS messages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
            sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            message_type VARCHAR(50) DEFAULT 'text' NOT NULL,
            shared_item_id UUID,
            is_read BOOLEAN DEFAULT FALSE NOT NULL,
            read_at TIMESTAMPTZ,
            edited_at TIMESTAMPTZ,
            deleted_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS message_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            status VARCHAR(50) DEFAULT 'pending' NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            UNIQUE(sender_id, receiver_id)
        );""",
        """CREATE TABLE IF NOT EXISTS blocked_users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            UNIQUE(blocker_id, blocked_id)
        );""",
        """CREATE TABLE IF NOT EXISTS message_reactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            reaction VARCHAR(255) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            UNIQUE(message_id, user_id)
        );""",
        """CREATE TABLE IF NOT EXISTS search_history (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            query VARCHAR(255) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS saved_searches (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            query VARCHAR(255) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS performance_metrics (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            endpoint VARCHAR(255) NOT NULL,
            method VARCHAR(50) NOT NULL,
            duration_ms FLOAT NOT NULL,
            query_count INTEGER,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS background_jobs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            task_id VARCHAR(255),
            task_name VARCHAR(255) NOT NULL,
            queue_name VARCHAR(255) DEFAULT 'default' NOT NULL,
            status VARCHAR(50) DEFAULT 'queued' NOT NULL,
            priority INTEGER DEFAULT 5 NOT NULL,
            queued_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            started_at TIMESTAMPTZ,
            completed_at TIMESTAMPTZ,
            initiated_by UUID REFERENCES users(id) ON DELETE SET NULL,
            worker_name VARCHAR(255),
            progress INTEGER DEFAULT 0 NOT NULL,
            progress_message VARCHAR(255),
            result JSONB,
            error_message TEXT,
            retry_count INTEGER DEFAULT 0 NOT NULL,
            max_retries INTEGER DEFAULT 3 NOT NULL,
            parent_job_id UUID REFERENCES background_jobs(id) ON DELETE SET NULL,
            depends_on_job_id UUID REFERENCES background_jobs(id) ON DELETE SET NULL,
            meta JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS security_incidents (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            incident_type VARCHAR(255) NOT NULL,
            severity VARCHAR(50) DEFAULT 'low' NOT NULL,
            ip_address VARCHAR(255),
            description TEXT NOT NULL,
            meta JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS push_subscriptions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            endpoint TEXT NOT NULL UNIQUE,
            p256dh TEXT NOT NULL,
            auth TEXT NOT NULL,
            user_agent TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS memory_collections (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            memory_type VARCHAR(50) NOT NULL,
            cover_photo_id UUID,
            memory_date TIMESTAMPTZ,
            memory_score FLOAT DEFAULT 0.0 NOT NULL,
            best_photo_id UUID,
            most_smiles_photo_id UUID,
            group_photo_id UUID,
            photo_count INTEGER DEFAULT 0 NOT NULL,
            people_count INTEGER DEFAULT 0 NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS memory_photos (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            memory_id UUID NOT NULL REFERENCES memory_collections(id) ON DELETE CASCADE,
            photo_id UUID NOT NULL,
            confidence_score FLOAT DEFAULT 1.0 NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS memory_persons (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            memory_id UUID NOT NULL REFERENCES memory_collections(id) ON DELETE CASCADE,
            person_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            appearance_count INTEGER DEFAULT 1 NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS user_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            jti VARCHAR(255) UNIQUE NOT NULL,
            device_name VARCHAR(255),
            browser VARCHAR(100),
            os VARCHAR(100),
            ip_address VARCHAR(100),
            country VARCHAR(100),
            city VARCHAR(100),
            last_active TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            is_current BOOLEAN DEFAULT FALSE NOT NULL,
            is_revoked BOOLEAN DEFAULT FALSE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS login_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            ip_address VARCHAR(100),
            device VARCHAR(255),
            browser VARCHAR(100),
            os VARCHAR(100),
            country VARCHAR(100),
            city VARCHAR(100),
            success BOOLEAN DEFAULT TRUE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        """CREATE TABLE IF NOT EXISTS security_alerts (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            alert_type VARCHAR(100) NOT NULL,
            severity VARCHAR(50) DEFAULT 'LOW' NOT NULL,
            message TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
    ]
    for tbl_sql in fallback_tables:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(tbl_sql))
        except Exception as e:
            logger.warning(f"Fallback table creation skipped (non-fatal): {e}")

    # Step 2: Run each ALTER / UPDATE in its own connection so one failure never
    #         blocks subsequent migrations.
    migrations = [
        # communities – extra columns added after initial creation
        "ALTER TABLE communities ADD COLUMN IF NOT EXISTS created_by UUID;",
        "ALTER TABLE communities ADD COLUMN IF NOT EXISTS host_id UUID;",
        "ALTER TABLE communities ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE communities ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;",
        # events – extra columns
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS created_by UUID;",
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS organizer_id UUID;",
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS cover_url TEXT;",
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;",
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS max_participants INTEGER;",
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMPTZ;",
        "ALTER TABLE events ADD COLUMN IF NOT EXISTS category VARCHAR(100);",
        # users - 2FA and security
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(255);",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes TEXT[];",
        # audit_logs
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS target VARCHAR(255);",
        # photos
        "ALTER TABLE photos ADD COLUMN IF NOT EXISTS hash TEXT;",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_event_photo_hash ON photos (event_id, hash) WHERE hash IS NOT NULL;",
        # verification_sessions
        "ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS matched_photos_count INTEGER DEFAULT 0;",
        "ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS average_confidence FLOAT DEFAULT 0.0;",
        "ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER DEFAULT 0;",
        "ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;",
        "ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS device_info TEXT;",
        "ALTER TABLE verification_sessions ADD COLUMN IF NOT EXISTS face_embedding vector(512);",
        # users – RBAC columns
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_role VARCHAR(50) DEFAULT 'user';",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_create_communities BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS can_create_events BOOLEAN DEFAULT FALSE;",
        "UPDATE users SET platform_role = 'user' WHERE platform_role IS NULL;",
        "UPDATE users SET can_create_communities = FALSE WHERE can_create_communities IS NULL;",
        "UPDATE users SET can_create_events = FALSE WHERE can_create_events IS NULL;",
        # community_access_requests – extra columns added after initial creation
        "ALTER TABLE community_access_requests ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);",
        "ALTER TABLE community_access_requests ADD COLUMN IF NOT EXISTS email VARCHAR(255);",
        "ALTER TABLE community_access_requests ADD COLUMN IF NOT EXISTS college VARCHAR(255);",
        "ALTER TABLE community_access_requests ADD COLUMN IF NOT EXISTS purpose TEXT;",
        # users – privacy preference columns
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS face_matching_enabled BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS match_notifications_enabled BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS community_discovery_enabled BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS hide_matches_from_analytics BOOLEAN DEFAULT FALSE;",
        "UPDATE users SET face_matching_enabled = TRUE WHERE face_matching_enabled IS NULL;",
        "UPDATE users SET match_notifications_enabled = TRUE WHERE match_notifications_enabled IS NULL;",
        "UPDATE users SET community_discovery_enabled = TRUE WHERE community_discovery_enabled IS NULL;",
        "UPDATE users SET hide_matches_from_analytics = FALSE WHERE hide_matches_from_analytics IS NULL;",
        # users – Phase 4C notification preferences
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS community_match_notifications_enabled BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS event_match_notifications_enabled BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_digest_enabled BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications_enabled BOOLEAN DEFAULT TRUE;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS push_notifications_enabled BOOLEAN DEFAULT TRUE;",
        "UPDATE users SET community_match_notifications_enabled = TRUE WHERE community_match_notifications_enabled IS NULL;",
        "UPDATE users SET event_match_notifications_enabled = TRUE WHERE event_match_notifications_enabled IS NULL;",
        "UPDATE users SET weekly_digest_enabled = TRUE WHERE weekly_digest_enabled IS NULL;",
        "UPDATE users SET email_notifications_enabled = TRUE WHERE email_notifications_enabled IS NULL;",
        "UPDATE users SET push_notifications_enabled = TRUE WHERE push_notifications_enabled IS NULL;",
        # notifications – Phase 4C enrichments
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_type VARCHAR(50);",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE CASCADE;",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE CASCADE;",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS match_count INTEGER DEFAULT 1;",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS media_ids JSONB;",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_url TEXT;",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_opened BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_clicked BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium';",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS notification_dismissed BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ;",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_sent BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;",
        # media_albums – Phase 4D Highlights Columns
        "ALTER TABLE media_albums ADD COLUMN IF NOT EXISTS is_highlights BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE media_albums ADD COLUMN IF NOT EXISTS generated_by_ai BOOLEAN DEFAULT FALSE;",
        "ALTER TABLE media_albums ADD COLUMN IF NOT EXISTS cover_media_id UUID;",
        "ALTER TABLE media_albums ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE CASCADE;",
        # community_media – Phase 4D Quality & Pinning Columns
        "ALTER TABLE community_media ADD COLUMN IF NOT EXISTS sharpness_score FLOAT DEFAULT 0.0;",
        "ALTER TABLE community_media ADD COLUMN IF NOT EXISTS blur_score FLOAT DEFAULT 0.0;",
        "ALTER TABLE community_media ADD COLUMN IF NOT EXISTS brightness_score FLOAT DEFAULT 0.0;",
        "ALTER TABLE community_media ADD COLUMN IF NOT EXISTS face_visibility_score FLOAT DEFAULT 0.0;",
        "ALTER TABLE community_media ADD COLUMN IF NOT EXISTS smile_score FLOAT DEFAULT 0.0;",
        "ALTER TABLE community_media ADD COLUMN IF NOT EXISTS composition_score FLOAT DEFAULT 0.0;",
        "ALTER TABLE community_media ADD COLUMN IF NOT EXISTS eye_open_score FLOAT DEFAULT 0.0;",
        "ALTER TABLE community_media ADD COLUMN IF NOT EXISTS overall_score FLOAT DEFAULT 0.0;",
        "ALTER TABLE community_media ADD COLUMN IF NOT EXISTS quality_reason TEXT;",
        "ALTER TABLE community_media ADD COLUMN IF NOT EXISTS is_pinned_highlight BOOLEAN DEFAULT FALSE;",
        # photos – Phase 4D Quality & Pinning Columns
        "ALTER TABLE photos ADD COLUMN IF NOT EXISTS sharpness_score FLOAT DEFAULT 0.0;",
        "ALTER TABLE photos ADD COLUMN IF NOT EXISTS blur_score FLOAT DEFAULT 0.0;",
        "ALTER TABLE photos ADD COLUMN IF NOT EXISTS brightness_score FLOAT DEFAULT 0.0;",
        "ALTER TABLE photos ADD COLUMN IF NOT EXISTS face_visibility_score FLOAT DEFAULT 0.0;",
        "ALTER TABLE photos ADD COLUMN IF NOT EXISTS smile_score FLOAT DEFAULT 0.0;",
        "ALTER TABLE photos ADD COLUMN IF NOT EXISTS composition_score FLOAT DEFAULT 0.0;",
        "ALTER TABLE photos ADD COLUMN IF NOT EXISTS eye_open_score FLOAT DEFAULT 0.0;",
        "ALTER TABLE photos ADD COLUMN IF NOT EXISTS overall_score FLOAT DEFAULT 0.0;",
        "ALTER TABLE photos ADD COLUMN IF NOT EXISTS quality_reason TEXT;",
        "ALTER TABLE photos ADD COLUMN IF NOT EXISTS is_pinned_highlight BOOLEAN DEFAULT FALSE;",
        # highlight_generation_logs – Phase 4D Log Table
        "CREATE TABLE IF NOT EXISTS highlight_generation_logs (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), album_id UUID REFERENCES media_albums(id) ON DELETE CASCADE, community_id UUID REFERENCES communities(id) ON DELETE CASCADE, event_id UUID REFERENCES events(id) ON DELETE CASCADE, generated_by UUID REFERENCES users(id) ON DELETE SET NULL, photos_analyzed INTEGER DEFAULT 0 NOT NULL, photos_selected INTEGER DEFAULT 0 NOT NULL, duplicates_removed INTEGER DEFAULT 0 NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL);",
        # users – direct messaging status columns
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ DEFAULT NOW() NOT NULL;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE NOT NULL;",
        "UPDATE users SET is_online = FALSE WHERE is_online IS NULL;",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by_users JSONB DEFAULT '[]'::jsonb;",
        # search – database indexes for search acceleration
        "CREATE INDEX IF NOT EXISTS idx_search_hist_user ON search_history (user_id);",
        "CREATE INDEX IF NOT EXISTS idx_saved_search_user ON saved_searches (user_id);",
        "CREATE INDEX IF NOT EXISTS idx_users_search_fields ON users (username, full_name);",
        # Phase 5A: Missing structural indexes
        "CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);",
        "CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);",
        "CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);",
        "CREATE INDEX IF NOT EXISTS idx_event_registrations_event ON event_registrations(event_id);",
        "CREATE INDEX IF NOT EXISTS idx_event_registrations_user ON event_registrations(user_id);",
        "CREATE INDEX IF NOT EXISTS idx_photo_face_matches_user ON photo_face_matches(user_id);",
        "CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);",
        # Phase 5A: Full-Text Search GIN Indexes
        "CREATE INDEX IF NOT EXISTS idx_communities_search_gin ON communities USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));",
        "CREATE INDEX IF NOT EXISTS idx_events_search_gin ON events USING gin(to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '')));",
        "CREATE INDEX IF NOT EXISTS idx_messages_content_gin ON messages USING gin(to_tsvector('english', coalesce(content, '')));",
        # Phase 5C: New security columns
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INTEGER DEFAULT 0;",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS ip_address VARCHAR(255);",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS user_agent VARCHAR(255);",
        "ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb;",
        # Phase 5D: Observability & Monitoring tables
        """CREATE TABLE IF NOT EXISTS api_metrics (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            endpoint VARCHAR(255) NOT NULL,
            method VARCHAR(50) NOT NULL,
            duration_ms FLOAT NOT NULL,
            status_code INTEGER NOT NULL,
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            ip_address VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        "CREATE INDEX IF NOT EXISTS idx_api_metrics_created_at ON api_metrics(created_at);",
        """CREATE TABLE IF NOT EXISTS search_metrics (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            query VARCHAR(500) NOT NULL,
            duration_ms FLOAT NOT NULL,
            result_count INTEGER DEFAULT 0 NOT NULL,
            is_success BOOLEAN DEFAULT TRUE NOT NULL,
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        "CREATE INDEX IF NOT EXISTS idx_search_metrics_created_at ON search_metrics(created_at);",
        """CREATE TABLE IF NOT EXISTS error_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            message TEXT NOT NULL,
            traceback TEXT,
            endpoint VARCHAR(255),
            method VARCHAR(50),
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            ip_address VARCHAR(255),
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        "CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at);",
        """CREATE TABLE IF NOT EXISTS uptime_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            service VARCHAR(100) NOT NULL,
            status VARCHAR(100) DEFAULT 'healthy' NOT NULL,
            latency_ms FLOAT NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );""",
        "CREATE INDEX IF NOT EXISTS idx_uptime_logs_created_at ON uptime_logs(created_at);",
        """CREATE TABLE IF NOT EXISTS backup_records (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            backup_type VARCHAR(100) NOT NULL,
            backup_size BIGINT DEFAULT 0 NOT NULL,
            backup_location VARCHAR(255) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
            verified BOOLEAN DEFAULT FALSE NOT NULL,
            restore_tested BOOLEAN DEFAULT FALSE NOT NULL,
            status VARCHAR(100) DEFAULT 'success' NOT NULL,
            checksum VARCHAR(255),
            encryption_version VARCHAR(100) DEFAULT 'AES-256-Fernet' NOT NULL,
            restore_duration FLOAT,
            meta JSONB DEFAULT '{}'::jsonb
        );""",
        "CREATE INDEX IF NOT EXISTS idx_backup_records_created_at ON backup_records(created_at);",
    ]

    for sql in migrations:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(sql))
        except Exception as e:
            logger.warning(f"Migration skipped (non-fatal): {sql[:60]!r} — {e}")

    try:
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='community_access_requests';"))
            columns = [row[0] for row in result.fetchall()]
            logger.info(f"Verified community_access_requests columns: {columns}")
    except Exception as db_err:
        logger.error(f"Failed to verify community_access_requests schema: {db_err}")

    logger.info("Database schema synchronization complete.")

if __name__ == "__main__":
    asyncio.run(migrate())
