from sqlalchemy import Column, String, ForeignKey, Date, Float, Text, ARRAY, Integer, DateTime, UniqueConstraint, Boolean, text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
import datetime
import enum
from sqlalchemy import Enum as SQLEnum
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    platform_role = Column(String, default="user", nullable=False) # 'user', 'super_admin'
    can_create_communities = Column(Boolean, default=False, nullable=False)
    can_create_events = Column(Boolean, default=False, nullable=False)
    face_matching_enabled = Column(Boolean, default=True, nullable=False)
    match_notifications_enabled = Column(Boolean, default=True, nullable=False)
    community_discovery_enabled = Column(Boolean, default=True, nullable=False)
    hide_matches_from_analytics = Column(Boolean, default=False, nullable=False)
    community_match_notifications_enabled = Column(Boolean, default=True, nullable=False)
    event_match_notifications_enabled = Column(Boolean, default=True, nullable=False)
    weekly_digest_enabled = Column(Boolean, default=True, nullable=False)
    email_notifications_enabled = Column(Boolean, default=True, nullable=False)
    push_notifications_enabled = Column(Boolean, default=True, nullable=False)
    last_seen = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    is_online = Column(Boolean, default=False, nullable=False)
    failed_login_count = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    two_factor_enabled = Column(Boolean, default=False, nullable=False)
    totp_secret = Column(String, nullable=True)
    backup_codes = Column(ARRAY(String), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    roles = relationship("CommunityRole", back_populates="user", cascade="all, delete-orphan")
    communities_created = relationship("Community", back_populates="creator", foreign_keys="Community.creator_id")
    events_created = relationship("Event", back_populates="creator", foreign_keys="Event.creator_id")
    verification_sessions = relationship("VerificationSession", back_populates="user", cascade="all, delete-orphan")
    events_registered = relationship("EventRegistration", back_populates="user", cascade="all, delete-orphan")
    role_requests = relationship("RoleRequest", back_populates="user", cascade="all, delete-orphan")

class Community(Base):
    __tablename__ = "communities"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String, nullable=False)
    logo_url = Column(String, nullable=True)
    banner_url = Column(String, nullable=True)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    host_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    visibility = Column(String, default="PRIVATE", nullable=False)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    creator = relationship("User", back_populates="communities_created", foreign_keys=[creator_id])
    host = relationship("User", foreign_keys=[host_id])
    roles = relationship("CommunityRole", back_populates="community", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="community", cascade="all, delete-orphan")
    role_requests = relationship("RoleRequest", back_populates="community", cascade="all, delete-orphan")
    announcements = relationship("CommunityAnnouncement", back_populates="community", cascade="all, delete-orphan")

class CommunityRole(Base):
    __tablename__ = "community_roles"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=True) # 'host', 'admin', 'moderator', NULL
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("community_id", "user_id", name="uq_community_user_role"),)

    community = relationship("Community", back_populates="roles")
    user = relationship("User", back_populates="roles")

class RoleRequest(Base):
    __tablename__ = "role_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    request_type = Column(String, default="moderator", nullable=False) # 'moderator', 'admin', 'host'
    status = Column(String, default="pending", nullable=False) # 'pending', 'approved', 'rejected'
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("community_id", "user_id", "request_type", name="uq_community_user_request_type"),)

    community = relationship("Community", back_populates="role_requests")
    user = relationship("User", back_populates="role_requests")

class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    location = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String, default="draft", nullable=False) # 'draft', 'uploading', 'processing', 'live', 'archived'
    banner_url = Column(String, nullable=True)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    organizer_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    max_participants = Column(Integer, nullable=True)
    registration_deadline = Column(DateTime(timezone=True), nullable=True)
    category = Column(String, nullable=True)

    @property
    def cover_url(self):
        return self.banner_url

    community = relationship("Community", back_populates="events")
    creator = relationship("User", back_populates="events_created", foreign_keys=[creator_id])
    organizer = relationship("User", foreign_keys=[organizer_id])
    photos = relationship("Photo", back_populates="event", cascade="all, delete-orphan")
    verification_sessions = relationship("VerificationSession", back_populates="event", cascade="all, delete-orphan")
    registrations = relationship("EventRegistration", back_populates="event", cascade="all, delete-orphan")
    waitlist = relationship("EventWaitlist", back_populates="event", cascade="all, delete-orphan")

