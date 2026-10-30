import React, { useState, useEffect, useRef } from 'react';
import { Conversation } from '../types/chat';

interface SidebarProps {
  conversations: Conversation[];
  activeId: string | null;
  onSelectConversation: (id: string) => void;
  onNewChat: () => void;
  onRenameConversation: (id: string, newTitle: string) => void;
  onDeleteConversation: (id: string) => void;
  onTogglePin: (id: string) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onClearAll: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  onTogglePin,
  isOpen,
  onToggleOpen,
  theme,
  onToggleTheme,
  onOpenSettings,
  onClearAll,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // Close 3-dot menu on outside click
  useEffect(() => {
    const handleClickOutside = () => setMenuOpenId(null);
    if (menuOpenId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [menuOpenId]);

  const handleStartRename = (conv: Conversation, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditingTitle(conv.title);
    setMenuOpenId(null);
  };

  const handleSaveRename = (id: string) => {
    if (editingTitle.trim()) {
      onRenameConversation(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  const handleKeyDown = (id: string, e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveRename(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  // Filter conversations by search query
  const filteredConversations = searchQuery.trim()
    ? conversations.filter((c) => {
        const q = searchQuery.toLowerCase().trim();
        if (c.title.toLowerCase().includes(q)) return true;
        return c.messages?.some((m) => m.content.toLowerCase().includes(q));
      })
    : conversations;

  // Group conversations by date (Today, Yesterday, Previous 7 Days, Older)
  const groupConversations = () => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const startOfLast7Days = startOfToday - 7 * 24 * 60 * 60 * 1000;

    const pinned: Conversation[] = [];
    const today: Conversation[] = [];
    const yesterday: Conversation[] = [];
    const last7Days: Conversation[] = [];
    const older: Conversation[] = [];

    filteredConversations.forEach((conv) => {
      if (conv.isPinned) {
        pinned.push(conv);
        return;
      }
      const time = conv.updatedAt || conv.createdAt;
      if (time >= startOfToday) {
        today.push(conv);
      } else if (time >= startOfYesterday) {
        yesterday.push(conv);
      } else if (time >= startOfLast7Days) {
        last7Days.push(conv);
      } else {
        older.push(conv);
      }
    });

    return { pinned, today, yesterday, last7Days, older };
  };

  const groups = groupConversations();

  const renderConversationItem = (conv: Conversation) => {
    const isActive = conv.id === activeId;
    const isEditing = editingId === conv.id;
    const isMenuOpen = menuOpenId === conv.id;

    return (
      <div
        key={conv.id}
        onClick={() => !isEditing && onSelectConversation(conv.id)}
        className={`group relative flex items-center justify-between px-2.5 py-2 rounded-lg cursor-pointer transition-colors text-[13px] ${
          isActive
            ? 'bg-[#212121] dark:bg-[#212121] light:bg-[#ececec] text-[#ececec] font-medium'
            : 'text-[#b4b4b4] hover:bg-[#212121]/70 hover:text-[#ececec]'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {conv.isPinned && (
            <span className="material-symbols-outlined text-[14px] text-[#10a37f] shrink-0">
              push_pin
            </span>
          )}

          {isEditing ? (
            <input
              ref={editInputRef}
              type="text"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              onBlur={() => handleSaveRename(conv.id)}
              onKeyDown={(e) => handleKeyDown(conv.id, e)}
              onClick={(e) => e.stopPropagation()}
              className="w-full bg-[#141414] text-[#ececec] text-[13px] px-2 py-0.5 rounded border border-[#10a37f] focus:outline-none"
            />
          ) : (
            <span className="truncate leading-normal">{conv.title}</span>
          )}
        </div>

        {/* 3-dot dropdown menu trigger on hover */}
        {!isEditing && (
          <div className="relative shrink-0 ml-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpenId(isMenuOpen ? null : conv.id);
              }}
              type="button"
              className={`p-1 rounded text-[#8e8e8e] hover:text-[#ececec] transition-opacity ${
                isMenuOpen || isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
              title="More options"
            >
              <span className="material-symbols-outlined text-[16px]">more_horiz</span>
            </button>

            {/* Dropdown Menu */}
            {isMenuOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1 w-36 rounded-xl bg-[#212121] border border-[#303030] shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100"
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onTogglePin(conv.id);
                    setMenuOpenId(null);
                  }}
                  type="button"
                  className="w-full px-3 py-1.5 text-left text-xs text-[#ececec] hover:bg-[#2f2f2f] flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    {conv.isPinned ? 'keep_off' : 'push_pin'}
                  </span>
                  <span>{conv.isPinned ? 'Unpin' : 'Pin'}</span>
                </button>
                <button
                  onClick={(e) => handleStartRename(conv, e)}
                  type="button"
                  className="w-full px-3 py-1.5 text-left text-xs text-[#ececec] hover:bg-[#2f2f2f] flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[15px]">edit</span>
                  <span>Rename</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteConversation(conv.id);
                    setMenuOpenId(null);
                  }}
                  type="button"
                  className="w-full px-3 py-1.5 text-left text-xs text-[#ef4444] hover:bg-[#2f2f2f] flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[15px]">delete</span>
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onToggleOpen}
          className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-[260px] bg-[#171717] border-r border-[#303030]/60 flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Top Bar: New Chat & Collapse */}
          <div className="p-3 flex items-center justify-between gap-2">
            <button
              onClick={onNewChat}
              type="button"
              className="flex-1 flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#212121] text-[#ececec] text-sm font-medium transition-colors cursor-pointer border border-transparent hover:border-[#303030]"
              title="New chat (Ctrl+K)"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>New chat</span>
              </div>
              <span className="text-[11px] text-[#8e8e8e] font-mono">⌘K</span>
            </button>

            <button
              onClick={onToggleOpen}
              type="button"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#212121] transition-colors"
              title="Close sidebar"
            >
              <span className="material-symbols-outlined text-[20px]">view_sidebar</span>
            </button>
          </div>

          {/* Search Conversations Input */}
          <div className="px-3 pb-2">
            <div className="relative flex items-center">
              <span className="material-symbols-outlined absolute left-2.5 text-[#8e8e8e] text-[16px] pointer-events-none">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-[#212121] border border-transparent focus:border-[#424242] text-xs text-[#ececec] placeholder:text-[#8e8e8e] focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  type="button"
                  className="absolute right-2 text-[#8e8e8e] hover:text-[#ececec]"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>
          </div>

          {/* Conversations History List */}
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-3.5 no-scrollbar">
            {filteredConversations.length === 0 ? (
              <div className="py-8 text-center text-[#8e8e8e] text-xs">
                {searchQuery ? 'No matching conversations' : 'No chats yet'}
              </div>
            ) : (
              <>
                {/* Pinned */}
                {groups.pinned.length > 0 && (
                  <div className="space-y-0.5">
                    <div className="px-2 py-1 text-[11px] font-medium text-[#8e8e8e]">Pinned</div>
                    <nav className="space-y-0.5">{groups.pinned.map(renderConversationItem)}</nav>
                  </div>
                )}

                {/* Today */}
                {groups.today.length > 0 && (
                  <div className="space-y-0.5">
                    <div className="px-2 py-1 text-[11px] font-medium text-[#8e8e8e]">Today</div>
                    <nav className="space-y-0.5">{groups.today.map(renderConversationItem)}</nav>
                  </div>
                )}

                {/* Yesterday */}
                {groups.yesterday.length > 0 && (
                  <div className="space-y-0.5">
                    <div className="px-2 py-1 text-[11px] font-medium text-[#8e8e8e]">
                      Yesterday
                    </div>
                    <nav className="space-y-0.5">{groups.yesterday.map(renderConversationItem)}</nav>
                  </div>
                )}

                {/* Previous 7 Days */}
                {groups.last7Days.length > 0 && (
                  <div className="space-y-0.5">
                    <div className="px-2 py-1 text-[11px] font-medium text-[#8e8e8e]">
                      Previous 7 Days
                    </div>
                    <nav className="space-y-0.5">{groups.last7Days.map(renderConversationItem)}</nav>
                  </div>
                )}

                {/* Older */}
                {groups.older.length > 0 && (
                  <div className="space-y-0.5">
                    <div className="px-2 py-1 text-[11px] font-medium text-[#8e8e8e]">Older</div>
                    <nav className="space-y-0.5">{groups.older.map(renderConversationItem)}</nav>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Bottom Settings & User Panel */}
          <div className="p-2 border-t border-[#303030]/60 space-y-1">
            {/* Theme Toggle */}
            <button
              onClick={onToggleTheme}
              type="button"
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#212121] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">
                  {theme === 'dark' ? 'light_mode' : 'dark_mode'}
                </span>
                <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
              </div>
            </button>

            {/* Clear All History */}
            <button
              onClick={onClearAll}
              type="button"
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-[#b4b4b4] hover:text-[#ef4444] hover:bg-[#212121] transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
              <span>Clear all chats</span>
            </button>

            {/* Settings Trigger */}
            <button
              onClick={onOpenSettings}
              type="button"
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs text-[#ececec] hover:bg-[#212121] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-full bg-[#10a37f] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                  U
                </div>
                <div className="flex flex-col min-w-0 text-left">
                  <span className="font-medium truncate">ChatGPT User</span>
                  <span className="text-[10px] text-[#8e8e8e] truncate">Free Plan</span>
                </div>
              </div>
              <span className="material-symbols-outlined text-[18px] text-[#8e8e8e]">
                settings
              </span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
