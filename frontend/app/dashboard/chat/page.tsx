"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Sparkles, Heart, X, Check, Loader2, AlertCircle, ThumbsUp, ThumbsDown,
  Clock, Home, Compass, Activity, LogOut, MessageSquare, Search, Send,
  UserX, UserPlus, Smile, MoreVertical, Edit3, Archive, Pin, Trash,
  ExternalLink, MapPin, Calendar, Users
} from "lucide-react";

interface UserInfo {
  id: string;
  username: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  platform_role: string;
  is_online: boolean;
  last_seen: string | null;
}

interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  reaction: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  message_type: string; // 'text', 'image', 'photo_share', 'event_share', 'community_share', 'highlight_share', 'system'
  shared_item_id: string | null;
  is_read: boolean;
  read_at: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  sender?: UserInfo;
  reactions: MessageReaction[];
}

interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  joined_at: string;
  last_read_message_id: string | null;
  archived_at: string | null;
  is_pinned: boolean;
  user: UserInfo;
}

interface Conversation {
  id: string;
  created_at: string;
  updated_at: string;
  last_message_id: string | null;
  participants: ConversationParticipant[];
  last_message: Message | null;
  unread_count: number;
}

interface MessageRequest {
  id: string;
  sender_id: string;
  receiver_id: string;
  status: string;
  created_at: string;
  sender: UserInfo;
  receiver: UserInfo;
}