class Photo(Base):
    __tablename__ = "photos"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    storage_path = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    status = Column(String, default="processing", nullable=False) # 'processing', 'indexed', 'failed'
    hash = Column(String, nullable=True, index=True)
    sharpness_score = Column(Float, default=0.0, nullable=False)
    blur_score = Column(Float, default=0.0, nullable=False)
    brightness_score = Column(Float, default=0.0, nullable=False)
    face_visibility_score = Column(Float, default=0.0, nullable=False)
    smile_score = Column(Float, default=0.0, nullable=False)
    composition_score = Column(Float, default=0.0, nullable=False)
    eye_open_score = Column(Float, default=0.0, nullable=False)
    overall_score = Column(Float, default=0.0, nullable=False)
    quality_reason = Column(String, nullable=True)
    is_pinned_highlight = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    event = relationship("Event", back_populates="photos")
    faces = relationship("PhotoFace", back_populates="photo", cascade="all, delete-orphan")

class PhotoFace(Base):
    __tablename__ = "photo_faces"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    photo_id = Column(UUID(as_uuid=True), ForeignKey("photos.id", ondelete="CASCADE"), nullable=False)
    bbox = Column(ARRAY(Integer), nullable=False) # [ymin, xmin, ymax, xmax]
    embedding = Column(Vector(512), nullable=False) # 512-dimensional face embedding
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    photo = relationship("Photo", back_populates="faces")

class VerificationSession(Base):
    __tablename__ = "verification_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default="pending", nullable=False) # 'pending', 'verified', 'failed'
    liveness_score = Column(Float, default=0.0, nullable=False)
    matched_photos_count = Column(Integer, default=0, nullable=False)
    average_confidence = Column(Float, default=0.0, nullable=False)
    processing_time_ms = Column(Integer, default=0, nullable=False)  # milliseconds
    ip_address = Column(String, nullable=True)
    device_info = Column(String, nullable=True)
    face_embedding = Column(Vector(512), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="verification_sessions")
    event = relationship("Event", back_populates="verification_sessions")

class Invitation(Base):
    __tablename__ = "invitations"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    inviter_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    invitee_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default="pending", nullable=False) # 'pending', 'accepted', 'rejected', 'expired'
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    community = relationship("Community")
    inviter = relationship("User", foreign_keys=[inviter_id])
    invitee = relationship("User", foreign_keys=[invitee_id])

class CommunityStar(Base):
    __tablename__ = "community_stars"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("community_id", "user_id", name="uq_community_star"),)

class CommunityAccessRequest(Base):
    __tablename__ = "community_access_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default="pending", nullable=False) # 'pending', 'approved', 'rejected'
    full_name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    college = Column(String, nullable=True)
    purpose = Column(Text, nullable=True)
    reason = Column(Text, nullable=False)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])

class EventAccessRequest(Base):
    __tablename__ = "event_access_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default="pending", nullable=False) # 'pending', 'approved', 'rejected'
    reason = Column(Text, nullable=False)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    community = relationship("Community")
    reviewer = relationship("User", foreign_keys=[reviewed_by])

class CommunityJoinRequest(Base):
    __tablename__ = "community_join_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default="pending", nullable=False) # 'pending', 'approved', 'rejected'
    message = Column(Text, nullable=True)
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User", foreign_keys=[user_id])
    community = relationship("Community", foreign_keys=[community_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String, nullable=False)
    target = Column(String, nullable=True)
    target_id = Column(UUID(as_uuid=True), nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    meta = Column(JSON, default=dict, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User")

class CommunityAnnouncement(Base):
    __tablename__ = "community_announcements"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    community = relationship("Community", back_populates="announcements")
    creator = relationship("User")

class EventRegistration(Base):
    __tablename__ = "event_registrations"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default="registered", nullable=False) # 'registered', 'cancelled'
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("event_id", "user_id", name="uq_event_user_registration"),)

    event = relationship("Event", back_populates="registrations")
    user = relationship("User")

class EventWaitlist(Base):
    __tablename__ = "event_waitlist"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    position = Column(Integer, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("event_id", "user_id", name="uq_event_user_waitlist"),)

    event = relationship("Event", back_populates="waitlist")
    user = relationship("User")

class NotificationType(str, enum.Enum):
    FACE_MATCH = "face_match"
    COMMUNITY = "community"
    SOCIAL = "social"
    ACHIEVEMENT = "achievement"
    SYSTEM = "system"
    SECURITY = "security"
    EVENT = "event"
    MESSAGE = "message"
    WEEKLY_DIGEST = "weekly_digest"
    COMMUNITY_MATCH = "community_match"
    EVENT_MATCH = "event_match"

class NotificationPriority(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    notification_type = Column(SQLEnum(NotificationType, native_enum=False), default=NotificationType.SYSTEM, nullable=False)
    priority = Column(SQLEnum(NotificationPriority, native_enum=False), default=NotificationPriority.MEDIUM, nullable=False)
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=True)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=True)
    match_count = Column(Integer, default=1, nullable=True)
    media_ids = Column(JSON, nullable=True) # list of media_ids or photo_ids
    target_url = Column(String, nullable=True)
    
    # Interaction Tracking
    notification_opened = Column(Boolean, default=False, nullable=False)
    notification_clicked = Column(Boolean, default=False, nullable=False)
    notification_dismissed = Column(Boolean, default=False, nullable=False)
    opened_at = Column(DateTime(timezone=True), nullable=True)
    clicked_at = Column(DateTime(timezone=True), nullable=True)
    dismissed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Delivery Tracking
    push_sent = Column(Boolean, default=False, nullable=False)
    email_sent = Column(Boolean, default=False, nullable=False)
    
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User")
    community = relationship("Community")
    event = relationship("Event")

