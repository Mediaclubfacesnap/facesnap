from sqlalchemy import Column, String, ForeignKey, Date, Float, Text, ARRAY, Integer, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
import datetime
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()")
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    roles = relationship("CommunityRole", back_populates="user", cascade="all, delete-orphan")
    communities_created = relationship("Community", back_populates="creator")
    verification_sessions = relationship("VerificationSession", back_populates="user", cascade="all, delete-orphan")
    contributor_requests = relationship("ContributorRequest", back_populates="user", cascade="all, delete-orphan")

class Community(Base):
    __tablename__ = "communities"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()")
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String, nullable=False)
    logo_url = Column(String, nullable=True)
    banner_url = Column(String, nullable=True)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    creator = relationship("User", back_populates="communities_created")
    roles = relationship("CommunityRole", back_populates="community", cascade="all, delete-orphan")
    events = relationship("Event", back_populates="community", cascade="all, delete-orphan")
    contributor_requests = relationship("ContributorRequest", back_populates="community", cascade="all, delete-orphan")

class CommunityRole(Base):
    __tablename__ = "community_roles"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()")
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False) # 'host', 'admin', 'contributor'
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("community_id", "user_id", name="uq_community_user_role"),)

    community = relationship("Community", back_populates="roles")
    user = relationship("User", back_populates="roles")

class ContributorRequest(Base):
    __tablename__ = "contributor_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()")
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    request_type = Column(String, default="gallery", nullable=False) # 'contributor', 'upload', 'gallery', 'member'
    status = Column(String, default="pending", nullable=False) # 'pending', 'approved', 'rejected'
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("community_id", "user_id", "request_type", name="uq_community_user_request_type"),)

    community = relationship("Community", back_populates="contributor_requests")
    user = relationship("User", back_populates="contributor_requests")

class Event(Base):
    __tablename__ = "events"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()")
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    location = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String, default="draft", nullable=False) # 'draft', 'uploading', 'processing', 'live', 'archived'
    banner_url = Column(String, nullable=True)
    creator_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    @property
    def cover_url(self):
        return self.banner_url

    community = relationship("Community", back_populates="events")
    photos = relationship("Photo", back_populates="event", cascade="all, delete-orphan")
    verification_sessions = relationship("VerificationSession", back_populates="event", cascade="all, delete-orphan")

class Photo(Base):
    __tablename__ = "photos"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()")
    event_id = Column(UUID(as_uuid=True), ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    storage_path = Column(String, nullable=False)
    filename = Column(String, nullable=False)
    status = Column(String, default="processing", nullable=False) # 'processing', 'indexed', 'failed'
    hash = Column(String, nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    event = relationship("Event", back_populates="photos")
    faces = relationship("PhotoFace", back_populates="photo", cascade="all, delete-orphan")

class PhotoFace(Base):
    __tablename__ = "photo_faces"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()")
    photo_id = Column(UUID(as_uuid=True), ForeignKey("photos.id", ondelete="CASCADE"), nullable=False)
    bbox = Column(ARRAY(Integer), nullable=False) # [ymin, xmin, ymax, xmax]
    embedding = Column(Vector(512), nullable=False) # 512-dimensional face embedding
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    photo = relationship("Photo", back_populates="faces")

class VerificationSession(Base):
    __tablename__ = "verification_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()")
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

    id = Column(UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()")
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

    id = Column(UUID(as_uuid=True), primary_key=True, server_default="gen_random_uuid()")
    community_id = Column(UUID(as_uuid=True), ForeignKey("communities.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("community_id", "user_id", name="uq_community_star"),)
