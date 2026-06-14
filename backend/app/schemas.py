from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import date, datetime
from typing import List, Optional

# --- Auth Schemas ---
class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    email: str = Field(..., pattern=r'^[^@\s]+@[^@\s]+\.[^@\s]+$')  # Basic email check, avoids idna crash
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2)

class UserLogin(BaseModel):
    email: str  # Plain str to avoid idna/email-validator crash on Python 3.12
    password: str

class UserResponse(BaseModel):
    id: UUID
    username: str
    email: str  # Plain str to avoid idna/email-validator crash on Python 3.12
    full_name: str
    avatar_url: Optional[str] = None
    platform_role: str
    can_create_communities: bool
    can_create_events: bool
    face_matching_enabled: bool
    match_notifications_enabled: bool
    community_discovery_enabled: bool
    hide_matches_from_analytics: bool
    community_match_notifications_enabled: bool
    event_match_notifications_enabled: bool
    weekly_digest_enabled: bool
    email_notifications_enabled: bool
    last_seen: Optional[datetime] = None
    is_online: Optional[bool] = False
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

# --- Community / Group Schemas ---
class CommunityCreate(BaseModel):
    title: str = Field(..., min_length=2)
    description: str
    category: str
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    visibility: Optional[str] = "PRIVATE"

class CommunityResponse(BaseModel):
    id: UUID
    title: str
    description: str
    category: str
    logo_url: Optional[str]
    banner_url: Optional[str]
    creator_id: UUID
    visibility: str
    archived_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CommunityRoleResponse(BaseModel):
    id: UUID
    community_id: UUID
    user_id: UUID
    role: Optional[str] = None
    created_at: datetime
    user: UserResponse

    class Config:
        from_attributes = True

# --- Role Request Schemas ---
class RoleRequestCreate(BaseModel):
    request_type: str = Field("moderator", pattern="^(moderator|admin|host)$")

class RoleRequestResponse(BaseModel):
    id: UUID
    community_id: UUID
    user_id: UUID
    request_type: str
    status: str
    created_at: datetime
    user: UserResponse

    class Config:
        from_attributes = True