class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    face_matches_enabled = Column(Boolean, default=True, nullable=False)
    community_enabled = Column(Boolean, default=True, nullable=False)
    social_enabled = Column(Boolean, default=True, nullable=False)
    achievement_enabled = Column(Boolean, default=True, nullable=False)
    system_enabled = Column(Boolean, default=True, nullable=False)
    security_enabled = Column(Boolean, default=True, nullable=False)
    event_enabled = Column(Boolean, default=True, nullable=False)
    message_enabled = Column(Boolean, default=True, nullable=False)
    
    push_enabled = Column(Boolean, default=True, nullable=False)
    email_enabled = Column(Boolean, default=True, nullable=False)
    
    digest_enabled = Column(Boolean, default=True, nullable=False)
    digest_frequency = Column(String, default="weekly", nullable=False) # 'daily', 'weekly'
    
    quiet_hours_enabled = Column(Boolean, default=False, nullable=False)
    quiet_hours_start = Column(String, default="22:00", nullable=False) # HH:MM
    quiet_hours_end = Column(String, default="07:00", nullable=False) # HH:MM
    
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    user = relationship("User")

class ChatMessage(Base):
    __tablename__ = "community_chat_messages"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    channel = Column(String, nullable=False) # 'general', 'events', 'media', 'announcements', 'photography'
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    community = relationship("Community")
    user = relationship("User")

class EventDiscussion(Base):
    __tablename__ = "event_discussions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    event = relationship("Event")
    user = relationship("User")

class UserPoints(Base):
    __tablename__ = "user_points_ledger"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    points = Column(Integer, nullable=False)
    action = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User")

class UserBadge(Base):
    __tablename__ = "user_badges"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    badge_type = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User")

