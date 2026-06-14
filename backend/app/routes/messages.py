from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy import or_, and_, func
from typing import List, Optional, Dict
from uuid import UUID
import datetime
import logging
from jose import jwt
from pydantic import BaseModel

from app.database import get_db, AsyncSessionLocal
from app.models import Conversation, ConversationParticipant, Message, MessageReaction, MessageRequest, BlockedUser, User, Notification
from app.schemas import (
    ConversationResponse, ConversationParticipantResponse, MessageResponse, MessageReactionResponse,
    MessageRequestResponse, BlockedUserResponse, MessageCreate, MessageUpdate, MessageRequestCreate,
    MessageReactionCreate, UserResponse
)
from app.routes.auth import get_current_user
from app.config import settings

from app.services.security_service import security_service

def sanitize_text(text: Optional[str]) -> Optional[str]:
    if not text:
        return text
    return security_service.sanitize_html(text)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/messages", tags=["Private Messaging"])


# --- Realtime WebSocket Connection Manager ---
class ChatWebSocketManager:
    def __init__(self):
        # Maps conversation_id -> list of active websockets
        self.active_connections: Dict[UUID, List[WebSocket]] = {}
        # Maps user_id -> active websockets (for online status tracking)
        self.user_connections: Dict[UUID, List[WebSocket]] = {}

    async def connect(self, user_id: UUID, websocket: WebSocket, db: AsyncSession):
        await websocket.accept()
        if user_id not in self.user_connections:
            self.user_connections[user_id] = []
        self.user_connections[user_id].append(websocket)

        # Set user is_online to True in DB
        stmt = select(User).where(User.id == user_id)
        res = await db.execute(stmt)
        user = res.scalar_one_or_none()
        if user:
            user.is_online = True
            user.last_seen = datetime.datetime.utcnow()
            await db.commit()
            
            # Broadcast user:online status to everyone
            await self.broadcast_online_status(user_id, True, user.last_seen)

    async def disconnect(self, user_id: UUID, websocket: WebSocket, db: AsyncSession):
        if user_id in self.user_connections:
            if websocket in self.user_connections[user_id]:
                self.user_connections[user_id].remove(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]

        # Check if user has no more active socket connections
        if user_id not in self.user_connections:
            stmt = select(User).where(User.id == user_id)
            res = await db.execute(stmt)
            user = res.scalar_one_or_none()
            if user:
                user.is_online = False
                user.last_seen = datetime.datetime.utcnow()
                await db.commit()
                
                # Broadcast user:offline status to everyone
                await self.broadcast_online_status(user_id, False, user.last_seen)

    async def register_conversation(self, conversation_id: UUID, websocket: WebSocket):
        if conversation_id not in self.active_connections:
            self.active_connections[conversation_id] = []
        if websocket not in self.active_connections[conversation_id]:
            self.active_connections[conversation_id].append(websocket)

    def unregister_conversation(self, conversation_id: UUID, websocket: WebSocket):
        if conversation_id in self.active_connections:
            if websocket in self.active_connections[conversation_id]:
                self.active_connections[conversation_id].remove(websocket)
            if not self.active_connections[conversation_id]:
                del self.active_connections[conversation_id]

    async def broadcast_to_conversation(self, conversation_id: UUID, payload: dict):
        if conversation_id in self.active_connections:
            for connection in self.active_connections[conversation_id]:
                try:
                    await connection.send_json(payload)
                except Exception as e:
                    logger.error(f"Error broadcasting to conversation {conversation_id}: {e}")

    async def broadcast_online_status(self, user_id: UUID, is_online: bool, last_seen: datetime.datetime):
        # Broadcast to all connected clients
        payload = {
            "event": "user:online" if is_online else "user:offline",
            "data": {
                "user_id": str(user_id),
                "is_online": is_online,
                "last_seen": last_seen.isoformat()
            }
        }
        for user_sockets in self.user_connections.values():
            for ws in user_sockets:
                try:
                    await ws.send_json(payload)
                except Exception:
                    pass

chat_ws_manager = ChatWebSocketManager()


class StartConversationSchema(BaseModel):
    user_id: UUID


