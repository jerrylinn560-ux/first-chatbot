export type Role = 'user' | 'model';

export type MessageStatus = 'sending' | 'streaming' | 'complete' | 'error';

export type ResponseStyle =
  | 'balanced'
  | 'research'
  | 'creative'
  | 'coding'
  | 'concise'
  | 'detailed'
  | 'professional'
  | 'friendly'
  | 'funny';

export interface ChatImage {
  url: string; // Base64 dataUrl or remote URL or IndexedDB key
  prompt?: string;
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3';
  style?: string;
  isGenerated?: boolean;
  mimeType?: string;
  name?: string;
  storageKey?: string; // If stored in IndexedDB
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  status: MessageStatus;
  tokens?: number;
  speed?: number; // tok/sec
  model?: string;
  error?: string;
  isBookmarked?: boolean;
  image?: ChatImage;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  model: string;
  systemInstruction?: string;
  temperature?: number;
  responseStyle?: ResponseStyle;
  isPinned?: boolean;
}

export interface ChatSettings {
  model: string;
  responseStyle: ResponseStyle;
  temperature: number;
  systemInstruction: string;
  searchGrounding: boolean;
  theme: 'dark' | 'light';
  maxContextTurns: number;
  autoModelRouting: boolean;
}

export interface ModelOption {
  id: string;
  name: string;
  badge: string;
  description: string;
  isFree: boolean;
  isDefault?: boolean;
  isAuto?: boolean;
}

export interface StreamEvent {
  text?: string;
  done?: boolean;
  error?: string;
  tokens?: number;
  speed?: number;
  modelUsed?: string;
}

export interface ImageGenParams {
  prompt: string;
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3';
  style: string;
  provider?: string;
}

export interface GeneratedImageResult {
  imageUrl: string;
  prompt: string;
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3';
  style: string;
  provider: string;
  createdAt: number;
}