class MediaAlbum(Base):
    __tablename__ = "media_albums"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    cover_url = Column(String, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_highlights = Column(Boolean, default=False, nullable=False)
    generated_by_ai = Column(Boolean, default=False, nullable=False)
    cover_media_id = Column(UUID(as_uuid=True), nullable=True)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    community = relationship("Community")
    creator = relationship("User")
    event = relationship("Event")
    media = relationship("CommunityMedia", back_populates="album", cascade="all, delete-orphan")

class CommunityMedia(Base):
    __tablename__ = "community_media"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    album_id = Column(UUID(as_uuid=True), ForeignKey("media_albums.id", ondelete="SET NULL"), nullable=True)
    uploaded_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    file_url = Column(String, nullable=False)
    file_type = Column(String, default="photo", nullable=False)  # 'photo', 'video'
    title = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    sharpness_score = Column(Float, default=0.0, nullable=False)
    blur_score = Column(Float, default=0.0, nullable=False)
    brightness_score = Column(Float, default=0.0, nullable=False)
    face_visibility_score = Column(Float, default=0.0, nullable=False)
    smile_score = Column(Float, default=0.0, nullable=False)
    composition_score = Column(Float, default=0.0, nullable=False)
    eye_open_score = Column(Float, default=0.0, nullable=False)
    overall_score = Column(Float, default=0.0, nullable=False)
    quality_reason = Column(String, nullable=True)
    is_pinned_highlight = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    community = relationship("Community")
    uploader = relationship("User")
    album = relationship("MediaAlbum", back_populates="media")
    face_matches = relationship("PhotoFaceMatch", back_populates="media", cascade="all, delete-orphan")

class PhotoFaceMatch(Base):
    __tablename__ = "photo_face_matches"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    media_id = Column(UUID(as_uuid=True), ForeignKey("community_media.id", ondelete="CASCADE"), nullable=True)
    photo_id = Column(UUID(as_uuid=True), ForeignKey("photos.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    confidence_score = Column(Float, nullable=False)
    is_verified_match = Column(Boolean, default=True, nullable=False)
    status = Column(String, default="pending", nullable=False) # 'pending', 'approved', 'rejected'
    is_favorite = Column(Boolean, default=False, nullable=False)
    is_hidden = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    media = relationship("CommunityMedia", back_populates="face_matches")
    photo = relationship("Photo")
    user = relationship("User")


class HighlightGenerationLog(Base):
    __tablename__ = "highlight_generation_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    album_id = Column(UUID(as_uuid=True), ForeignKey("media_albums.id", ondelete="CASCADE"), nullable=True)
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=True)
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=True)
    generated_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    photos_analyzed = Column(Integer, default=0, nullable=False)
    photos_selected = Column(Integer, default=0, nullable=False)
    duplicates_removed = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    album = relationship("MediaAlbum")
    community = relationship("Community")
    event = relationship("Event")
    creator = relationship("User")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    last_message_id = Column(UUID(as_uuid=True), nullable=True)

    participants = relationship("ConversationParticipant", back_populates="conversation", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", foreign_keys="Message.conversation_id")


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    last_read_message_id = Column(UUID(as_uuid=True), nullable=True)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    is_pinned = Column(Boolean, default=False, nullable=False)

    __table_args__ = (UniqueConstraint("conversation_id", "user_id", name="uq_conv_user_participant"),)

    conversation = relationship("Conversation", back_populates="participants")
    user = relationship("User")


class Message(Base):
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    conversation_id = Column(UUID(as_uuid=True), ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    content = Column(Text, nullable=False)
    message_type = Column(String, default="text", nullable=False) # 'text', 'image', 'photo_share', 'event_share', 'community_share', 'highlight_share', 'system'
    shared_item_id = Column(UUID(as_uuid=True), nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    read_at = Column(DateTime(timezone=True), nullable=True)
    edited_at = Column(DateTime(timezone=True), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by_users = Column(JSON, default=list, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    conversation = relationship("Conversation", back_populates="messages", foreign_keys=[conversation_id])
    sender = relationship("User")
    reactions = relationship("MessageReaction", back_populates="message", cascade="all, delete-orphan")


class MessageRequest(Base):
    __tablename__ = "message_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    sender_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    receiver_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default="pending", nullable=False) # 'pending', 'accepted', 'declined', 'blocked'
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("sender_id", "receiver_id", name="uq_msg_req_sender_receiver"),)

    sender = relationship("User", foreign_keys=[sender_id])
    receiver = relationship("User", foreign_keys=[receiver_id])


class BlockedUser(Base):
    __tablename__ = "blocked_users"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    blocker_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    blocked_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("blocker_id", "blocked_id", name="uq_blocked_user"),)

    blocker = relationship("User", foreign_keys=[blocker_id])
    blocked = relationship("User", foreign_keys=[blocked_id])


class MessageReaction(Base):
    __tablename__ = "message_reactions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    message_id = Column(UUID(as_uuid=True), ForeignKey("messages.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    reaction = Column(String, nullable=False) # 👍, ❤️, 🔥, 😂, 👏
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("message_id", "user_id", name="uq_message_reaction"),)

    message = relationship("Message", back_populates="reactions")
    user = relationship("User")


class SearchHistory(Base):
    __tablename__ = "search_history"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    query = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User")


class SavedSearch(Base):
    __tablename__ = "saved_searches"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    query = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User")


class PerformanceMetric(Base):
    __tablename__ = "performance_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    endpoint = Column(String, nullable=False)
    method = Column(String, nullable=False)
    duration_ms = Column(Float, nullable=False)
    query_count = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

class BackgroundJob(Base):
    __tablename__ = "background_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    task_id = Column(String, nullable=True, index=True)
    task_name = Column(String, nullable=False)
    queue_name = Column(String, default="default", nullable=False)
    status = Column(String, default="queued", nullable=False) # 'queued', 'running', 'completed', 'failed', 'cancelled', 'paused'
    priority = Column(Integer, default=5, nullable=False)
    queued_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    initiated_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    worker_name = Column(String, nullable=True)
    progress = Column(Integer, default=0, nullable=False)
    progress_message = Column(String, nullable=True)
    result = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    max_retries = Column(Integer, default=3, nullable=False)
    parent_job_id = Column(UUID(as_uuid=True), ForeignKey("background_jobs.id", ondelete="SET NULL"), nullable=True)
    depends_on_job_id = Column(UUID(as_uuid=True), ForeignKey("background_jobs.id", ondelete="SET NULL"), nullable=True)
    meta = Column(JSON, default=dict, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    initiator = relationship("User", foreign_keys=[initiated_by])

class SecurityIncident(Base):
    __tablename__ = "security_incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    incident_type = Column(String, nullable=False) # e.g. 'brute_force', 'rate_limit', 'spoofing', 'spam'
    severity = Column(String, default="low", nullable=False) # 'low', 'medium', 'high', 'critical'
    ip_address = Column(String, nullable=True)
    description = Column(Text, nullable=False)
    meta = Column(JSON, default=dict, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User")


class ApiMetric(Base):
    __tablename__ = "api_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    endpoint = Column(String, nullable=False)
    method = Column(String, nullable=False)
    duration_ms = Column(Float, nullable=False)
    status_code = Column(Integer, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User")


class SearchMetric(Base):
    __tablename__ = "search_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    query = Column(String, nullable=False)
    duration_ms = Column(Float, nullable=False)
    result_count = Column(Integer, default=0, nullable=False)
    is_success = Column(Boolean, default=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User")


class ErrorLog(Base):
    __tablename__ = "error_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    message = Column(Text, nullable=False)
    traceback = Column(Text, nullable=True)
    endpoint = Column(String, nullable=True)
    method = Column(String, nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User")


class UptimeLog(Base):
    __tablename__ = "uptime_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    service = Column(String, nullable=False)  # 'api', 'database', 'cache', 'worker'
    status = Column(String, default="healthy", nullable=False)  # 'healthy', 'degraded', 'unhealthy'
    latency_ms = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)


from sqlalchemy import BigInteger

class BackupRecord(Base):
    __tablename__ = "backup_records"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    backup_type = Column(String, nullable=False)  # 'daily', 'incremental', 'weekly', 'monthly', 'manual'
    backup_size = Column(BigInteger, default=0, nullable=False)
    backup_location = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    verified = Column(Boolean, default=False, nullable=False)
    restore_tested = Column(Boolean, default=False, nullable=False)
    status = Column(String, default="success", nullable=False)  # 'success', 'failed', 'testing', 'restored'
    checksum = Column(String, nullable=True)
    encryption_version = Column(String, default="AES-256-Fernet", nullable=False)
    restore_duration = Column(Float, nullable=True)  # in seconds
    meta = Column(JSON, default=dict, nullable=True)


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    endpoint = Column(String, nullable=False, unique=True)
    p256dh = Column(String, nullable=False)
    auth = Column(String, nullable=False)
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User")


class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String, nullable=False, unique=True)
    enabled = Column(Boolean, default=False, nullable=False)
    description = Column(String, nullable=True)
    rollout_percentage = Column(Integer, default=100, nullable=False) # 0-100
    updated_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String, default="low", nullable=False) # low, medium, high, critical
    status = Column(String, default="open", nullable=False) # open, investigating, resolved, closed
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    meta = Column(JSON, default=dict, nullable=True)

    assignee = relationship("User", foreign_keys=[assigned_to])


class SystemSettings(Base):
    """Singleton pattern table for global platform switches"""
    __tablename__ = "system_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    maintenance_mode = Column(Boolean, default=False, nullable=False)
    maintenance_message = Column(String, nullable=True)
    disable_uploads = Column(Boolean, default=False, nullable=False)
    disable_registrations = Column(Boolean, default=False, nullable=False)
    disable_messaging = Column(Boolean, default=False, nullable=False)
    disable_search = Column(Boolean, default=False, nullable=False)
    disable_face_matching = Column(Boolean, default=False, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)
    updated_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)


class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    admin_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String, nullable=False) # e.g. "DEACTIVATE_USER", "TOGGLE_FEATURE"
    target_type = Column(String, nullable=True) # e.g. "User", "Community", "FeatureFlag"
    target_id = Column(String, nullable=True)
    details = Column(JSON, default=dict, nullable=True)
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    admin = relationship("User", foreign_keys=[admin_id])


class AdminNote(Base):
    __tablename__ = "admin_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    target_type = Column(String, nullable=False) # e.g. "User", "Community", "Incident"
    target_id = Column(String, nullable=False)
    note = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    author = relationship("User", foreign_keys=[author_id])

class FacePrivacySettings(Base):
    __tablename__ = "face_privacy_settings"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    face_matching_enabled = Column(Boolean, default=True, nullable=False)
    public_search_enabled = Column(Boolean, default=True, nullable=False)
    community_search_enabled = Column(Boolean, default=True, nullable=False)
    allow_face_suggestions = Column(Boolean, default=True, nullable=False)
    allow_group_discovery = Column(Boolean, default=True, nullable=False)
    allow_relationship_graph = Column(Boolean, default=True, nullable=False)
    hide_from_directory = Column(Boolean, default=False, nullable=False)
    privacy_profile = Column(String, default="STANDARD", nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    user = relationship("User", backref="privacy_settings")

class FacePrivacyAudit(Base):
    __tablename__ = "face_privacy_audit"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    action = Column(String, nullable=False)
    old_value = Column(String, nullable=True)
    new_value = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User")

class ExportJob(Base):
    __tablename__ = "export_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, default="PENDING", nullable=False) # PENDING, PROCESSING, READY, FAILED, EXPIRED
    progress = Column(Integer, default=0, nullable=False)
    download_url = Column(String, nullable=True)
    file_size = Column(Integer, nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")

class FaceDeletionRequest(Base):
    __tablename__ = "face_deletion_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    requested_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    scheduled_deletion_at = Column(DateTime(timezone=True), nullable=False)
    confirmed = Column(Boolean, default=False, nullable=False)
    cancelled = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User")

class MemoryCollection(Base):
    __tablename__ = "memory_collections"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    memory_type = Column(String, nullable=False) # EVENT, COMMUNITY, PERSON, TRIP, CUSTOM
    cover_photo_id = Column(UUID(as_uuid=True), nullable=True) # References Photo or CommunityMedia
    memory_date = Column(DateTime(timezone=True), nullable=True)
    memory_score = Column(Float, default=0.0, nullable=False)
    best_photo_id = Column(UUID(as_uuid=True), nullable=True)
    most_smiles_photo_id = Column(UUID(as_uuid=True), nullable=True)
    group_photo_id = Column(UUID(as_uuid=True), nullable=True)
    photo_count = Column(Integer, default=0, nullable=False)
    people_count = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow, nullable=False)

    user = relationship("User")

class MemoryPhoto(Base):
    __tablename__ = "memory_photos"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    memory_id = Column(UUID(as_uuid=True), ForeignKey("memory_collections.id", ondelete="CASCADE"), nullable=False)
    photo_id = Column(UUID(as_uuid=True), nullable=False) # Can be Photo or CommunityMedia ID
    confidence_score = Column(Float, default=1.0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    memory = relationship("MemoryCollection")

class MemoryPerson(Base):
    __tablename__ = "memory_persons"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    memory_id = Column(UUID(as_uuid=True), ForeignKey("memory_collections.id", ondelete="CASCADE"), nullable=False)
    person_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    appearance_count = Column(Integer, default=1, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    memory = relationship("MemoryCollection")
    person = relationship("User")

class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    jti = Column(String, unique=True, index=True, nullable=False)
    device_name = Column(String, nullable=True)
    browser = Column(String, nullable=True)
    os = Column(String, nullable=True)
    ip_address = Column(String, nullable=True)
    country = Column(String, nullable=True)
    city = Column(String, nullable=True)
    last_active = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    is_current = Column(Boolean, default=False, nullable=False)
    is_revoked = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)

    user = relationship("User")

class LoginEvent(Base):
    __tablename__ = "login_events"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    ip_address = Column(String, nullable=True)
    device = Column(String, nullable=True)
    browser = Column(String, nullable=True)
    os = Column(String, nullable=True)
    country = Column(String, nullable=True)
    city = Column(String, nullable=True)
    success = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User")

class SecurityAlert(Base):
    __tablename__ = "security_alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    alert_type = Column(String, nullable=False)
    severity = Column(String, default="LOW", nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    user = relationship("User")

class CommunityInviteCode(Base):
    __tablename__ = "community_invite_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    code = Column(String, unique=True, index=True, nullable=False)
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    # Mode: 'auto' (immediately join) or 'approval' (request access)
    join_mode = Column(String, default="auto", nullable=False)
    
    # Expiry options: expires_at DateTime or null
    expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Usage limits: max_uses or null
    max_uses = Column(Integer, nullable=True)
    uses_count = Column(Integer, default=0, nullable=False)
    
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    community = relationship("Community")
    creator = relationship("User")