@router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(
    q: Optional[str] = None,
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Fetch blocked user IDs (both blocked by me and blocked me)
    blocked_stmt = select(BlockedUser.blocked_id).where(BlockedUser.blocker_id == current_user.id)
    blocked_by_stmt = select(BlockedUser.blocker_id).where(BlockedUser.blocked_id == current_user.id)
    blocked_res1 = await db.execute(blocked_stmt)
    blocked_res2 = await db.execute(blocked_by_stmt)
    blocked_ids = set(blocked_res1.scalars().all()) | set(blocked_res2.scalars().all())

    # 2. Find conversation IDs current user is participating in
    participant_stmt = select(ConversationParticipant.conversation_id).where(
        ConversationParticipant.user_id == current_user.id
    )
    if not include_archived:
        participant_stmt = participant_stmt.where(ConversationParticipant.archived_at.is_(None))
    else:
        participant_stmt = participant_stmt.where(ConversationParticipant.archived_at.is_not(None))

    part_res = await db.execute(participant_stmt)
    my_conv_ids = part_res.scalars().all()

    if not my_conv_ids:
        return []

    # 3. Load conversations
    stmt = (
        select(Conversation)
        .where(Conversation.id.in_(my_conv_ids))
        .options(
            selectinload(Conversation.participants).selectinload(ConversationParticipant.user)
        )
        .order_by(Conversation.updated_at.desc())
    )
    res = await db.execute(stmt)
    conversations = res.scalars().all()

    # 4. Filter q if search query provided
    if q:
        q_lower = q.lower()
        matching_conv_ids = set()
        for conv in conversations:
            # Check participant names/usernames
            for part in conv.participants:
                if part.user_id != current_user.id:
                    if q_lower in part.user.full_name.lower() or q_lower in part.user.username.lower():
                        matching_conv_ids.add(conv.id)
            # Check messages
            msg_search_stmt = select(Message.id).where(
                Message.conversation_id == conv.id,
                func.lower(Message.content).contains(q_lower)
            )
            msg_search_res = await db.execute(msg_search_stmt)
            if msg_search_res.scalars().all():
                matching_conv_ids.add(conv.id)
        
        conversations = [c for c in conversations if c.id in matching_conv_ids]

    # 5. Filter out conversations containing blocked participants, and calculate unread counts
    filtered_conversations = []
    for conv in conversations:
        has_blocked = False
        for part in conv.participants:
            if part.user_id in blocked_ids:
                has_blocked = True
                break
        if has_blocked:
            continue

        # Fetch last message
        last_msg = None
        if conv.last_message_id:
            msg_stmt = (
                select(Message)
                .where(Message.id == conv.last_message_id)
                .options(
                    selectinload(Message.sender),
                    selectinload(Message.reactions).selectinload(MessageReaction.user)
                )
            )
            msg_res = await db.execute(msg_stmt)
            last_msg = msg_res.scalar_one_or_none()

        # Find current participant record to get last_read_message_id and is_pinned
        my_part = next((p for p in conv.participants if p.user_id == current_user.id), None)
        
        # Fetch unread message count
        unread_count = 0
        if my_part:
            # Module 11 Check: Instant zero-unread comparison
            if my_part.last_read_message_id == conv.last_message_id:
                unread_count = 0
            elif last_msg and last_msg.sender_id == current_user.id:
                unread_count = 0
            else:
                # Query only if last message was from others and different from my last read message
                count_stmt = select(func.count(Message.id)).where(
                    Message.conversation_id == conv.id,
                    Message.sender_id != current_user.id,
                    Message.is_read == False
                )
                count_res = await db.execute(count_stmt)
                unread_count = count_res.scalar() or 0

        # Map to response structure
        conv_response = ConversationResponse(
            id=conv.id,
            created_at=conv.created_at,
            updated_at=conv.updated_at,
            last_message_id=conv.last_message_id,
            participants=[
                ConversationParticipantResponse(
                    id=p.id,
                    conversation_id=p.conversation_id,
                    user_id=p.user_id,
                    joined_at=p.joined_at,
                    last_read_message_id=p.last_read_message_id,
                    archived_at=p.archived_at,
                    is_pinned=p.is_pinned,
                    user=UserResponse.from_orm(p.user)
                ) for p in conv.participants
            ],
            last_message=MessageResponse.from_orm(last_msg) if (last_msg and (not last_msg.deleted_by_users or str(current_user.id) not in last_msg.deleted_by_users)) else None,
            unread_count=unread_count
        )
        filtered_conversations.append(conv_response)

    return filtered_conversations


@router.post("/conversations", response_model=ConversationResponse)
async def start_conversation(
    payload: StartConversationSchema,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    other_user_id = payload.user_id
    if other_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot start a conversation with yourself")

    # Enforce blocking check
    block_stmt = select(BlockedUser).where(
        ((BlockedUser.blocker_id == current_user.id) & (BlockedUser.blocked_id == other_user_id)) |
        ((BlockedUser.blocker_id == other_user_id) & (BlockedUser.blocked_id == current_user.id))
    )
    block_res = await db.execute(block_stmt)
    if block_res.scalars().all():
        raise HTTPException(status_code=403, detail="User is blocked")

    # Check if active conversation already exists
    my_convs_stmt = select(ConversationParticipant.conversation_id).where(
        ConversationParticipant.user_id == current_user.id
    )
    my_convs_res = await db.execute(my_convs_stmt)
    my_convs_ids = my_convs_res.scalars().all()

    if my_convs_ids:
        other_part_stmt = select(ConversationParticipant.conversation_id).where(
            ConversationParticipant.conversation_id.in_(my_convs_ids),
            ConversationParticipant.user_id == other_user_id
        )
        other_part_res = await db.execute(other_part_stmt)
        existing_conv_id = other_part_res.scalars().first()
        if existing_conv_id:
            # Load and return existing conversation
            conv_stmt = select(Conversation).where(Conversation.id == existing_conv_id).options(
                selectinload(Conversation.participants).selectinload(ConversationParticipant.user)
            )
            conv_res = await db.execute(conv_stmt)
            conv_obj = conv_res.scalar_one()

            # Unarchive if archived
            my_part = next((p for p in conv_obj.participants if p.user_id == current_user.id), None)
            if my_part and my_part.archived_at:
                my_part.archived_at = None
                await db.commit()

            return ConversationResponse(
                id=conv_obj.id,
                created_at=conv_obj.created_at,
                updated_at=conv_obj.updated_at,
                last_message_id=conv_obj.last_message_id,
                participants=[
                    ConversationParticipantResponse(
                        id=p.id,
                        conversation_id=p.conversation_id,
                        user_id=p.user_id,
                        joined_at=p.joined_at,
                        last_read_message_id=p.last_read_message_id,
                        archived_at=p.archived_at,
                        is_pinned=p.is_pinned,
                        user=UserResponse.from_orm(p.user)
                    ) for p in conv_obj.participants
                ],
                unread_count=0
            )

    # If no conversation exists, look at request status
    req_stmt = select(MessageRequest).where(
        ((MessageRequest.sender_id == current_user.id) & (MessageRequest.receiver_id == other_user_id)) |
        ((MessageRequest.sender_id == other_user_id) & (MessageRequest.receiver_id == current_user.id))
    )
    req_res = await db.execute(req_stmt)
    req_obj = req_res.scalars().first()

    if req_obj:
        if req_obj.status == "pending":
            if req_obj.sender_id == current_user.id:
                raise HTTPException(status_code=400, detail="Your message request is pending acceptance.")
            else:
                # Auto-accept since other user had sent a request and current user is trying to start chat
                req_obj.status = "accepted"
                conv = Conversation()
                db.add(conv)
                await db.flush()

                part1 = ConversationParticipant(conversation_id=conv.id, user_id=current_user.id)
                part2 = ConversationParticipant(conversation_id=conv.id, user_id=other_user_id)
                db.add(part1)
                db.add(part2)

                sys_msg = Message(
                    conversation_id=conv.id,
                    sender_id=other_user_id,
                    content="Conversation started",
                    message_type="system",
                    is_read=True
                )
                db.add(sys_msg)
                await db.flush()
                conv.last_message_id = sys_msg.id
                await db.commit()

                # Load newly created conversation
                conv_stmt = select(Conversation).where(Conversation.id == conv.id).options(
                    selectinload(Conversation.participants).selectinload(ConversationParticipant.user)
                )
                conv_res = await db.execute(conv_stmt)
                conv_obj = conv_res.scalar_one()

                return ConversationResponse(
                    id=conv_obj.id,
                    created_at=conv_obj.created_at,
                    updated_at=conv_obj.updated_at,
                    last_message_id=conv_obj.last_message_id,
                    participants=[
                        ConversationParticipantResponse(
                            id=p.id,
                            conversation_id=p.conversation_id,
                            user_id=p.user_id,
                            joined_at=p.joined_at,
                            last_read_message_id=p.last_read_message_id,
                            archived_at=p.archived_at,
                            is_pinned=p.is_pinned,
                            user=UserResponse.from_orm(p.user)
                        ) for p in conv_obj.participants
                    ],
                    unread_count=0
                )
        elif req_obj.status == "declined":
            if req_obj.sender_id == current_user.id:
                raise HTTPException(status_code=400, detail="Your previous request was declined.")
            else:
                # B declined A previously, but now B is initiating. Auto-accept and create chat!
                req_obj.status = "accepted"
                conv = Conversation()
                db.add(conv)
                await db.flush()

                part1 = ConversationParticipant(conversation_id=conv.id, user_id=current_user.id)
                part2 = ConversationParticipant(conversation_id=conv.id, user_id=other_user_id)
                db.add(part1)
                db.add(part2)

                sys_msg = Message(
                    conversation_id=conv.id,
                    sender_id=other_user_id,
                    content="Conversation started",
                    message_type="system",
                    is_read=True
                )
                db.add(sys_msg)
                await db.flush()
                conv.last_message_id = sys_msg.id
                await db.commit()

                # Load newly created conversation
                conv_stmt = select(Conversation).where(Conversation.id == conv.id).options(
                    selectinload(Conversation.participants).selectinload(ConversationParticipant.user)
                )
                conv_res = await db.execute(conv_stmt)
                conv_obj = conv_res.scalar_one()

                return ConversationResponse(
                    id=conv_obj.id,
                    created_at=conv_obj.created_at,
                    updated_at=conv_obj.updated_at,
                    last_message_id=conv_obj.last_message_id,
                    participants=[
                        ConversationParticipantResponse(
                            id=p.id,
                            conversation_id=p.conversation_id,
                            user_id=p.user_id,
                            joined_at=p.joined_at,
                            last_read_message_id=p.last_read_message_id,
                            archived_at=p.archived_at,
                            is_pinned=p.is_pinned,
                            user=UserResponse.from_orm(p.user)
                        ) for p in conv_obj.participants
                    ],
                    unread_count=0
                )

    # No request exists
    raise HTTPException(
        status_code=status.HTTP_428_PRECONDITION_REQUIRED,
        detail="No active conversation exists. You must first send a message request."
    )


@router.post("/conversations/{id}/archive")
async def archive_conversation(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(ConversationParticipant).where(
        (ConversationParticipant.conversation_id == id) & (ConversationParticipant.user_id == current_user.id)
    )
    res = await db.execute(stmt)
    part = res.scalar_one_or_none()
    if not part:
        raise HTTPException(status_code=404, detail="Conversation participant record not found")

    if part.archived_at:
        part.archived_at = None
        message = "Conversation unarchived"
    else:
        part.archived_at = datetime.datetime.utcnow()
        message = "Conversation archived"

    await db.commit()
    return {"status": "success", "message": message}


@router.post("/conversations/{id}/pin")
async def pin_conversation(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(ConversationParticipant).where(
        (ConversationParticipant.conversation_id == id) & (ConversationParticipant.user_id == current_user.id)
    )
    res = await db.execute(stmt)
    part = res.scalar_one_or_none()
    if not part:
        raise HTTPException(status_code=404, detail="Conversation participant record not found")

    if part.is_pinned:
        part.is_pinned = False
        message = "Conversation unpinned"
    else:
        # Check limit: Max 5 pinned chats
        pinned_stmt = select(ConversationParticipant).where(
            (ConversationParticipant.user_id == current_user.id) & (ConversationParticipant.is_pinned == True)
        )
        pinned_res = await db.execute(pinned_stmt)
        pinned_count = len(pinned_res.scalars().all())
        if pinned_count >= 5:
            raise HTTPException(status_code=400, detail="Maximum 5 pinned conversations allowed")

        part.is_pinned = True
        message = "Conversation pinned"

    await db.commit()
    return {"status": "success", "message": message}


@router.get("/requests", response_model=List[MessageRequestResponse])
async def get_message_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(MessageRequest).where(
        (MessageRequest.receiver_id == current_user.id) & (MessageRequest.status == "pending")
    ).options(
        selectinload(MessageRequest.sender),
        selectinload(MessageRequest.receiver)
    ).order_by(MessageRequest.created_at.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/request", response_model=MessageRequestResponse)
async def create_message_request(
    req: MessageRequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    other_user_id = req.receiver_id
    if other_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot send request to yourself")

    # 1. Enforce blocking check
    block_stmt = select(BlockedUser).where(
        ((BlockedUser.blocker_id == current_user.id) & (BlockedUser.blocked_id == other_user_id)) |
        ((BlockedUser.blocker_id == other_user_id) & (BlockedUser.blocked_id == current_user.id))
    )
    block_res = await db.execute(block_stmt)
    if block_res.scalars().all():
        raise HTTPException(status_code=403, detail="User is blocked")

    # 2. Check if active conversation already exists
    my_convs_stmt = select(ConversationParticipant.conversation_id).where(
        ConversationParticipant.user_id == current_user.id
    )
    my_convs_res = await db.execute(my_convs_stmt)
    my_convs_ids = my_convs_res.scalars().all()

    if my_convs_ids:
        other_part_stmt = select(ConversationParticipant.conversation_id).where(
            ConversationParticipant.conversation_id.in_(my_convs_ids),
            ConversationParticipant.user_id == other_user_id
        )
        other_part_res = await db.execute(other_part_stmt)
        existing_conv_id = other_part_res.scalars().first()
        if existing_conv_id:
            raise HTTPException(status_code=400, detail="Conversation already exists")

    # 3. Check for existing request
    req_stmt = select(MessageRequest).where(
        (MessageRequest.sender_id == current_user.id) & (MessageRequest.receiver_id == other_user_id)
    )
    req_res = await db.execute(req_stmt)
    existing_req = req_res.scalar_one_or_none()

    now = datetime.datetime.utcnow()
    if existing_req:
        if existing_req.status == "pending":
            raise HTTPException(status_code=400, detail="Request already pending")
        elif existing_req.status == "declined":
            # Check cooldown (7 days)
            cooldown_period = datetime.timedelta(days=7)
            if now - existing_req.created_at < cooldown_period:
                time_left = cooldown_period - (now - existing_req.created_at)
                days_left = time_left.days
                hours_left = int(time_left.seconds / 3600)
                raise HTTPException(
                    status_code=400,
                    detail=f"Cooldown active. You must wait {days_left} days and {hours_left} hours before requesting again."
                )
            else:
                # Reset request status to pending and update created_at
                existing_req.status = "pending"
                existing_req.created_at = now
                await db.commit()
                
                stmt = select(MessageRequest).where(MessageRequest.id == existing_req.id).options(
                    selectinload(MessageRequest.sender),
                    selectinload(MessageRequest.receiver)
                )
                res = await db.execute(stmt)
                return res.scalar_one()
        elif existing_req.status == "accepted":
            raise HTTPException(status_code=400, detail="Request already accepted")

    # Check incoming request from other to current
    incoming_stmt = select(MessageRequest).where(
        (MessageRequest.sender_id == other_user_id) & (MessageRequest.receiver_id == current_user.id)
    )
    incoming_res = await db.execute(incoming_stmt)
    incoming_req = incoming_res.scalar_one_or_none()
    if incoming_req and incoming_req.status == "pending":
        # Auto-accept
        incoming_req.status = "accepted"
        conv = Conversation()
        db.add(conv)
        await db.flush()

        part1 = ConversationParticipant(conversation_id=conv.id, user_id=current_user.id)
        part2 = ConversationParticipant(conversation_id=conv.id, user_id=other_user_id)
        db.add(part1)
        db.add(part2)

        sys_msg = Message(
            conversation_id=conv.id,
            sender_id=other_user_id,
            content="Conversation started",
            message_type="system",
            is_read=True
        )
        db.add(sys_msg)
        await db.flush()
        conv.last_message_id = sys_msg.id
        await db.commit()

        # Load request and return
        stmt = select(MessageRequest).where(MessageRequest.id == incoming_req.id).options(
            selectinload(MessageRequest.sender),
            selectinload(MessageRequest.receiver)
        )
        res = await db.execute(stmt)
        return res.scalar_one()

    # 4. Check limits for sender (5/day, 20/week)
    day_ago = now - datetime.timedelta(days=1)
    week_ago = now - datetime.timedelta(days=7)

    daily_stmt = select(MessageRequest).where(
        (MessageRequest.sender_id == current_user.id) & (MessageRequest.created_at >= day_ago)
    )
    daily_res = await db.execute(daily_stmt)
    daily_count = len(daily_res.scalars().all())
    if daily_count >= 5:
        raise HTTPException(status_code=429, detail="Daily request limit reached (max 5 requests per day)")

    weekly_stmt = select(MessageRequest).where(
        (MessageRequest.sender_id == current_user.id) & (MessageRequest.created_at >= week_ago)
    )
    weekly_res = await db.execute(weekly_stmt)
    weekly_count = len(weekly_res.scalars().all())
    if weekly_count >= 20:
        raise HTTPException(status_code=429, detail="Weekly request limit reached (max 20 requests per week)")

    # 5. Create new request
    new_req = MessageRequest(
        sender_id=current_user.id,
        receiver_id=other_user_id,
        status="pending",
        created_at=now
    )
    db.add(new_req)
    await db.commit()

    stmt = select(MessageRequest).where(MessageRequest.id == new_req.id).options(
        selectinload(MessageRequest.sender),
        selectinload(MessageRequest.receiver)
    )
    res = await db.execute(stmt)
    return res.scalar_one()


@router.post("/request/{id}/accept", response_model=ConversationResponse)
async def accept_message_request(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(MessageRequest).where(
        (MessageRequest.id == id) & (MessageRequest.receiver_id == current_user.id)
    )
    res = await db.execute(stmt)
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")

    req.status = "accepted"

    # Create active conversation
    conv = Conversation()
    db.add(conv)
    await db.flush()

    part1 = ConversationParticipant(conversation_id=conv.id, user_id=current_user.id)
    part2 = ConversationParticipant(conversation_id=conv.id, user_id=req.sender_id)
    db.add(part1)
    db.add(part2)

    sys_msg = Message(
        conversation_id=conv.id,
        sender_id=req.sender_id,
        content="Conversation started",
        message_type="system",
        is_read=True
    )
    db.add(sys_msg)
    await db.flush()

    conv.last_message_id = sys_msg.id
    await db.commit()

    # Return the conversation
    conv_stmt = select(Conversation).where(Conversation.id == conv.id).options(
        selectinload(Conversation.participants).selectinload(ConversationParticipant.user)
    )
    conv_res = await db.execute(conv_stmt)
    conv_obj = conv_res.scalar_one()

    return ConversationResponse(
        id=conv_obj.id,
        created_at=conv_obj.created_at,
        updated_at=conv_obj.updated_at,
        last_message_id=conv_obj.last_message_id,
        participants=[
            ConversationParticipantResponse(
                id=p.id,
                conversation_id=p.conversation_id,
                user_id=p.user_id,
                joined_at=p.joined_at,
                last_read_message_id=p.last_read_message_id,
                archived_at=p.archived_at,
                is_pinned=p.is_pinned,
                user=UserResponse.from_orm(p.user)
            ) for p in conv_obj.participants
        ],
        unread_count=0
    )


@router.post("/request/{id}/decline")
async def decline_message_request(
    id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(MessageRequest).where(
        (MessageRequest.id == id) & (MessageRequest.receiver_id == current_user.id)
    )
    res = await db.execute(stmt)
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")

    req.status = "declined"
    req.created_at = datetime.datetime.utcnow()  # Reset timestamp for cooldown tracking
    await db.commit()
    return {"status": "success", "message": "Request declined successfully"}


@router.post("/block/{user_id}", response_model=BlockedUserResponse)
async def block_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")

    # Check if user exists
    user_exists_stmt = select(User).where(User.id == user_id)
    user_exists_res = await db.execute(user_exists_stmt)
    blocked_user = user_exists_res.scalar_one_or_none()
    if not blocked_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if block already exists
    block_stmt = select(BlockedUser).where(
        (BlockedUser.blocker_id == current_user.id) & (BlockedUser.blocked_id == user_id)
    )
    block_res = await db.execute(block_stmt)
    existing_block = block_res.scalar_one_or_none()
    if existing_block:
        stmt = select(BlockedUser).where(BlockedUser.id == existing_block.id).options(
            selectinload(BlockedUser.blocked)
        )
        res = await db.execute(stmt)
        return res.scalar_one()

    # Create BlockedUser record
    new_block = BlockedUser(blocker_id=current_user.id, blocked_id=user_id)
    db.add(new_block)

    # Clean up pending message requests between these users
    req_del_stmt = select(MessageRequest).where(
        ((MessageRequest.sender_id == current_user.id) & (MessageRequest.receiver_id == user_id)) |
        ((MessageRequest.sender_id == user_id) & (MessageRequest.receiver_id == current_user.id))
    )
    reqs = await db.execute(req_del_stmt)
    for r in reqs.scalars().all():
        await db.delete(r)

    await db.commit()

    stmt = select(BlockedUser).where(BlockedUser.id == new_block.id).options(
        selectinload(BlockedUser.blocked)
    )
    res = await db.execute(stmt)
    return res.scalar_one()


@router.delete("/block/{user_id}")
async def unblock_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(BlockedUser).where(
        (BlockedUser.blocker_id == current_user.id) & (BlockedUser.blocked_id == user_id)
    )
    res = await db.execute(stmt)
    block = res.scalar_one_or_none()
    if not block:
        raise HTTPException(status_code=404, detail="Block record not found")

    await db.delete(block)
    await db.commit()
    return {"status": "success", "message": "User unblocked successfully"}


@router.get("/{conversation_id}", response_model=List[MessageResponse])
async def get_messages(
    conversation_id: UUID,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify participant
    part_stmt = select(ConversationParticipant).where(
        (ConversationParticipant.conversation_id == conversation_id) & (ConversationParticipant.user_id == current_user.id)
    )
    part_res = await db.execute(part_stmt)
    my_part = part_res.scalar_one_or_none()
    if not my_part:
        raise HTTPException(status_code=403, detail="Not a participant in this conversation")

    # Fetch messages with pagination in descending order first
    stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .options(
            selectinload(Message.sender),
            selectinload(Message.reactions).selectinload(MessageReaction.user)
        )
        .order_by(Message.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    res = await db.execute(stmt)
    messages = list(res.scalars().all())

    # Filter out messages deleted for this user
    messages = [
        msg for msg in messages
        if not msg.deleted_by_users or str(current_user.id) not in msg.deleted_by_users
    ]

    # Reverse back to ascending order for chronological display
    messages.reverse()

    # Mark messages sent by others as read
    unread_ids = [msg.id for msg in messages if msg.sender_id != current_user.id and not msg.is_read]
    if unread_ids:
        now = datetime.datetime.utcnow()
        unread_stmt = select(Message).where(Message.id.in_(unread_ids))
        unread_res = await db.execute(unread_stmt)
        unread_messages = unread_res.scalars().all()
        for msg in unread_messages:
            msg.is_read = True
            msg.read_at = now
        
    # Update last_read_message_id for current user
    if messages:
        my_part.last_read_message_id = messages[-1].id

    await db.commit()
    return messages


@router.post("/{conversation_id}", response_model=MessageResponse)
async def send_message(
    conversation_id: UUID,
    payload: MessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify participant
    part_stmt = select(ConversationParticipant).where(
        (ConversationParticipant.conversation_id == conversation_id) & (ConversationParticipant.user_id == current_user.id)
    )
    part_res = await db.execute(part_stmt)
    my_part = part_res.scalar_one_or_none()
    if not my_part:
        raise HTTPException(status_code=403, detail="Not a participant in this conversation")

    # Enforce blocking check
    other_parts_stmt = select(ConversationParticipant.user_id).where(
        (ConversationParticipant.conversation_id == conversation_id) & (ConversationParticipant.user_id != current_user.id)
    )
    other_parts_res = await db.execute(other_parts_stmt)
    other_user_ids = other_parts_res.scalars().all()

    if other_user_ids:
        block_stmt = select(BlockedUser).where(
            ((BlockedUser.blocker_id == current_user.id) & (BlockedUser.blocked_id.in_(other_user_ids))) |
            ((BlockedUser.blocker_id.in_(other_user_ids)) & (BlockedUser.blocked_id == current_user.id))
        )
        block_res = await db.execute(block_stmt)
        if block_res.scalars().all():
            raise HTTPException(status_code=403, detail="Cannot send message in a blocked conversation")

    # Create message
    now = datetime.datetime.utcnow()
    new_msg = Message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        content=sanitize_text(payload.content),
        message_type=payload.message_type,
        shared_item_id=payload.shared_item_id,
        is_read=False,
        created_at=now
    )
    db.add(new_msg)
    await db.flush()

    # Update conversation's last_message_id and updated_at
    conv_stmt = select(Conversation).where(Conversation.id == conversation_id)
    conv_res = await db.execute(conv_stmt)
    conv = conv_res.scalar_one()
    conv.last_message_id = new_msg.id
    conv.updated_at = now

    # Automatically unarchive for all participants
    unarchive_stmt = select(ConversationParticipant).where(ConversationParticipant.conversation_id == conversation_id)
    all_parts_res = await db.execute(unarchive_stmt)
    for p in all_parts_res.scalars().all():
        p.archived_at = None

    await db.commit()

    # Load with relationships for response
    stmt = select(Message).where(Message.id == new_msg.id).options(
        selectinload(Message.sender),
        selectinload(Message.reactions)
    )
    res = await db.execute(stmt)
    msg_obj = res.scalar_one()

    # Trigger notifications inside database feed for other users
    for uid in other_user_ids:
        user_stmt = select(User).where(User.id == uid)
        user_res = await db.execute(user_stmt)
        other_user = user_res.scalar_one_or_none()
        if other_user and other_user.email_notifications_enabled:
            title = f"💬 New message from {current_user.full_name}"
            msg_snippet = payload.content[:50] + ("..." if len(payload.content) > 50 else "")
            notif = Notification(
                user_id=uid,
                title=title,
                message=msg_snippet,
                notification_type="system",
                target_url="/dashboard/chat"
            )
            db.add(notif)
    await db.commit()

    # Broadcast message to WebSocket
    await chat_ws_manager.broadcast_to_conversation(conversation_id, {
        "event": "message:new",
        "data": {
            "id": str(msg_obj.id),
            "conversation_id": str(msg_obj.conversation_id),
            "sender_id": str(msg_obj.sender_id),
            "content": msg_obj.content,
            "message_type": msg_obj.message_type,
            "shared_item_id": str(msg_obj.shared_item_id) if msg_obj.shared_item_id else None,
            "is_read": msg_obj.is_read,
            "created_at": msg_obj.created_at.isoformat(),
            "sender": {
                "id": str(current_user.id),
                "username": current_user.username,
                "full_name": current_user.full_name,
                "avatar_url": current_user.avatar_url
            }
        }
    })

    return msg_obj


@router.put("/{message_id}", response_model=MessageResponse)
async def edit_message(
    message_id: UUID,
    payload: MessageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Message).where(Message.id == message_id).options(
        selectinload(Message.sender),
        selectinload(Message.reactions)
    )
    res = await db.execute(stmt)
    msg = res.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Cannot edit messages sent by others")

    if msg.message_type != "text":
        raise HTTPException(status_code=400, detail="Only text messages can be edited")

    now = datetime.datetime.utcnow()
    if now - msg.created_at > datetime.timedelta(minutes=15):
        raise HTTPException(status_code=400, detail="Message editing window expired (15 minutes limit)")

    msg.content = payload.content
    msg.edited_at = now
    await db.commit()

    # Broadcast edit event
    await chat_ws_manager.broadcast_to_conversation(msg.conversation_id, {
        "event": "message:edit",
        "data": {
            "id": str(msg.id),
            "conversation_id": str(msg.conversation_id),
            "content": msg.content,
            "edited_at": msg.edited_at.isoformat()
          }
    })

    return msg


@router.delete("/{message_id}")
async def delete_message(
    message_id: UUID,
    delete_type: str = "me",  # "me" or "everyone"
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Message).where(Message.id == message_id)
    res = await db.execute(stmt)
    msg = res.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    now = datetime.datetime.utcnow()
    if delete_type == "everyone":
        if msg.sender_id != current_user.id:
            raise HTTPException(status_code=403, detail="Cannot delete for everyone on messages sent by others")

        if now - msg.created_at > datetime.timedelta(minutes=15):
            raise HTTPException(status_code=400, detail="Delete for everyone window expired (15 minutes limit)")

        msg.content = "This message was deleted"
        msg.message_type = "system"
        msg.deleted_at = now
        await db.commit()

        # Broadcast delete event
        await chat_ws_manager.broadcast_to_conversation(msg.conversation_id, {
            "event": "message:delete_everyone",
            "data": {
                "id": str(msg.id),
                "conversation_id": str(msg.conversation_id)
            }
        })
    else:
        # Delete for Me
        deleted_list = list(msg.deleted_by_users) if msg.deleted_by_users else []
        if str(current_user.id) not in deleted_list:
            deleted_list.append(str(current_user.id))
            msg.deleted_by_users = deleted_list
            await db.commit()

    return {"status": "success", "message": f"Message deleted for {delete_type}"}


@router.post("/{message_id}/reaction", response_model=MessageReactionResponse)
async def add_reaction(
    message_id: UUID,
    payload: MessageReactionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    msg_stmt = select(Message).where(Message.id == message_id)
    msg_res = await db.execute(msg_stmt)
    msg = msg_res.scalar_one_or_none()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    # Verify participant
    part_stmt = select(ConversationParticipant).where(
        (ConversationParticipant.conversation_id == msg.conversation_id) & (ConversationParticipant.user_id == current_user.id)
    )
    part_res = await db.execute(part_stmt)
    if not part_res.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Not a participant in this conversation")

    # Check if reaction already exists
    react_stmt = select(MessageReaction).where(
        (MessageReaction.message_id == message_id) & (MessageReaction.user_id == current_user.id)
    )
    react_res = await db.execute(react_stmt)
    existing = react_res.scalar_one_or_none()

    if existing:
        existing.reaction = payload.reaction
        await db.commit()
        await db.refresh(existing)
        react_obj = existing
    else:
        react_obj = MessageReaction(
            message_id=message_id,
            user_id=current_user.id,
            reaction=payload.reaction
        )
        db.add(react_obj)
        await db.commit()
        await db.refresh(react_obj)

    # Broadcast reaction
    await chat_ws_manager.broadcast_to_conversation(msg.conversation_id, {
        "event": "message:reaction",
        "data": {
            "message_id": str(message_id),
            "user_id": str(current_user.id),
            "reaction": react_obj.reaction
        }
    })

    return react_obj


@router.delete("/{message_id}/reaction")
async def remove_reaction(
    message_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(MessageReaction).where(
        (MessageReaction.message_id == message_id) & (MessageReaction.user_id == current_user.id)
    )
    res = await db.execute(stmt)
    react = res.scalar_one_or_none()
    if not react:
        raise HTTPException(status_code=404, detail="Reaction not found")

    msg_stmt = select(Message).where(Message.id == message_id)
    msg_res = await db.execute(msg_stmt)
    msg = msg_res.scalar_one()

    await db.delete(react)
    await db.commit()

    # Broadcast reaction removal
    await chat_ws_manager.broadcast_to_conversation(msg.conversation_id, {
        "event": "message:reaction_remove",
        "data": {
            "message_id": str(message_id),
            "user_id": str(current_user.id)
        }
    })

    return {"status": "success", "message": "Reaction removed"}


@router.websocket("/ws/chat")
async def websocket_chat_endpoint(websocket: WebSocket, token: Optional[str] = None):
    # Retrieve token from query params if not provided in parameter
    if not token:
        token = websocket.query_params.get("token")
        
    if not token:
        await websocket.accept()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM], options={"leeway": 60})
        user_id_str: str = payload.get("sub")
        if not user_id_str:
            await websocket.accept()
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        user_id = UUID(user_id_str)
    except Exception:
        await websocket.accept()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # User is authenticated
    async with AsyncSessionLocal() as db:
        await chat_ws_manager.connect(user_id, websocket, db)

    # Listen for incoming websocket events
    active_conv_id: Optional[UUID] = None
    try:
        while True:
            data = await websocket.receive_json()
            event = data.get("event")
            event_data = data.get("data", {})

            if event == "register":
                conv_id_str = event_data.get("conversation_id")
                if conv_id_str:
                    conv_id = UUID(conv_id_str)
                    # Verify membership
                    async with AsyncSessionLocal() as db:
                        stmt = select(ConversationParticipant).where(
                            ConversationParticipant.conversation_id == conv_id,
                            ConversationParticipant.user_id == user_id
                        )
                        res = await db.execute(stmt)
                        part = res.scalar_one_or_none()
                        if part:
                            # Unregister previous conversation first if any
                            if active_conv_id:
                                chat_ws_manager.unregister_conversation(active_conv_id, websocket)
                            active_conv_id = conv_id
                            await chat_ws_manager.register_conversation(conv_id, websocket)
                            await websocket.send_json({"event": "registered", "data": {"conversation_id": str(conv_id)}})

            elif event == "typing:start":
                if active_conv_id:
                    await chat_ws_manager.broadcast_to_conversation(active_conv_id, {
                        "event": "typing:start",
                        "data": {
                            "conversation_id": str(active_conv_id),
                            "user_id": str(user_id)
                        }
                    })

            elif event == "typing:stop":
                if active_conv_id:
                    await chat_ws_manager.broadcast_to_conversation(active_conv_id, {
                        "event": "typing:stop",
                        "data": {
                            "conversation_id": str(active_conv_id),
                            "user_id": str(user_id)
                        }
                    })

            elif event == "message:read":
                if active_conv_id:
                    msg_id_str = event_data.get("message_id")
                    if msg_id_str:
                        msg_id = UUID(msg_id_str)
                        async with AsyncSessionLocal() as db:
                            # Update last_read_message_id for participant
                            part_stmt = select(ConversationParticipant).where(
                                ConversationParticipant.conversation_id == active_conv_id,
                                ConversationParticipant.user_id == user_id
                            )
                            part_res = await db.execute(part_stmt)
                            part = part_res.scalar_one_or_none()
                            if part:
                                part.last_read_message_id = msg_id
                                
                                # Update Message is_read
                                msg_stmt = select(Message).where(Message.id == msg_id)
                                msg_res = await db.execute(msg_stmt)
                                msg = msg_res.scalar_one_or_none()
                                if msg and msg.sender_id != user_id:
                                    msg.is_read = True
                                    msg.read_at = datetime.datetime.utcnow()
                                
                                await db.commit()

                                # Broadcast read update to conversation
                                await chat_ws_manager.broadcast_to_conversation(active_conv_id, {
                                    "event": "message:read",
                                    "data": {
                                        "conversation_id": str(active_conv_id),
                                        "message_id": str(msg_id),
                                        "user_id": str(user_id)
                                    }
                                })
            elif event == "heartbeat":
                await websocket.send_json({"event": "heartbeat", "data": "pong"})

    except WebSocketDisconnect:
        pass
    finally:
        # Unregister from conversation and user list
        if active_conv_id:
            chat_ws_manager.unregister_conversation(active_conv_id, websocket)
        async with AsyncSessionLocal() as db:
            await chat_ws_manager.disconnect(user_id, websocket, db)
