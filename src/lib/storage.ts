import { Conversation, ChatMessage, ChatSettings, ResponseStyle } from '../types/chat';
import { ALL_MODELS } from './ai/model-router';
import { BASE_PERSONALITY_PROMPT } from './ai/system-instructions';

const STORAGE_KEYS = {
  CONVERSATIONS: 'chatgpt_conversations_v2',
  ACTIVE_ID: 'chatgpt_active_conv_id',
  SETTINGS: 'chatgpt_settings_v2',
  THEME: 'chatgpt_theme',
};

export const AVAILABLE_MODELS = ALL_MODELS;

export const DEFAULT_SETTINGS: ChatSettings = {
  model: 'auto',
  responseStyle: 'balanced',
  temperature: 0.7,
  systemInstruction: BASE_PERSONALITY_PROMPT,
  searchGrounding: false,
  theme: 'dark',
  maxContextTurns: 10,
  autoModelRouting: true,
};

// Helper to generate UUIDs safely
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'id_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
}

// Generate automatic concise conversation title
export function generateTitleFromMessage(content: string): string {
  const clean = content
    .replace(/[#*`_~>[\]()]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!clean) return 'New chat';
  if (clean.length <= 36) return clean;
  return clean.substring(0, 36) + '...';
}

// Safe LocalStorage getters and setters
export function safeGetItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`[LocalStorage] Failed to parse key "${key}":`, err);
    return defaultValue;
  }
}

export function safeSetItem<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`[LocalStorage] Failed to write key "${key}":`, err);
    return false;
  }
}

// ---------------- CRUD FOR CONVERSATIONS ----------------

export function getAllConversations(): Conversation[] {
  const convs = safeGetItem<Conversation[]>(STORAGE_KEYS.CONVERSATIONS, []);
  return convs.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function searchConversations(query: string): Conversation[] {
  const convs = getAllConversations();
  if (!query.trim()) return convs;
  const q = query.toLowerCase().trim();
  return convs.filter((c) => {
    if (c.title.toLowerCase().includes(q)) return true;
    return c.messages?.some((m) => m.content.toLowerCase().includes(q));
  });
}

export function getConversationById(id: string): Conversation | null {
  const convs = getAllConversations();
  return convs.find((c) => c.id === id) || null;
}

export function saveAllConversations(conversations: Conversation[]): boolean {
  return safeSetItem(STORAGE_KEYS.CONVERSATIONS, conversations);
}

export function createNewConversation(
  title?: string,
  model = DEFAULT_SETTINGS.model,
  systemInstruction = DEFAULT_SETTINGS.systemInstruction,
  responseStyle: ResponseStyle = DEFAULT_SETTINGS.responseStyle
): Conversation {
  const newConv: Conversation = {
    id: generateId(),
    title: title || 'New chat',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
    model,
    systemInstruction,
    temperature: DEFAULT_SETTINGS.temperature,
    responseStyle,
    isPinned: false,
  };

  const convs = getAllConversations();
  convs.unshift(newConv);
  saveAllConversations(convs);
  setActiveConversationId(newConv.id);
  return newConv;
}

export function updateConversation(
  id: string,
  updates: Partial<Omit<Conversation, 'id' | 'createdAt'>>
): Conversation | null {
  const convs = getAllConversations();
  const index = convs.findIndex((c) => c.id === id);
  if (index === -1) return null;

  const updated: Conversation = {
    ...convs[index],
    ...updates,
    updatedAt: Date.now(),
  };

  convs[index] = updated;
  saveAllConversations(convs);
  return updated;
}

export function renameConversation(id: string, newTitle: string): Conversation | null {
  return updateConversation(id, { title: newTitle.trim() || 'Untitled' });
}

export function togglePinConversation(id: string): Conversation | null {
  const conv = getConversationById(id);
  if (!conv) return null;
  return updateConversation(id, { isPinned: !conv.isPinned });
}

export function deleteConversation(id: string): string | null {
  const convs = getAllConversations();
  const filtered = convs.filter((c) => c.id !== id);
  saveAllConversations(filtered);

  const currentActive = getActiveConversationId();
  if (currentActive === id) {
    const nextId = filtered.length > 0 ? filtered[0].id : null;
    if (nextId) {
      setActiveConversationId(nextId);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_ID);
    }
    return nextId;
  }
  return currentActive;
}

export function clearAllConversations(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEYS.CONVERSATIONS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVE_ID);
  } catch (err) {
    console.error('Error clearing conversations:', err);
  }
}

// ---------------- ACTIVE CONVERSATION TRACKING ----------------

export function getActiveConversationId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.ACTIVE_ID);
}

