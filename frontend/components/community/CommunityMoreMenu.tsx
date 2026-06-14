import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Megaphone, 
  MessageCircle, 
  Calendar, 
  Trophy, 
  ClipboardList, 
  BarChart3, 
  Brain, 
  Settings, 
  MoreHorizontal 
} from "lucide-react";

interface MenuItem {
  id: string;
  label: string;
  icon: React.ComponentType<any>;
}

// Exact tab IDs matching page.tsx content gates
const PARTICIPANT_ITEMS: MenuItem[] = [
  { id: "announcements", label: "Announcements", icon: Megaphone },
  { id: "chat", label: "Community Chat", icon: MessageCircle },
  { id: "calendar", label: "Community Calendar", icon: Calendar },
  { id: "leaderboard", label: "Leaderboards", icon: Trophy }
];

const MODERATOR_ITEMS: MenuItem[] = [
  ...PARTICIPANT_ITEMS,
  { id: "requests", label: "Access Requests", icon: ClipboardList }
];

const ADMIN_HOST_ITEMS: MenuItem[] = [
  ...MODERATOR_ITEMS,
  { id: "analytics", label: "Workspace Analytics", icon: BarChart3 },
  { id: "recognition", label: "Recognition History", icon: Brain },
  { id: "settings", label: "Settings Panel", icon: Settings }
];

interface CommunityMoreMenuProps {
  currentUserRole: "participant" | "moderator" | "admin" | "host";
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isElevated: boolean;
}

export default function CommunityMoreMenu({
  currentUserRole,
  activeTab,
  setActiveTab,
  isElevated
}: CommunityMoreMenuProps) {
  // Only local state is the open/close toggle — NO internal activeTab state
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Select items list based on role
  let items: MenuItem[] = PARTICIPANT_ITEMS;
  if (currentUserRole === "host" || currentUserRole === "admin") {
    items = ADMIN_HOST_ITEMS;
  } else if (currentUserRole === "moderator") {
    items = MODERATOR_ITEMS;
  }

  // Check if any More-menu sub-tab is currently active
  const isSubTabActive = items.some(item => item.id === activeTab);

  return (
    <div className="relative" ref={containerRef}>
      {/* More Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        id="more-menu-trigger"
        className={`px-4 py-2.5 text-xs font-bold transition-all duration-300 rounded-xl relative flex items-center gap-1.5 border border-transparent ${
          isSubTabActive 
            ? "text-primary border-primary/40 bg-primary/5 shadow-[0_0_15px_rgba(6,182,212,0.25)]" 
            : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
        }`}
      >
        <span>More</span>
        <MoreHorizontal className="w-3.5 h-3.5" />
        {isSubTabActive && (
          <motion.div 
            layoutId="more-tab-underline" 
            className="absolute bottom-0 inset-x-0 h-0.5 bg-primary shadow-[0_0_10px_#06b6d4]"
          />
        )}
      </button>

      {/* Dropdowns & Sheets */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Desktop Dropdown Menu */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              role="menu"
              className="hidden md:block absolute right-0 mt-2 w-72 p-2 rounded-2xl bg-black/90 backdrop-blur-xl border border-white/[0.08] shadow-[0_10px_30px_rgba(0,0,0,0.8)] z-50 space-y-1"
            >
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={(e) => {
                      console.log("ITEM CLICKED:", item.id);
                      e.stopPropagation();
                      setActiveTab(item.id);
                      setTimeout(() => {
                        setIsOpen(false);
                      }, 0);
                    }}
                    role="menuitem"
                    id={`more-menu-item-${item.id}`}
                    className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-left transition-all ${
                      isActive 
                        ? "text-primary bg-primary/10 border-l-2 border-primary" 
                        : "text-gray-400 hover:text-white hover:bg-white/[0.04]"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-primary" : "text-gray-400"}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </motion.div>

            {/* Mobile Bottom Sheet Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />

            {/* Mobile Bottom Sheet Container */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 260, damping: 30 }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100) {
                  setIsOpen(false);
                }
              }}
              className="md:hidden fixed bottom-0 inset-x-0 max-h-[80vh] rounded-t-3xl bg-black/95 backdrop-blur-2xl border-t border-white/10 z-50 flex flex-col pb-8 select-none"
            >
              {/* Drag Handle Bar */}
              <div className="w-12 h-1 rounded-full bg-white/20 mx-auto my-3 cursor-grab active:cursor-grabbing" />
              
              <div className="px-5 py-2 border-b border-white/[0.06] mb-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">More Actions</h3>
              </div>

              {/* Scrollable list of actions */}
              <div className="overflow-y-auto px-3 space-y-1">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={(e) => {
                        console.log("ITEM CLICKED:", item.id);
                        e.stopPropagation();
                        setActiveTab(item.id);
                        setTimeout(() => {
                          setIsOpen(false);
                        }, 0);
                      }}
                      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-semibold text-left transition-all ${
                        isActive 
                          ? "text-primary bg-primary/10" 
                          : "text-gray-300 active:bg-white/[0.08]"
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${isActive ? "text-primary" : "text-gray-400"}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
