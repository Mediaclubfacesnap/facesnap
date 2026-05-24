from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import date, datetime
from typing import List, Optional

# --- Auth Schemas ---
class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=20)
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: UUID
    username: str
    email: EmailStr
    full_name: str
    avatar_url: Optional[str] = None
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

class CommunityResponse(BaseModel):
    id: UUID
    title: str
    description: str
    category: str
    logo_url: Optional[str]
    banner_url: Optional[str]
    creator_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class CommunityRoleResponse(BaseModel):
    id: UUID
    community_id: UUID
    user_id: UUID
    role: str
    created_at: datetime
    user: UserResponse

    class Config:
        from_attributes = True

# --- Contributor Request Schemas ---
class ContributorRequestCreate(BaseModel):
    request_type: str = Field("gallery", pattern="^(contributor|upload|gallery|member)$")

class ContributorRequestResponse(BaseModel):
    id: UUID
    community_id: UUID
    user_id: UUID
    request_type: str
    status: str
    created_at: datetime
    user: UserResponse

    class Config:
        from_attributes = True

class ContributorRequestReview(BaseModel):
    status: str = Field(..., pattern="^(approved|rejected)$")

class MemberRoleUpdate(BaseModel):
    role: str = Field(..., pattern="^(host|admin|contributor|gallery_access|member_access|member)$")

# --- Event Schemas ---
class EventCreate(BaseModel):
    title: str = Field(..., min_length=2)
    description: str
    location: str
    date: date
    cover_url: Optional[str] = None
    banner_url: Optional[str] = None

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
    created_at: datetime

    class Config:
        from_attributes = True

# --- Verification Schemas ---
class VerificationRequest(BaseModel):
    image_base64: str # Captured webcam frame
    liveness_score: float # Frontend assertion of head tilt/blink
    eye_blinked: bool # Simple assertion to log
    # Optional side-profile snapshots captured during active liveness head-movements
    image_up: Optional[str] = None
    image_down: Optional[str] = None
    image_right: Optional[str] = None
    image_left: Optional[str] = None

class VerificationResponse(BaseModel):
    status: str # 'verified', 'failed'
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