export function setActiveConversationId(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEYS.ACTIVE_ID, id);
}

// ---------------- MESSAGE MANAGEMENT ----------------

export function addMessageToConversation(
  conversationId: string,
  message: Omit<ChatMessage, 'id' | 'timestamp'>
): { conversation: Conversation; message: ChatMessage } | null {
  const conv = getConversationById(conversationId);
  if (!conv) return null;

  const fullMessage: ChatMessage = {
    id: generateId(),
    timestamp: Date.now(),
    ...message,
  };

  const updatedMessages = [...conv.messages, fullMessage];

  let title = conv.title;
  if (
    (conv.title === 'New chat' || conv.title === 'New Conversation' || !conv.title) &&
    message.role === 'user' &&
    conv.messages.length === 0
  ) {
    title = generateTitleFromMessage(message.content);
  }

  const updatedConv = updateConversation(conversationId, {
    messages: updatedMessages,
    title,
  });

  if (!updatedConv) return null;
  return { conversation: updatedConv, message: fullMessage };
}

export function updateMessageInConversation(
  conversationId: string,
  messageId: string,
  updates: Partial<ChatMessage>
): Conversation | null {
  const conv = getConversationById(conversationId);
  if (!conv) return null;

  const updatedMessages = conv.messages.map((m) =>
    m.id === messageId ? { ...m, ...updates } : m
  );

  return updateConversation(conversationId, { messages: updatedMessages });
}

export function deleteMessageAndSubsequent(
  conversationId: string,
  messageId: string
): { conversation: Conversation; deletedMessage: ChatMessage | null } | null {
  const conv = getConversationById(conversationId);
  if (!conv) return null;

  const targetIndex = conv.messages.findIndex((m) => m.id === messageId);
  if (targetIndex === -1) return null;

  const deletedMessage = conv.messages[targetIndex];
  const truncatedMessages = conv.messages.slice(0, targetIndex);

  const updated = updateConversation(conversationId, { messages: truncatedMessages });
  if (!updated) return null;
  return { conversation: updated, deletedMessage };
}

// ---------------- SETTINGS & PREFERENCES ----------------

export function getSavedSettings(): ChatSettings {
  return safeGetItem<ChatSettings>(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS);
}

export function saveSettings(settings: Partial<ChatSettings>): ChatSettings {
  const current = getSavedSettings();
  const updated: ChatSettings = { ...current, ...settings };
  safeSetItem(STORAGE_KEYS.SETTINGS, updated);
  return updated;
}

// ---------------- STORAGE METRICS & EXPORT ----------------

export function calculateStorageStats(): {
  chatCount: number;
  messageCount: number;
  bytesUsed: number;
  formattedSize: string;
} {
  if (typeof window === 'undefined') {
    return { chatCount: 0, messageCount: 0, bytesUsed: 0, formattedSize: '0 KB' };
  }

  try {
    const convs = getAllConversations();
    const chatCount = convs.length;
    const messageCount = convs.reduce((acc, c) => acc + (c.messages?.length || 0), 0);

    let totalChars = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('chatgpt_') || key.startsWith('gemini_studio'))) {
        const value = localStorage.getItem(key) || '';
        totalChars += key.length + value.length;
      }
    }
    const bytesUsed = totalChars * 2;
    const kb = bytesUsed / 1024;
    const formattedSize = kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(2)} MB`;

    return { chatCount, messageCount, bytesUsed, formattedSize };
  } catch {
    return { chatCount: 0, messageCount: 0, bytesUsed: 0, formattedSize: '0 KB' };
  }
}

export function exportAllDataAsJSON(): string {
  const convs = getAllConversations();
  const settings = getSavedSettings();
  const exportPayload = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    conversations: convs,
    settings,
  };
  return JSON.stringify(exportPayload, null, 2);
}

export function exportConversationAsMarkdown(conv: Conversation): string {
  const lines: string[] = [
    `# ${conv.title}`,
    `*Created: ${new Date(conv.createdAt).toLocaleString()}*`,
    `*Model: ${conv.model}*`,
    `*Style: ${conv.responseStyle || 'balanced'}*`,
    '',
    '---',
    '',
  ];

  for (const msg of conv.messages) {
    const roleName = msg.role === 'user' ? '### 👤 User' : '### 🤖 Assistant';
    const time = new Date(msg.timestamp).toLocaleTimeString();
    lines.push(`${roleName} (${time})`);
    lines.push('');
    if (msg.image) {
      lines.push(`![Image](${msg.image.url})`);
      if (msg.image.prompt) {
        lines.push(`*Prompt: ${msg.image.prompt}*`);
      }
      lines.push('');
    }
    lines.push(msg.content);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}