class RoleRequestReview(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")

class MemberRoleUpdate(BaseModel):
    role: Optional[str] = Field(None, pattern="^(host|admin|moderator)$")

# --- Event Schemas ---
class EventCreate(BaseModel):
    title: str = Field(..., min_length=2)
    description: str
    location: str
    date: date
    cover_url: Optional[str] = None
    banner_url: Optional[str] = None
    category: Optional[str] = None
    max_participants: Optional[int] = None
    registration_deadline: Optional[datetime] = None

class EventResponse(BaseModel):
    id: UUID
    community_id: UUID
    title: str
    description: str
    location: str
    date: date
    status: str
    banner_url: Optional[str] = None
    cover_url: Optional[str] = None
    creator_id: UUID
    created_at: datetime
    category: Optional[str] = None
    max_participants: Optional[int] = None
    registration_deadline: Optional[datetime] = None

    class Config:
        from_attributes = True

# --- Photo Schemas ---
class PhotoResponse(BaseModel):
    id: UUID
    event_id: UUID
    storage_path: str
    filename: str
    status: str
    hash: Optional[str] = None
    sharpness_score: float
    blur_score: float
    brightness_score: float
    face_visibility_score: float
    smile_score: float
    composition_score: float
    eye_open_score: float
    overall_score: float
    quality_reason: Optional[str] = None
    is_pinned_highlight: bool
    created_at: datetime

    class Config:
        from_attributes = True

# --- Verification Schemas ---
class VerificationRequest(BaseModel):
    image_base64: str          # Captured webcam frame
    liveness_score: float      # Frontend assertion of head tilt/blink
    eye_blinked: bool          # Simple assertion to log
    image_up: Optional[str] = None
    image_down: Optional[str] = None
    image_right: Optional[str] = None
    image_left: Optional[str] = None

class VerificationResponse(BaseModel):
    status: str                # 'verified', 'failed'
    liveness_score: float
    matched_count: int

class MatchedPhotoResponse(BaseModel):
    photo_id: UUID
    filename: str
    storage_path: str
    confidence: float
    bbox: List[int]

    class Config:
        from_attributes = True

class InvitationCreate(BaseModel):
    invitee_username: str

class InvitationResponse(BaseModel):
    id: UUID
    community_id: UUID
    inviter_id: UUID
    invitee_id: UUID
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Recognition History Schemas ---
class RecognitionHistoryResponse(BaseModel):
    id: UUID
    user_id: UUID
    event_id: UUID
    status: str
    liveness_score: float
    matched_photos_count: int
    average_confidence: float
    processing_time_ms: int
    ip_address: Optional[str] = None
    device_info: Optional[str] = None
    created_at: datetime
    user: UserResponse
    event: Optional[EventResponse] = None

    class Config:
        from_attributes = True

class RecognitionHistoryStats(BaseModel):
    total_searches: int
    total_photos_found: int
    failed_searches: int
    most_active_username: Optional[str] = None

# --- Access Request Schemas ---
class CommunityAccessRequestCreate(BaseModel):
    full_name: str
    email: str  # Plain str to avoid idna crash on Python 3.12
    college: str
    purpose: str
    expected_members: str
    social_links: str
    reason: str

class CommunityAccessRequestResponse(BaseModel):
    id: UUID
    user_id: UUID
    status: str
    full_name: Optional[str] = None
    email: Optional[str] = None
    college: Optional[str] = None
    purpose: Optional[str] = None
    reason: str
    reviewed_by: Optional[UUID] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class EventAccessRequestCreate(BaseModel):
    community_id: UUID
    reason: str

class EventAccessRequestResponse(BaseModel):
    id: UUID
    user_id: UUID
    community_id: UUID
    status: str
    reason: str
    reviewed_by: Optional[UUID] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    user: UserResponse

    class Config:
        from_attributes = True

class AccessRequestReview(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")

class CommunityJoinRequestCreate(BaseModel):
    message: Optional[str] = None

class CommunityJoinRequestResponse(BaseModel):
    id: UUID
    community_id: UUID
    user_id: UUID
    status: str
    message: Optional[str] = None
    reviewed_by: Optional[UUID] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime
    user: UserResponse

    class Config:
        from_attributes = True

class CommunityJoinRequestReview(BaseModel):
    decision: str = Field(..., pattern="^(approved|rejected)$")

# --- Announcements Schemas ---
class AnnouncementCreate(BaseModel):
    title: str = Field(..., min_length=2)
    content: str = Field(..., min_length=2)

class AnnouncementResponse(BaseModel):
    id: UUID
    community_id: UUID
    title: str
    content: str
    created_by: UUID
    created_at: datetime
    creator: Optional[UserResponse] = None

    class Config:
        from_attributes = True

# --- Registration Schemas (Attendance removed per roadmap revision) ---
class EventRegistrationResponse(BaseModel):
    id: UUID
    event_id: UUID
    user_id: UUID
    status: str
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

# --- Notification Schemas ---
class NotificationResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    message: str
    is_read: bool
    notification_type: str
    priority: str
    community_id: Optional[UUID] = None
    event_id: Optional[UUID] = None
    match_count: Optional[int] = 1
    media_ids: Optional[list] = None
    target_url: Optional[str] = None
    notification_opened: bool = False
    notification_clicked: bool = False
    notification_dismissed: bool = False
    opened_at: Optional[datetime] = None
    clicked_at: Optional[datetime] = None
    dismissed_at: Optional[datetime] = None
    push_sent: bool = False
    email_sent: bool = False
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationPreferencesResponse(BaseModel):
    id: UUID
    user_id: UUID
    face_matches_enabled: bool
    community_enabled: bool
    social_enabled: bool
    achievement_enabled: bool
    system_enabled: bool
    security_enabled: bool
    event_enabled: bool
    message_enabled: bool
    push_enabled: bool
    email_enabled: bool
    digest_enabled: bool
    digest_frequency: str
    quiet_hours_enabled: bool
    quiet_hours_start: str
    quiet_hours_end: str

    class Config:
        from_attributes = True

class NotificationPreferencesUpdate(BaseModel):
    face_matches_enabled: Optional[bool] = None
    community_enabled: Optional[bool] = None
    social_enabled: Optional[bool] = None
    achievement_enabled: Optional[bool] = None
    system_enabled: Optional[bool] = None
    security_enabled: Optional[bool] = None
    event_enabled: Optional[bool] = None
    message_enabled: Optional[bool] = None
    push_enabled: Optional[bool] = None
    email_enabled: Optional[bool] = None
    digest_enabled: Optional[bool] = None
    digest_frequency: Optional[str] = None
    quiet_hours_enabled: Optional[bool] = None
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None

# --- Audit Log Schemas ---
class AuditLogResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID]
    action: str
    target: Optional[str]
    target_id: Optional[UUID]
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

# --- Analytics Response ---
class CommunityAnalytics(BaseModel):
    members_count: int
    events_count: int
    pending_requests_count: int
    announcements_count: int
    invite_usage: int = 0
    qr_scans: int = 0
    albums_count: int = 0
    photos_count: int = 0
    recognition_matches: int = 0
    upcoming_events_count: int = 0
    registrations_count: int = 0

class SuperAdminAnalytics(BaseModel):
    total_users: int
    total_communities: int
    total_events: int
    total_photos: int
    total_registrations: int
    active_members: int

# --- Phase 3 Social & Gamification Schemas ---
class ChatMessageCreate(BaseModel):
    content: str

class ChatMessageResponse(BaseModel):
    id: UUID
    community_id: UUID
    channel: str
    user_id: UUID
    content: str
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class EventDiscussionCreate(BaseModel):
    content: str

class EventDiscussionResponse(BaseModel):
    id: UUID
    event_id: UUID
    user_id: UUID
    content: str
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class UserBadgeResponse(BaseModel):
    id: UUID
    user_id: UUID
    badge_type: str
    created_at: datetime

    class Config:
        from_attributes = True

class UserPointsResponse(BaseModel):
    id: UUID
    user_id: UUID
    points: int
    action: str
    created_at: datetime

    class Config:
        from_attributes = True

class LeaderboardEntry(BaseModel):
    user_id: UUID
    username: str
    full_name: str
    total_points: int
    badge_count: int

class TimelineItem(BaseModel):
    id: UUID
    type: str  # 'join_community', 'attend_event', 'upload_photos', etc.
    title: str
    description: str
    timestamp: datetime

# --- Phase 4A Community Media Gallery Schemas ---
class MediaAlbumCreate(BaseModel):
    name: str = Field(..., min_length=2)
    description: Optional[str] = None

class MediaAlbumResponse(BaseModel):
    id: UUID
    community_id: UUID
    name: str
    description: Optional[str] = None
    cover_url: Optional[str] = None
    created_by: UUID
    is_highlights: bool
    generated_by_ai: bool
    cover_media_id: Optional[UUID] = None
    event_id: Optional[UUID] = None
    created_at: datetime
    media_count: Optional[int] = 0
    creator: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class CommunityMediaCreate(BaseModel):
    file_url: str
    file_type: str = Field("photo", pattern="^(photo|video)$")
    title: Optional[str] = None
    description: Optional[str] = None
    album_id: Optional[UUID] = None

class CommunityMediaResponse(BaseModel):
    id: UUID
    community_id: UUID
    album_id: Optional[UUID] = None
    uploaded_by: UUID
    file_url: str
    file_type: str
    title: Optional[str] = None
    description: Optional[str] = None
    sharpness_score: float
    blur_score: float
    brightness_score: float
    face_visibility_score: float
    smile_score: float
    composition_score: float
    eye_open_score: float
    overall_score: float
    quality_reason: Optional[str] = None
    is_pinned_highlight: bool
    created_at: datetime
    uploader: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class HighlightGenerationLogResponse(BaseModel):
    id: UUID
    album_id: Optional[UUID] = None
    community_id: Optional[UUID] = None
    event_id: Optional[UUID] = None
    generated_by: Optional[UUID] = None
    photos_analyzed: int
    photos_selected: int
    duplicates_removed: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- Phase 4B: Photos Of Me (Face Matching) Schemas ---
class PhotoFaceMatchResponse(BaseModel):
    id: UUID
    media_id: Optional[UUID] = None
    photo_id: Optional[UUID] = None
    user_id: UUID
    confidence_score: float
    is_verified_match: bool
    status: str
    is_favorite: bool
    is_hidden: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MyPhotoResponse(BaseModel):
    match_id: UUID
    media_id: Optional[UUID] = None
    photo_id: Optional[UUID] = None
    file_url: str
    confidence: float
    status: str
    is_favorite: bool
    is_hidden: bool
    title: Optional[str] = None
    description: Optional[str] = None
    created_at: datetime
    community_title: str
    album_name: Optional[str] = None

    class Config:
        from_attributes = True

class UserPrivacyPreferencesUpdate(BaseModel):
    face_matching_enabled: bool
    match_notifications_enabled: bool
    community_discovery_enabled: bool
    hide_matches_from_analytics: bool

# --- Phase 4E: Event Registration & Waitlist Schemas ---
class EventWaitlistResponse(BaseModel):
    id: UUID
    event_id: UUID
    user_id: UUID
    position: int
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class RegistrationResultResponse(BaseModel):
    id: UUID
    event_id: UUID
    user_id: UUID
    status: str  # "registered" or "waitlisted"
    position: Optional[int] = None
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class EventStatsResponse(BaseModel):
    capacity: int
    registered: int
    waitlisted: int
    seats_left: int
    registration_deadline: Optional[datetime] = None
    fill_rate: float
    dropout_rate: float
    cancellation_rate: float


# --- Phase 4F: Direct Messaging & Chat Workspace Schemas ---

class MessageReactionResponse(BaseModel):
    id: UUID
    message_id: UUID
    user_id: UUID
    reaction: str
    created_at: datetime

    class Config:
        from_attributes = True

class MessageResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    content: str
    message_type: str
    shared_item_id: Optional[UUID] = None
    is_read: bool
    read_at: Optional[datetime] = None
    edited_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    created_at: datetime
    sender: Optional[UserResponse] = None
    reactions: List[MessageReactionResponse] = []

    class Config:
        from_attributes = True

class ConversationParticipantResponse(BaseModel):
    id: UUID
    conversation_id: UUID
    user_id: UUID
    joined_at: datetime
    last_read_message_id: Optional[UUID] = None
    archived_at: Optional[datetime] = None
    is_pinned: bool
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class ConversationResponse(BaseModel):
    id: UUID
    created_at: datetime
    updated_at: datetime
    last_message_id: Optional[UUID] = None
    participants: List[ConversationParticipantResponse] = []
    last_message: Optional[MessageResponse] = None
    unread_count: int = 0

    class Config:
        from_attributes = True

class MessageRequestResponse(BaseModel):
    id: UUID
    sender_id: UUID
    receiver_id: UUID
    status: str
    created_at: datetime
    sender: Optional[UserResponse] = None
    receiver: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class BlockedUserResponse(BaseModel):
    id: UUID
    blocker_id: UUID
    blocked_id: UUID
    created_at: datetime
    blocked: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class MessageCreate(BaseModel):
    content: str
    message_type: str = "text" # 'text', 'image', 'photo_share', 'event_share', 'community_share', 'highlight_share', 'system'
    shared_item_id: Optional[UUID] = None

class MessageUpdate(BaseModel):
    content: str

class MessageRequestCreate(BaseModel):
    receiver_id: UUID

class MessageReactionCreate(BaseModel):
    reaction: str # 👍, ❤️, 🔥, 😂, 👏


# --- Phase 4G: Smart Search Schemas ---

class SearchHistoryResponse(BaseModel):
    id: UUID
    user_id: UUID
    query: str
    created_at: datetime

    class Config:
        from_attributes = True

class SavedSearchResponse(BaseModel):
    id: UUID
    user_id: UUID
    query: str
    created_at: datetime

    class Config:
        from_attributes = True

class SavedSearchCreate(BaseModel):
    query: str

class ScopedSearchUsersResponse(BaseModel):
    results: List[UserResponse]

class ScopedSearchCommunitiesResponse(BaseModel):
    results: List[CommunityResponse]

class ScopedSearchEventsResponse(BaseModel):
    results: List[EventResponse]

class ScopedSearchPhotosResponse(BaseModel):
    results: List[MyPhotoResponse]

class ScopedSearchMessagesResponse(BaseModel):
    results: List[MessageResponse]

class ScopedSearchHighlightsResponse(BaseModel):
    results: List[MediaAlbumResponse]

class ScopedSearchAnnouncementsResponse(BaseModel):
    results: List[AnnouncementResponse]

class MemoryCollectionResponse(BaseModel):
    id: UUID
    user_id: UUID
    title: str
    description: Optional[str] = None
    memory_type: str
    memory_date: Optional[datetime] = None
    photo_count: int
    people_count: int
    cover_photo_id: Optional[UUID] = None

    class Config:
        from_attributes = True

class GlobalSearchResponse(BaseModel):
    users: List[UserResponse]
    communities: List[CommunityResponse]
    events: List[EventResponse]
    photos: List[MyPhotoResponse]
    messages: List[MessageResponse]
    highlights: List[MediaAlbumResponse]
    announcements: List[AnnouncementResponse]
    memories: List[MemoryCollectionResponse]


class SecurityIncidentResponse(BaseModel):
    id: UUID
    user_id: Optional[UUID] = None
    incident_type: str
    severity: str
    ip_address: Optional[str] = None
    description: str
    meta: Optional[dict] = {}
    created_at: datetime
    user: Optional[UserResponse] = None

    class Config:
        from_attributes = True


# --- Invite Code Schemas ---
class CommunityInviteCodeCreate(BaseModel):
    join_mode: str = Field("auto", pattern="^(auto|approval)$")
    expires_in_days: Optional[int] = None # None, 1, 7, 30
    max_uses: Optional[int] = None # None, or limit count

class CommunityInviteCodeResponse(BaseModel):
    id: UUID
    code: str
    community_id: UUID
    creator_id: UUID
    join_mode: str
    expires_at: Optional[datetime] = None
    max_uses: Optional[int] = None
    uses_count: int
    created_at: datetime

    class Config:
        from_attributes = True