export default function ChatPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, logout } = useAuthStore();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<MessageRequest[]>([]);
  
  // Lists/Views
  const [showArchived, setShowArchived] = useState(false);
  const [showRequestsFolder, setShowRequestsFolder] = useState(false);
  
  // UI states
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<UserInfo[]>([]);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [msgInput, setMsgInput] = useState("");
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [editInput, setEditInput] = useState("");
  
  // Modals & Panels
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);
  
  // WebSockets ref
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const [msgPage, setMsgPage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [isFetchingMoreMessages, setIsFetchingMoreMessages] = useState(false);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleSignOut = () => {
    logout();
    router.push("/");
  };

  // 1. Fetch Inbox (Conversations List)
  const fetchConversations = useCallback(async (includeArchived = false) => {
    setIsLoadingList(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/messages/conversations?include_archived=${includeArchived}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingList(false);
    }
  }, [token]);

  // 2. Fetch Incoming Requests
  const fetchIncomingRequests = useCallback(async () => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/messages/requests`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        const data = await res.json();
        setIncomingRequests(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    fetchConversations(showArchived);
    fetchIncomingRequests();
  }, [isAuthenticated, showArchived, fetchConversations, fetchIncomingRequests]);

  // 3. User Search to start chats/send requests
  const handleUserSearch = async (val: string) => {
    setUserSearchQuery(val);
    if (!val.trim()) {
      setUserSearchResults([]);
      return;
    }
    setIsSearchingUsers(true);
    try {
      // Fetch users from auth search or community users search endpoint
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/communities/users/search?q=${encodeURIComponent(val)}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        const data = await res.json();
        // Exclude current user
        setUserSearchResults(data.filter((u: any) => u.id !== user?.id));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  // 4. Send Message Request
  const handleSendRequest = async (targetUserId: string) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/messages/request`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ receiver_id: targetUserId })
        }
      );
      const data = await res.json();
      if (res.ok) {
        showToast("Message request sent successfully!", "success");
        setShowNewChatModal(false);
      } else if (res.status === 200) {
        // Auto-accepted (they requested you previously)
        showToast("Conversation connected automatically!", "success");
        setShowNewChatModal(false);
        fetchConversations(showArchived);
      } else {
        showToast(data.detail || "Failed to send request", "error");
      }
    } catch (err) {
      showToast("Network error occurred", "error");
    }
  };

  // 5. Accept / Decline Requests
  const handleAcceptRequest = async (reqId: string) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/messages/request/${reqId}/accept`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        const newConv = await res.json();
        showToast("Request accepted!", "success");
        fetchIncomingRequests();
        fetchConversations(showArchived);
        setActiveConv(newConv);
      } else {
        showToast("Failed to accept request", "error");
      }
    } catch (err) {
      showToast("Network error", "error");
    }
  };

  const handleDeclineRequest = async (reqId: string) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/messages/request/${reqId}/decline`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        showToast("Request declined", "success");
        fetchIncomingRequests();
      } else {
        showToast("Failed to decline request", "error");
      }
    } catch (err) {
      showToast("Network error", "error");
    }
  };

  // 6. Fetch Chat Message History
  const fetchMessages = useCallback(async (convId: string) => {
    setIsLoadingChat(true);
    setMsgPage(1);
    setHasMoreMessages(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/messages/${convId}?limit=50&offset=0`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        if (data.length < 50) {
          setHasMoreMessages(false);
        }
        
        // Reset unread count for this active conversation locally
        setConversations(prev =>
          prev.map(c => (c.id === convId ? { ...c, unread_count: 0 } : c))
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingChat(false);
    }
  }, [token]);

  const loadMoreMessages = async () => {
    if (isFetchingMoreMessages || !hasMoreMessages || !activeConv) return;
    setIsFetchingMoreMessages(true);
    
    const container = messagesContainerRef.current;
    const prevScrollHeight = container ? container.scrollHeight : 0;
    
    try {
      const nextPage = msgPage + 1;
      const offset = (nextPage - 1) * 50;
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/messages/${activeConv.id}?limit=50&offset=${offset}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
          setMessages(prev => [...data, ...prev]);
          setMsgPage(nextPage);
          if (data.length < 50) {
            setHasMoreMessages(false);
          }
          
          setTimeout(() => {
            if (container) {
              container.scrollTop = container.scrollHeight - prevScrollHeight;
            }
          }, 10);
        } else {
          setHasMoreMessages(false);
        }
      }
    } catch (err) {
      console.error("Failed to load more messages:", err);
    } finally {
      setIsFetchingMoreMessages(false);
    }
  };

  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop === 0 && !isFetchingMoreMessages && hasMoreMessages && activeConv) {
      await loadMoreMessages();
    }
  };

  // Load chat on selection
  useEffect(() => {
    if (activeConv) {
      fetchMessages(activeConv.id);
    } else {
      setMessages([]);
    }
  }, [activeConv, fetchMessages]);

  // Scroll to latest message on initial load
  useEffect(() => {
    if (messages.length > 0 && msgPage === 1) {
      messageEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [messages, msgPage]);

  // 7. WebSocket setup for real-time chat
  useEffect(() => {
    if (!token) return;

    const apiHost = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
      .replace("http://", "")
      .replace("https://", "");
    const wsUrl = `${window.location.protocol === "https:" ? "wss://" : "ws://"}${apiHost}/api/v1/messages/ws/chat?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Chat WebSocket connected.");
      if (activeConv) {
        // Register connection for the active conversation
        ws.send(JSON.stringify({
          event: "register",
          data: { conversation_id: activeConv.id }
        }));
      }
    };

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      const { event: evtName, data } = payload;

      if (evtName === "message:new") {
        // Append message if it belongs to the active conversation
        if (activeConv && data.conversation_id === activeConv.id) {
          setMessages(prev => {
            if (prev.some(m => m.id === data.id)) return prev;
            return [...prev, data];
          });
          
          const container = messagesContainerRef.current;
          const isNearBottom = container ? (container.scrollHeight - container.scrollTop - container.clientHeight < 150) : true;
          if (isNearBottom || data.sender_id === user?.id) {
            setTimeout(() => {
              messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
            }, 50);
          }
          // Acknowledge read receipt
          ws.send(JSON.stringify({
            event: "message:read",
            data: { message_id: data.id }
          }));
        } else {
          // Increment unread count in conversations list
          setConversations(prev =>
            prev.map(c => (c.id === data.conversation_id ? { ...c, unread_count: c.unread_count + 1 } : c))
          );
        }
        
        // Refresh conversations list to update last message preview and order
        fetchConversations(showArchived);
      } else if (evtName === "typing:start") {
        if (activeConv && data.conversation_id === activeConv.id && data.user_id !== user?.id) {
          // Find full name
          const otherUser = activeConv.participants.find(p => p.user_id === data.user_id)?.user;
          if (otherUser) {
            setTypingUser(otherUser.full_name);
          }
        }
      } else if (evtName === "typing:stop") {
        if (activeConv && data.conversation_id === activeConv.id && data.user_id !== user?.id) {
          setTypingUser(null);
        }
      } else if (evtName === "message:read") {
        if (activeConv && data.conversation_id === activeConv.id) {
          setMessages(prev =>
            prev.map(m => (m.id === data.message_id ? { ...m, is_read: true, read_at: new Date().toISOString() } : m))
          );
        }
      } else if (evtName === "message:edit") {
        if (activeConv && data.conversation_id === activeConv.id) {
          setMessages(prev =>
            prev.map(m => (m.id === data.id ? { ...m, content: data.content, edited_at: data.edited_at } : m))
          );
        }
      } else if (evtName === "message:delete_everyone") {
        if (activeConv && data.conversation_id === activeConv.id) {
          setMessages(prev =>
            prev.map(m => (m.id === data.id ? { ...m, content: "This message was deleted", message_type: "system", deleted_at: new Date().toISOString() } : m))
          );
        }
      } else if (evtName === "message:reaction") {
        if (activeConv && data.conversation_id === activeConv.id) {
          setMessages(prev =>
            prev.map(m => {
              if (m.id === data.message_id) {
                const reactions = [...m.reactions];
                const existingIdx = reactions.findIndex(r => r.user_id === data.user_id);
                if (existingIdx >= 0) {
                  reactions[existingIdx].reaction = data.reaction;
                } else {
                  reactions.push({
                    id: Math.random().toString(),
                    message_id: data.message_id,
                    user_id: data.user_id,
                    reaction: data.reaction
                  });
                }
                return { ...m, reactions };
              }
              return m;
            })
          );
        }
      } else if (evtName === "message:reaction_remove") {
        if (activeConv && data.conversation_id === activeConv.id) {
          setMessages(prev =>
            prev.map(m => {
              if (m.id === data.message_id) {
                return { ...m, reactions: m.reactions.filter(r => r.user_id !== data.user_id) };
              }
              return m;
            })
          );
        }
      } else if (evtName === "user:online" || evtName === "user:offline") {
        // Update user online status in conversations list
        setConversations(prev =>
          prev.map(c => {
            const updatedParticipants = c.participants.map(p => {
              if (p.user_id === data.user_id) {
                return {
                  ...p,
                  user: {
                    ...p.user,
                    is_online: data.is_online,
                    last_seen: data.last_seen
                  }
                };
              }
              return p;
            });
            return { ...c, participants: updatedParticipants };
          })
        );
        
        // If active chat belongs to this user, update active view
        if (activeConv) {
          setActiveConv(prev => {
            if (!prev) return null;
            const updatedParticipants = prev.participants.map(p => {
              if (p.user_id === data.user_id) {
                return {
                  ...p,
                  user: {
                    ...p.user,
                    is_online: data.is_online,
                    last_seen: data.last_seen
                  }
                };
              }
              return p;
            });
            return { ...prev, participants: updatedParticipants };
          });
        }
      }
    };

    ws.onclose = () => {
      console.log("Chat WebSocket disconnected.");
    };

    return () => {
      ws.close();
    };
  }, [token, activeConv, showArchived, fetchConversations]);

  // Register conversation inside WebSocket when active selected
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && activeConv) {
      wsRef.current.send(JSON.stringify({
        event: "register",
        data: { conversation_id: activeConv.id }
      }));
    }
  }, [activeConv]);

  // 8. Sending Messages
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConv || !msgInput.trim()) return;

    const payload = {
      content: msgInput.trim(),
      message_type: "text",
      shared_item_id: null
    };
    
    setMsgInput("");
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ event: "typing:stop" }));
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/messages/${activeConv.id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        }
      );
      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        fetchConversations(showArchived);
        setTimeout(() => {
          messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 50);
      } else {
        showToast("Could not deliver message.", "error");
      }
    } catch (err) {
      showToast("Network error", "error");
    }
  };

  // 9. Send Typing State
  const handleTyping = () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({ event: "typing:start" }));

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({ event: "typing:stop" }));
      }
    }, 2000);
  };

  // 10. Edit Message
  const handleStartEdit = (msg: Message) => {
    setEditingMsg(msg);
    setEditInput(msg.content);
  };

  const handleSaveEdit = async () => {
    if (!editingMsg || !editInput.trim()) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/messages/${editingMsg.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ content: editInput.trim() })
        }
      );
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => prev.map(m => (m.id === editingMsg.id ? data : m)));
        setEditingMsg(null);
        showToast("Message edited successfully", "success");
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to edit message", "error");
      }
    } catch (err) {
      showToast("Network error", "error");
    }
  };

  // 11. Delete Message (Me or Everyone)
  const handleDeleteMessage = async (msgId: string, type: "me" | "everyone") => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/messages/${msgId}?delete_type=${type}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        if (type === "everyone") {
          setMessages(prev =>
            prev.map(m => (m.id === msgId ? { ...m, content: "This message was deleted", message_type: "system", deleted_at: new Date().toISOString() } : m))
          );
          showToast("Message deleted for everyone", "success");
        } else {
          setMessages(prev => prev.filter(m => m.id !== msgId));
          showToast("Message hidden for you", "success");
        }
      } else {
        const err = await res.json();
        showToast(err.detail || "Failed to delete message", "error");
      }
    } catch (err) {
      showToast("Network error", "error");
    }
  };

  // 12. Message Reactions
  const handleToggleReaction = async (msgId: string, emoji: string) => {
    // Find current reaction
    const msg = messages.find(m => m.id === msgId);
    const myReactionObj = msg?.reactions.find(r => r.user_id === user?.id);

    if (myReactionObj && myReactionObj.reaction === emoji) {
      // Remove reaction
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/messages/${msgId}/reaction`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        if (res.ok) {
          setMessages(prev =>
            prev.map(m => (m.id === msgId ? { ...m, reactions: m.reactions.filter(r => r.user_id !== user?.id) } : m))
          );
        }
      } catch (err) {
        console.error(err);
      }
    } else {
      // Add reaction
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/messages/${msgId}/reaction`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ reaction: emoji })
          }
        );
        if (res.ok) {
          const react = await res.json();
          setMessages(prev =>
            prev.map(m => {
              if (m.id === msgId) {
                const reactions = [...m.reactions];
                const existingIdx = reactions.findIndex(r => r.user_id === user?.id);
                if (existingIdx >= 0) {
                  reactions[existingIdx] = react;
                } else {
                  reactions.push(react);
                }
                return { ...m, reactions };
              }
              return m;
            })
          );
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // 13. Conversation Options (Pin/Archive/Block)
  const handleTogglePin = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/messages/conversations/${convId}/pin`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        showToast("Conversation pin status updated!", "success");
        fetchConversations(showArchived);
      } else {
        const err = await res.json();
        showToast(err.detail || "Could not pin chat.", "error");
      }
    } catch (err) {
      showToast("Network error", "error");
    }
  };

  const handleToggleArchive = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/messages/conversations/${convId}/archive`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        showToast(showArchived ? "Conversation restored!" : "Conversation archived!", "success");
        fetchConversations(showArchived);
        if (activeConv?.id === convId) setActiveConv(null);
      }
    } catch (err) {
      showToast("Network error", "error");
    }
  };

  const handleBlockUser = async (otherUserId: string) => {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/messages/block/${otherUserId}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (res.ok) {
        showToast("User blocked successfully", "success");
        fetchConversations(showArchived);
        setActiveConv(null);
      }
    } catch (err) {
      showToast("Network error", "error");
    }
  };

  // Helper selectors
  const getOtherParticipant = (conv: Conversation) => {
    return conv.participants.find(p => p.user_id !== user?.id);
  };

  // Rich Shared Cards CTA resolvers
  const getSharedResourceUrl = (type: string, id: string | null) => {
    if (!id) return "#";
    if (type === "photo_share") return `/dashboard/my-photos`;
    if (type === "event_share") return `/dashboard/events/${id}`;
    if (type === "community_share") return `/dashboard/my-groups/${id}`;
    return "#";
  };

  return (
    <div className="flex min-h-screen bg-[#030712] text-white overflow-hidden">
      
      {/* ====== LEFT SIDEBAR ====== */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-white/[0.06] bg-[#0a0f1a]/80 backdrop-blur-xl sticky top-0 h-screen z-20">
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-gradient-to-tr from-secondary/20 to-primary/20 border border-white/[0.08]">
              <Camera className="w-4 h-4 text-primary" />
            </div>
            <div>
              <span className="text-sm font-bold tracking-wider text-white">FaceSnap</span>
              <span className="block text-[7px] tracking-[0.2em] text-secondary font-bold uppercase -mt-0.5">
                AI Workspace OS
              </span>
            </div>
          </div>
        </div>

        <nav className="px-3 py-4 space-y-1">
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <Home className="w-4 h-4" />
            <span>Dashboard</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/discover")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <Compass className="w-4 h-4" />
            <span>Discover</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/timeline")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <Activity className="w-4 h-4" />
            <span>Personal Timeline</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/my-photos")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/[0.03] transition-all duration-200"
          >
            <Camera className="w-4 h-4" />
            <span>My Photos</span>
          </button>
          <button
            onClick={() => router.push("/dashboard/chat")}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-white bg-white/[0.04] border border-white/[0.08] transition-all duration-200"
          >
            <MessageSquare className="w-4 h-4 text-primary" />
            <span>Private Chat</span>
          </button>
        </nav>

        <div className="mt-auto px-3 py-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2.5 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-semibold text-white">
              {user?.full_name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="flex-grow min-w-0">
              <span className="text-xs font-semibold text-white block truncate">{user?.full_name}</span>
              <span className="text-[9px] text-gray-500 block truncate font-medium">@{user?.username}</span>
            </div>
            <button
              onClick={handleSignOut}
              className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400 transition-all"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ====== CHAT PANEL CONTAINER (GLASSMORPHIC WORKSPACE) ====== */}
      <main className="flex-grow flex h-screen overflow-hidden">
        
        {/* CHAT LEFT COLUMN: INBOX LIST */}
        <div className="w-80 border-r border-white/[0.06] bg-[#070b13]/60 flex flex-col h-full flex-shrink-0">
          
          {/* INBOX HEADER */}
          <div className="p-4 border-b border-white/[0.06] space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-base font-extrabold text-white tracking-tight font-display flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                <span>Inbox</span>
              </h1>
              
              <button
                onClick={() => setShowNewChatModal(true)}
                className="p-1.5 rounded-xl bg-primary hover:bg-cyan-400 text-black transition-all"
                title="Start new chat"
              >
                <UserPlus className="w-4 h-4" />
              </button>
            </div>

            {/* SEARCH */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-500" />
              <input
                type="text"
                placeholder="Search chats or messages..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  // Optional trigger backend search
                }}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs font-medium text-white focus:outline-none focus:border-primary/50 transition-all"
              />
            </div>

            {/* SWITCH FILTERS */}
            <div className="flex gap-1.5 p-1 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <button
                onClick={() => { setShowRequestsFolder(false); setShowArchived(false); }}
                className={`flex-grow py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  !showRequestsFolder && !showArchived ? "bg-white/[0.06] text-white border border-white/[0.08]" : "text-gray-400 hover:text-white"
                }`}
              >
                Chats
              </button>
              <button
                onClick={() => { setShowRequestsFolder(true); setShowArchived(false); }}
                className={`flex-grow py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider relative transition-all ${
                  showRequestsFolder ? "bg-white/[0.06] text-white border border-white/[0.08]" : "text-gray-400 hover:text-white"
                }`}
              >
                Requests
                {incomingRequests.length > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-secondary text-black text-[8px] font-extrabold">
                    {incomingRequests.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => { setShowArchived(true); setShowRequestsFolder(false); }}
                className={`flex-grow py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                  showArchived ? "bg-white/[0.06] text-white border border-white/[0.08]" : "text-gray-400 hover:text-white"
                }`}
              >
                Archived
              </button>
            </div>
          </div>

          {/* LIST STREAM */}
          <div className="flex-grow overflow-y-auto divide-y divide-white/[0.03] scrollbar-thin">
            {isLoadingList ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <span className="text-[10px] text-gray-500 uppercase font-semibold">Loading inbox...</span>
              </div>
            ) : showRequestsFolder ? (
              incomingRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                  <AlertCircle className="w-8 h-8 text-gray-600 mb-2" />
                  <span className="text-xs font-bold text-gray-400">No Pending Requests</span>
                  <span className="text-[9px] text-gray-500 mt-1 leading-normal">
                    When someone invites you to chat, their request will appear here.
                  </span>
                </div>
              ) : (
                incomingRequests.map((req) => (
                  <div key={req.id} className="p-4 hover:bg-white/[0.01] transition-all space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 border border-white/[0.08] flex items-center justify-center text-xs font-bold">
                        {req.sender.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-grow min-w-0">
                        <span className="text-xs font-bold text-white block truncate">{req.sender.full_name}</span>
                        <span className="text-[10px] text-gray-500 block truncate">@{req.sender.username}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAcceptRequest(req.id)}
                        className="flex-grow py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-[10px] font-bold transition-all flex items-center justify-center gap-1"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" />
                        <span>Accept</span>
                      </button>
                      <button
                        onClick={() => handleDeclineRequest(req.id)}
                        className="flex-grow py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-400 hover:text-red-400 text-[10px] font-semibold transition-all flex items-center justify-center gap-1"
                      >
                        <ThumbsDown className="w-3.5 h-3.5" />
                        <span>Decline</span>
                      </button>
                    </div>
                  </div>
                ))
              )
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <MessageSquare className="w-8 h-8 text-gray-600 mb-2" />
                <span className="text-xs font-bold text-gray-400">Inbox is empty</span>
                <button
                  onClick={() => setShowNewChatModal(true)}
                  className="mt-3 px-3 py-1.5 rounded-lg bg-primary hover:bg-cyan-400 text-black text-[10px] font-bold uppercase transition-all"
                >
                  Start Curation
                </button>
              </div>
            ) : (
              conversations
                .filter((conv) => {
                  if (!searchQuery.trim()) return true;
                  const other = getOtherParticipant(conv)?.user;
                  return (
                    other?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    other?.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    (conv.last_message?.content &&
                      conv.last_message.content.toLowerCase().includes(searchQuery.toLowerCase()))
                  );
                })
                .map((conv) => {
                  const otherPart = getOtherParticipant(conv);
                  const otherUser = otherPart?.user;
                  const isActive = activeConv?.id === conv.id;
                  
                  if (!otherUser) return null;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => setActiveConv(conv)}
                      className={`p-4 flex gap-3 hover:bg-white/[0.02] cursor-pointer transition-all relative group ${
                        isActive ? "bg-white/[0.03] border-l-2 border-primary" : ""
                      }`}
                    >
                      {/* AVATAR + ONLINE INDICATOR */}
                      <div className="relative flex-shrink-0">
                        {otherUser.avatar_url ? (
                          <img src={otherUser.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover border border-white/[0.08]" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-white border border-white/[0.08]">
                            {otherUser.full_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        {otherUser.is_online ? (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#070b13] z-10" />
                        ) : (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-gray-500 border-2 border-[#070b13] z-10" />
                        )}
                      </div>

                      {/* INFO DECK */}
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-bold text-white block truncate">{otherUser.full_name}</span>
                          <span className="text-[8px] text-gray-500 font-semibold tracking-wider uppercase">
                            {conv.last_message ? new Date(conv.last_message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500 block truncate mb-1">@{otherUser.username}</span>
                        
                        {/* LAST MESSAGE METADATA */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-gray-400 truncate leading-snug">
                            {conv.last_message ? (
                              conv.last_message.message_type === "text" ? (
                                conv.last_message.content
                              ) : conv.last_message.message_type === "photo_share" ? (
                                "📸 Shared a Photo"
                              ) : conv.last_message.message_type === "event_share" ? (
                                "🎉 Shared an Event"
                              ) : conv.last_message.message_type === "community_share" ? (
                                "✨ Shared a Community"
                              ) : (
                                conv.last_message.content
                              )
                            ) : (
                              "No messages yet"
                            )}
                          </span>
                          
                          {/* UNREAD BADGE */}
                          {conv.unread_count > 0 && (
                            <span className="w-4 h-4 rounded-full bg-primary text-black text-[8px] font-extrabold flex items-center justify-center">
                              {conv.unread_count}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* CONVERSATION HOVER ACTIONS */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 z-10 bg-[#070b13]/80 p-1 rounded-lg backdrop-blur">
                        <button
                          onClick={(e) => handleTogglePin(conv.id, e)}
                          className={`p-1 rounded hover:bg-white/[0.04] ${otherPart?.is_pinned ? "text-primary" : "text-gray-500"}`}
                          title={otherPart?.is_pinned ? "Unpin chat" : "Pin chat"}
                        >
                          <Pin className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => handleToggleArchive(conv.id, e)}
                          className="p-1 rounded hover:bg-white/[0.04] text-gray-500 hover:text-white"
                          title={showArchived ? "Restore chat" : "Archive chat"}
                        >
                          <Archive className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>

        {/* CHAT RIGHT COLUMN: ACTIVE STREAM */}
        <div className="flex-grow bg-[#05080e]/40 flex flex-col h-full overflow-hidden relative">
          
          {activeConv ? (
            <>
              {/* CHAT HEADER */}
              <div className="px-6 py-3 border-b border-white/[0.06] bg-[#070b13]/60 backdrop-blur-xl flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {getOtherParticipant(activeConv)?.user.avatar_url ? (
                      <img
                        src={getOtherParticipant(activeConv)?.user.avatar_url!}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover border border-white/[0.08]"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-xs font-bold text-white border border-white/[0.08]">
                        {getOtherParticipant(activeConv)?.user.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {getOtherParticipant(activeConv)?.user.is_online ? (
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-[#070b13]" />
                    ) : (
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-gray-500 border border-[#070b13]" />
                    )}
                  </div>
                  <div>
                    <h2 className="text-xs font-extrabold text-white block">
                      {getOtherParticipant(activeConv)?.user.full_name}
                    </h2>
                    <span className="text-[9px] text-gray-500 block leading-none mt-0.5">
                      {getOtherParticipant(activeConv)?.user.is_online ? (
                        <span className="text-emerald-400 font-bold">🟢 Online</span>
                      ) : (
                        getOtherParticipant(activeConv)?.user.last_seen ? (
                          `Last seen ${new Date(getOtherParticipant(activeConv)?.user.last_seen!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        ) : (
                          "Offline"
                        )
                      )}
                    </span>
                  </div>
                </div>

                {/* HEADER OPTIONS */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleBlockUser(getOtherParticipant(activeConv)?.user.id!)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] font-bold border border-red-500/20 transition-all"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>Block User</span>
                  </button>
                </div>
              </div>

              {/* MESSAGE STREAM AREA */}
              <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-grow overflow-y-auto px-6 py-6 space-y-4 scrollbar-thin"
              >
                {isLoadingChat ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3 h-full">
                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    <span className="text-[10px] text-gray-500 uppercase font-semibold">Decrypting thread...</span>
                  </div>
                ) : (
                  <>
                    {isFetchingMoreMessages && (
                      <div className="flex justify-center py-2">
                        <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      </div>
                    )}
                    {messages.map((msg) => {
                      const isMe = msg.sender_id === user?.id;
                      const hasReactions = msg.reactions.length > 0;
                      
                      if (msg.message_type === "system") {
                        return (
                          <div key={msg.id} className="flex justify-center my-2">
                            <span className="px-3 py-1 rounded-full bg-white/[0.02] border border-white/[0.04] text-[9px] text-gray-500 font-bold uppercase tracking-wider">
                              {msg.content}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div key={msg.id} className={`flex gap-3 group relative max-w-lg ${isMe ? "ml-auto flex-row-reverse" : ""}`}>
                          {/* AVATAR */}
                          <div className="relative flex-shrink-0 self-end">
                            {msg.sender?.avatar_url ? (
                              <img src={msg.sender.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover border border-white/[0.08]" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-[#1b2230] flex items-center justify-center text-[10px] font-bold text-white border border-white/[0.08]">
                                {msg.sender?.full_name.charAt(0).toUpperCase() || "?"}
                              </div>
                            )}
                          </div>

                          {/* BUBBLE WRAP */}
                          <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                            
                            {/* PREVIEW CARDS FOR MEDIA/EVENT/COMMUNITY/HIGHLIGHT SHARES */}
                            {msg.message_type === "photo_share" && msg.shared_item_id && (
                              <div className="mb-1 rounded-xl glass-panel border border-white/[0.08] overflow-hidden p-2 w-64">
                                <img src={msg.content} alt="" className="w-full h-36 object-cover rounded-lg" />
                                <div className="p-2 flex items-center justify-between gap-2 mt-1">
                                  <div className="min-w-0">
                                    <span className="text-[9px] text-primary font-bold uppercase tracking-wider block">Shared Photo</span>
                                    <span className="text-[10px] text-white font-bold block truncate">FaceMatch Discovery</span>
                                  </div>
                                  <a
                                    href={getSharedResourceUrl("photo_share", msg.shared_item_id)}
                                    className="p-1.5 rounded-lg bg-primary hover:bg-cyan-400 text-black transition-all flex items-center justify-center flex-shrink-0"
                                    title="Open Photo details"
                                  >
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              </div>
                            )}

                            {msg.message_type === "event_share" && (
                              <div className="mb-1 rounded-xl glass-panel border border-white/[0.08] p-3.5 w-64 space-y-2">
                                <div className="flex items-start gap-2">
                                  <div className="p-2 rounded-lg bg-gradient-to-tr from-secondary/15 to-primary/15 border border-white/[0.08] text-primary flex-shrink-0">
                                    <Calendar className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-[9px] text-secondary font-bold uppercase tracking-wider block">Event Invitation</span>
                                    <span className="text-xs font-bold text-white block truncate mt-0.5">{msg.content}</span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between border-t border-white/[0.04] pt-2 mt-2">
                                  <span className="text-[9px] text-gray-500 font-medium">FaceSnap Events</span>
                                  <a
                                    href={getSharedResourceUrl("event_share", msg.shared_item_id)}
                                    className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.12] text-gray-300 hover:text-white text-[9px] font-bold transition-all"
                                  >
                                    View Details
                                  </a>
                                </div>
                              </div>
                            )}

                            {msg.message_type === "community_share" && (
                              <div className="mb-1 rounded-xl glass-panel border border-white/[0.08] p-3.5 w-64 space-y-2">
                                <div className="flex items-start gap-2">
                                  <div className="p-2 rounded-lg bg-gradient-to-tr from-secondary/15 to-primary/15 border border-white/[0.08] text-primary flex-shrink-0">
                                    <Users className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-[9px] text-primary font-bold uppercase tracking-wider block">Shared Community</span>
                                    <span className="text-xs font-bold text-white block truncate mt-0.5">{msg.content}</span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between border-t border-white/[0.04] pt-2 mt-2">
                                  <span className="text-[9px] text-gray-500 font-medium">Join Workspace</span>
                                  <a
                                    href={getSharedResourceUrl("community_share", msg.shared_item_id)}
                                    className="px-2.5 py-1 rounded-lg bg-primary hover:bg-cyan-400 text-black text-[9px] font-bold transition-all"
                                  >
                                    Explore Group
                                  </a>
                                </div>
                              </div>
                            )}

                            {msg.message_type === "highlight_share" && (
                              <div className="mb-1 rounded-xl glass-panel border border-white/[0.08] p-3.5 w-64 space-y-2">
                                <div className="flex items-start gap-2">
                                  <div className="p-2 rounded-lg bg-gradient-to-tr from-secondary/15 to-primary/15 border border-white/[0.08] text-primary flex-shrink-0">
                                    <Sparkles className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-[9px] text-primary font-bold uppercase tracking-wider block">Shared Album</span>
                                    <span className="text-xs font-bold text-white block truncate mt-0.5">{msg.content}</span>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between border-t border-white/[0.04] pt-2 mt-2">
                                  <span className="text-[9px] text-gray-500 font-medium">AI Best Moments</span>
                                  <a
                                    href={getSharedResourceUrl("photo_share", msg.shared_item_id)}
                                    className="px-2.5 py-1 rounded-lg bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.12] text-gray-300 hover:text-white text-[9px] font-bold transition-all"
                                  >
                                    Open Gallery
                                  </a>
                                </div>
                              </div>
                            )}

                            {/* Standard text bubble */}
                            {msg.message_type === "text" && (
                              <div
                                className={`px-4 py-2.5 rounded-2xl text-xs font-medium leading-relaxed max-w-sm relative ${
                                  isMe
                                    ? "bg-primary text-[#030712] rounded-br-none"
                                    : "bg-white/[0.03] border border-white/[0.06] text-gray-200 rounded-bl-none"
                                }`}
                              >
                                {msg.content}
                              </div>
                            )}

                            {/* REACTION DECK ON BUBBLE */}
                            {hasReactions && (
                              <div className={`flex gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}>
                                {msg.reactions.map((r) => (
                                  <span
                                    key={r.id}
                                    className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.08] text-[10px] flex items-center justify-center"
                                  >
                                    {r.reaction}
                                  </span>
                                ))}
                              </div>
                            )}

                            {/* TIMESTAMPS + EDIT INDICATOR */}
                            <div className="flex items-center gap-1.5 mt-1 text-[8px] text-gray-500 font-semibold uppercase tracking-wider">
                              <span>
                                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {msg.edited_at && <span>• Edited</span>}
                              {isMe && (
                                <span className={msg.is_read ? "text-primary" : "text-gray-500"}>
                                  {msg.is_read ? "✓✓ Read" : "✓ Sent"}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* BUBBLE OVERLAYS & DROP OPTIONS */}
                          <div className={`absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 z-10 bg-[#05080e]/95 p-1 px-2 rounded-xl border border-white/[0.06] ${
                            isMe ? "right-full mr-2" : "left-full ml-2"
                          }`}>
                            
                            {/* QUICK REACTION PILLS */}
                            {["👍", "❤️", "🔥", "😂", "👏"].map((emoji) => (
                              <button
                                key={emoji}
                                onClick={() => handleToggleReaction(msg.id, emoji)}
                                className="hover:scale-120 transition-transform text-xs"
                              >
                                {emoji}
                              </button>
                            ))}
                            
                            {/* EDIT/DELETE CONTEXT MENU */}
                            {isMe && msg.message_type === "text" && (
                              <>
                                <div className="w-[1px] h-3 bg-white/[0.1] mx-1" />
                                <button
                                  onClick={() => handleStartEdit(msg)}
                                  className="p-1 rounded hover:bg-white/[0.04] text-gray-400 hover:text-white"
                                  title="Edit message"
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMessage(msg.id, "everyone")}
                                  className="p-1 rounded hover:bg-white/[0.04] text-gray-400 hover:text-red-400"
                                  title="Delete for everyone"
                                >
                                  <Trash className="w-3 h-3" />
                                </button>
                              </>
                            )}

                            {/* DELETE FOR ME ONLY */}
                            <button
                              onClick={() => handleDeleteMessage(msg.id, "me")}
                              className="p-1 rounded hover:bg-white/[0.04] text-gray-400 hover:text-red-400"
                              title="Delete for me"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messageEndRef} />
                  </>
                )}
              </div>

              {/* TYPING STATUS */}
              {typingUser && (
                <div className="px-6 py-2 bg-black/[0.02] border-t border-white/[0.02]">
                  <span className="text-[10px] text-primary font-bold animate-pulse">
                    ✍️ {typingUser} is typing...
                  </span>
                </div>
              )}

              {/* EDITING WIDGET PANEL */}
              {editingMsg && (
                <div className="px-6 py-3 bg-primary/10 border-t border-primary/20 flex items-center justify-between gap-4">
                  <div className="flex-grow min-w-0">
                    <span className="text-[9px] text-primary font-bold uppercase tracking-wider block">Editing message</span>
                    <input
                      type="text"
                      value={editInput}
                      onChange={(e) => setEditInput(e.target.value)}
                      className="w-full bg-transparent text-xs text-white border-none focus:outline-none mt-1 font-medium"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={handleSaveEdit}
                      className="px-3 py-1.5 rounded-lg bg-primary hover:bg-cyan-400 text-black text-[10px] font-bold uppercase tracking-wider transition-all"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => setEditingMsg(null)}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-gray-300 hover:text-white text-[10px] font-bold uppercase tracking-wider transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* MESSAGES INPUT FIELD */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-white/[0.06] bg-[#070b13]/60 backdrop-blur-xl flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Say something nice..."
                  value={msgInput}
                  onChange={(e) => {
                    setMsgInput(e.target.value);
                    handleTyping();
                  }}
                  className="flex-grow px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs font-medium text-white focus:outline-none focus:border-primary/50 transition-all"
                />
                
                <button
                  type="submit"
                  disabled={!msgInput.trim()}
                  className="p-2.5 rounded-xl bg-primary hover:bg-cyan-400 disabled:opacity-40 disabled:hover:bg-primary text-black transition-all flex items-center justify-center flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            /* EMPTY VIEW */
            <div className="flex-grow flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 border border-white/[0.08] flex items-center justify-center text-primary mb-6 animate-pulse">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-display font-extrabold text-white tracking-tight">
                Private Chat Workspace
              </h2>
              <p className="mt-2 text-xs text-gray-500 max-w-sm leading-relaxed">
                Connect directly with community hosts, photographers, and other members. Share event galleries, highlight photos, and collaborate privately.
              </p>
              
              <button
                onClick={() => setShowNewChatModal(true)}
                className="mt-6 px-4 py-2.5 rounded-xl bg-primary hover:bg-cyan-400 text-black text-xs font-bold uppercase transition-all shadow-lg shadow-primary/10 flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Start New Conversation</span>
              </button>
            </div>
          )}

        </div>
      </main>

      {/* START NEW CHAT / SEARCH USER MODAL */}
      <AnimatePresence>
        {showNewChatModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNewChatModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="w-full max-w-md rounded-2xl glass-panel border border-white/[0.08] p-6 relative z-10"
            >
              <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-primary to-secondary rounded-t-2xl" />
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-primary" />
                  <h2 className="text-base font-bold text-white font-display">New Message</h2>
                </div>
                <button onClick={() => setShowNewChatModal(false)} className="text-gray-500 hover:text-gray-300">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                {/* SEARCH INPUT */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search by username or name..."
                    value={userSearchQuery}
                    onChange={(e) => handleUserSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/[0.02] border border-white/[0.06] text-xs font-medium text-white focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>

                {/* RESULTS */}
                <div className="max-h-60 overflow-y-auto divide-y divide-white/[0.04] scrollbar-thin">
                  {isSearchingUsers ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    </div>
                  ) : userSearchResults.length === 0 ? (
                    <div className="py-10 text-center">
                      <span className="text-xs text-gray-500">
                        {userSearchQuery ? "No members found" : "Type to look up FaceSnap members"}
                      </span>
                    </div>
                  ) : (
                    userSearchResults.map((usr) => (
                      <div key={usr.id} className="py-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#1b2230] border border-white/[0.08] flex items-center justify-center text-xs font-bold">
                            {usr.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white block">{usr.full_name}</span>
                            <span className="text-[10px] text-gray-500 block">@{usr.username}</span>
                          </div>
                        </div>
                        
                        <button
                          onClick={() => handleSendRequest(usr.id)}
                          className="px-3 py-1.5 rounded-lg bg-primary hover:bg-cyan-400 text-black text-[10px] font-bold transition-all"
                        >
                          Request Chat
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* TOAST SYSTEM */}
      <AnimatePresence>
        {toast && (
          <div className="fixed bottom-6 right-6 z-50">
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.95 }}
              className={`p-4 rounded-xl border flex items-center gap-3 shadow-2xl backdrop-blur-md ${
                toast.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-red-500/10 border-red-500/20 text-red-400"
              }`}
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-bold tracking-tight leading-none">{toast.msg}</span>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
