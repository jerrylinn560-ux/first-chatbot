import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Conversation, ChatSettings, ResponseStyle } from './types/chat';
import {
  getAllConversations,
  getConversationById,
  createNewConversation,
  updateConversation,
  renameConversation,
  togglePinConversation,
  deleteConversation,
  clearAllConversations,
  getActiveConversationId,
  setActiveConversationId,
  addMessageToConversation,
  updateMessageInConversation,
  deleteMessageAndSubsequent,
  getSavedSettings,
  saveSettings,
  calculateStorageStats,
  exportAllDataAsJSON,
  exportConversationAsMarkdown,
  AVAILABLE_MODELS,
  DEFAULT_SETTINGS,
} from './lib/storage';
import { storeImageInDB } from './lib/imageStorage';

import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { ChatWindow } from './components/ChatWindow';
import { ChatInput } from './components/ChatInput';
import { ConfigModal } from './components/ConfigModal';
import { ClearConfirmModal } from './components/ClearConfirmModal';
import { EditPromptModal } from './components/EditPromptModal';
import { ImageGenModal } from './components/ImageGenModal';

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [settings, setSettingsState] = useState<ChatSettings>(DEFAULT_SETTINGS);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Streaming & Inference states
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Modals state
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isImageGenOpen, setIsImageGenOpen] = useState(false);
  const [clearModal, setClearModal] = useState<{
    isOpen: boolean;
    type: 'active' | 'all';
    title: string;
    description: string;
  }>({
    isOpen: false,
    type: 'active',
    title: '',
    description: '',
  });

  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    messageId: string | null;
    content: string;
  }>({
    isOpen: false,
    messageId: null,
    content: '',
  });

  // Storage metrics
  const [storageStats, setStorageStats] = useState(calculateStorageStats());

  // Initialize data on mount
  useEffect(() => {
    // 1. Load settings and theme
    const savedSettings = getSavedSettings();
    setSettingsState(savedSettings);

    // Apply theme to document root
    if (savedSettings.theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }

    // 2. Load conversations
    let convs = getAllConversations();
    if (convs.length === 0) {
      const initialConv = createNewConversation(
        'New chat',
        savedSettings.model,
        savedSettings.systemInstruction,
        savedSettings.responseStyle
      );
      convs = [initialConv];
    }

    setConversations(convs);

    // 3. Set active conversation
    const savedActiveId = getActiveConversationId();
    if (savedActiveId && convs.some((c) => c.id === savedActiveId)) {
      setActiveId(savedActiveId);
    } else {
      setActiveId(convs[0].id);
      setActiveConversationId(convs[0].id);
    }

    setStorageStats(calculateStorageStats());
  }, []);

  // Keyboard shortcut: Cmd+K / Ctrl+K for new chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        handleNewChat();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [settings]);

  // Current active conversation object
  const activeConversation = conversations.find((c) => c.id === activeId) || null;

  // Sync state from storage
  const syncConversations = useCallback(() => {
    const refreshed = getAllConversations();
    setConversations(refreshed);
    setStorageStats(calculateStorageStats());
  }, []);

  // ---------------- CONVERSATION CRUD ACTIONS ----------------

  const handleNewChat = () => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
    }
    const newConv = createNewConversation(
      'New chat',
      settings.model,
      settings.systemInstruction,
      settings.responseStyle
    );
    syncConversations();
    setActiveId(newConv.id);
  };

  const handleSelectConversation = (id: string) => {
    if (isStreaming) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
    }
    setActiveId(id);
    setActiveConversationId(id);
    if (window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  };

  const handleRename = (id: string, newTitle: string) => {
    renameConversation(id, newTitle);
    syncConversations();
  };

  const handleTogglePin = (id: string) => {
    togglePinConversation(id);
    syncConversations();
  };

  const handleDelete = (id: string) => {
    const nextActive = deleteConversation(id);
    syncConversations();
    if (nextActive) {
      setActiveId(nextActive);
    } else {
      const fresh = createNewConversation('New chat', settings.model);
      syncConversations();
      setActiveId(fresh.id);
    }
  };

  const handleClearActiveChat = () => {
    if (!activeId) return;
    updateConversation(activeId, { messages: [] });
    syncConversations();
  };

  const handleClearAllHistory = () => {
    clearAllConversations();
    const fresh = createNewConversation('New chat', settings.model);
    syncConversations();
    setActiveId(fresh.id);
  };

  // ---------------- STREAMING SEND & MULTIMODAL LOGIC ----------------

  const handleSendMessage = async (
    promptText: string,
    attachedImage?: { url: string; mimeType: string; name: string }
  ) => {
    if (!activeId || (!promptText.trim() && !attachedImage) || isStreaming) return;

    // Check if user is asking to generate an image via natural language prompt
    const isImageRequest =
      !attachedImage &&
      /^\s*(generate|create|draw|paint|render|make)\s+(an?\s+)?(image|picture|photo|illustration|art|graphic|drawing)\b/i.test(
        promptText
      );

    if (isImageRequest) {
      const extractedPrompt = promptText
        .replace(/^\s*(generate|create|draw|paint|render|make)\s+(an?\s+)?(image|picture|photo|illustration|art|graphic|drawing)\s+(of\s+)?/i, '')
        .trim();
      handleGenerateImage(extractedPrompt || promptText, '1:1', 'photorealistic');
      return;
    }

    // 1. Add user message (with optional attached image)
    const userMsgResult = addMessageToConversation(activeId, {
      role: 'user',
      content: promptText.trim(),
      status: 'complete',
      image: attachedImage ? { url: attachedImage.url, mimeType: attachedImage.mimeType, name: attachedImage.name } : undefined,
    });

    if (!userMsgResult) return;

    // 2. Add placeholder assistant message
    const assistantMsgResult = addMessageToConversation(activeId, {
      role: 'model',
      content: '',
      status: 'streaming',
      model: settings.model,
    });

    if (!assistantMsgResult) return;
    const assistantMessageId = assistantMsgResult.message.id;
    setStreamingMessageId(assistantMessageId);
    setIsStreaming(true);

    syncConversations();

    // 3. Prepare context payload
    const latestConv = getConversationById(activeId);
    const existingMessages = latestConv?.messages || [];
    const contextSlice = existingMessages
      .filter((m) => m.id !== assistantMessageId)
      .slice(-settings.maxContextTurns);

    const apiMessages = contextSlice.map((m) => ({
      role: m.role,
      content: m.content,
      image: m.image,
    }));

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let accumulatedText = '';
    let totalTokens = 0;
    let finalSpeed = 0;
    let actualModelUsed = settings.model;
    const requestStartTime = Date.now();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: apiMessages,
          model: settings.model,
          responseStyle: settings.responseStyle,
          temperature: settings.temperature,
          systemInstruction: settings.systemInstruction,
          searchGrounding: settings.searchGrounding,
          stream: true,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('ReadableStream not supported by browser.');
      }

      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            try {
              const data = JSON.parse(dataStr);

              if (data.error) {
                throw new Error(data.error);
              }

              if (data.text) {
                accumulatedText += data.text;

                // High-performance React state update in memory without blocking disk I/O on every chunk!
                setConversations((prev) =>
                  prev.map((c) =>
                    c.id === activeId
                      ? {
                          ...c,
                          messages: c.messages.map((m) =>
                            m.id === assistantMessageId
                              ? { ...m, content: accumulatedText, status: 'streaming' }
                              : m
                          ),
                        }
                      : c
                  )
                );
              }

              if (data.done) {
                totalTokens = data.tokens || Math.round(accumulatedText.length / 4);
                finalSpeed = data.speed || Math.round(totalTokens / 2);
                if (data.modelUsed) actualModelUsed = data.modelUsed;
              }
            } catch (parseErr: any) {
              if (parseErr.message && !parseErr.message.includes('JSON')) {
                throw parseErr;
              }
            }
          }
        }
      }

      // Finish streaming successfully - Save to LocalStorage once upon completion
      const duration = Date.now() - requestStartTime;
      updateMessageInConversation(activeId, assistantMessageId, {
        content: accumulatedText,
        status: 'complete',
        tokens: totalTokens || Math.max(Math.round(accumulatedText.length / 4), 1),
        speed: finalSpeed || Math.round(totalTokens / (duration / 1000 || 1)),
        model: actualModelUsed,
      });
      syncConversations();
    } catch (err: any) {
      if (err.name === 'AbortError') {
        updateMessageInConversation(activeId, assistantMessageId, {
          content: accumulatedText || '(Generation stopped)',
          status: 'complete',
        });
      } else {
        console.error('Chat error:', err);
        updateMessageInConversation(activeId, assistantMessageId, {
          status: 'error',
          error:
            err.message || 'An error occurred while communicating with the assistant.',
        });
      }
      syncConversations();
    } finally {
      setIsStreaming(false);
      setStreamingMessageId(null);
      abortControllerRef.current = null;
    }
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // ---------------- REAL AI IMAGE GENERATION ----------------

  const handleGenerateImage = async (
    prompt: string,
    aspectRatio: '1:1' | '16:9' | '9:16' | '4:3',
    style: string
  ) => {
    if (!activeId || !prompt.trim() || isGeneratingImage) return;

    setIsGeneratingImage(true);

    // 1. Add user message
    addMessageToConversation(activeId, {
      role: 'user',
      content: `Generate image: ${prompt.trim()} (${style}, ${aspectRatio})`,
      status: 'complete',
    });

    // 2. Add placeholder assistant image message
    const assistantResult = addMessageToConversation(activeId, {
      role: 'model',
      content: 'Generating your AI image with Flux / Gemini Engine...',
      status: 'streaming',
    });

    syncConversations();

    try {
      const response = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          aspectRatio,
          style,
        }),
      });

      if (!response.ok) {
        throw new Error('Image generation request failed.');
      }

      const result = await response.json();

      if (result.error) {
        throw new Error(result.error);
      }

      // Store in IndexedDB for persistent storage
      const imageId = `img_${Date.now()}`;
      await storeImageInDB(imageId, result.imageUrl);

      if (assistantResult) {
        updateMessageInConversation(activeId, assistantResult.message.id, {
          content: '',
          status: 'complete',
          image: {
            url: result.imageUrl,
            prompt: result.prompt,
            aspectRatio: result.aspectRatio,
            style: result.style,
            isGenerated: true,
            storageKey: imageId,
          },
        });
      }
      syncConversations();
    } catch (err: any) {
      console.error('Image generation error:', err);
      if (assistantResult) {
        updateMessageInConversation(activeId, assistantResult.message.id, {
          content: '',
          status: 'error',
          error: err.message || 'Failed to generate image. Please try again.',
        });
      }
      syncConversations();
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Regenerate assistant response
  const handleRegenerate = (msgIndex: number) => {
    if (!activeConversation) return;
    const msgs = activeConversation.messages;
    if (msgIndex < 0 || msgIndex >= msgs.length) return;

    let userPrompt = '';
    let userImg: any = undefined;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        userPrompt = msgs[i].content;
        userImg = msgs[i].image;
        break;
      }
    }

    if (!userPrompt && !userImg) return;

    const targetMsg = msgs[msgIndex];
    deleteMessageAndSubsequent(activeConversation.id, targetMsg.id);
    syncConversations();

    handleSendMessage(userPrompt, userImg);
  };

  // Edit user message and re-run
  const handleEditMessage = (messageId: string, currentContent: string) => {
    setEditModal({
      isOpen: true,
      messageId,
      content: currentContent,
    });
  };

  const handleSaveAndResubmitEdit = (messageId: string, updatedContent: string) => {
    if (!activeConversation) return;

    deleteMessageAndSubsequent(activeConversation.id, messageId);
    syncConversations();

    handleSendMessage(updatedContent);
  };

  // ---------------- SETTINGS & THEME ----------------

  const handleSaveSettings = (newSettings: Partial<ChatSettings>) => {
    const updated = saveSettings(newSettings);
    setSettingsState(updated);
  };

  const handleToggleTheme = () => {
    const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
    const updated = saveSettings({ theme: newTheme });
    setSettingsState(updated);

    if (newTheme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
    }
  };

  const handleSelectModel = (modelId: string) => {
    const updated = saveSettings({ model: modelId });
    setSettingsState(updated);
    if (activeId) {
      updateConversation(activeId, { model: modelId });
      syncConversations();
    }
  };

  const handleSelectStyle = (style: ResponseStyle) => {
    const updated = saveSettings({ responseStyle: style });
    setSettingsState(updated);
    if (activeId) {
      updateConversation(activeId, { responseStyle: style });
      syncConversations();
    }
  };

  // ---------------- EXPORT HANDLERS ----------------

  const handleExportJSON = () => {
    const dataStr = exportAllDataAsJSON();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatgpt-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportMarkdown = () => {
    if (!activeConversation) return;
    const md = exportConversationAsMarkdown(activeConversation);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeConversation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#212121] text-[#ececec]">
      {/* ChatGPT Sidebar */}
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onRenameConversation={handleRename}
        onDeleteConversation={handleDelete}
        onTogglePin={handleTogglePin}
        isOpen={isSidebarOpen}
        onToggleOpen={() => setIsSidebarOpen(!isSidebarOpen)}
        theme={settings.theme}
        onToggleTheme={handleToggleTheme}
        onOpenSettings={() => setIsConfigOpen(true)}
        onClearAll={() => {
          setClearModal({
            isOpen: true,
            type: 'all',
            title: 'Delete all chats?',
            description:
              'This will permanently delete all conversation history from your browser LocalStorage.',
          });
        }}
      />

      {/* Main Chat Workspace */}
      <div
        className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-200 relative ${
          isSidebarOpen ? 'lg:pl-[260px]' : 'lg:pl-0'
        }`}
      >
        {/* ChatGPT Header */}
        <Header
          models={AVAILABLE_MODELS}
          currentModel={settings.model}
          onSelectModel={handleSelectModel}
          onNewChat={handleNewChat}
          onOpenConfig={() => setIsConfigOpen(true)}
          onOpenImageGen={() => setIsImageGenOpen(true)}
          onExportMarkdown={handleExportMarkdown}
          onExportJSON={handleExportJSON}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
          currentStyle={settings.responseStyle}
        />

        {/* Scrollable Message Feed */}
        <main className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
          <ChatWindow
            conversation={activeConversation}
            isStreaming={isStreaming}
            streamingMessageId={streamingMessageId}
            onEditMessage={handleEditMessage}
            onRegenerateResponse={handleRegenerate}
            onSendSuggestion={(text) => handleSendMessage(text)}
            onOpenImageGen={() => setIsImageGenOpen(true)}
            onRegenerateImage={(prompt) => handleGenerateImage(prompt, '1:1', 'photorealistic')}
          />
        </main>

        {/* Floating Composer Deck */}
        <div
          className={`fixed bottom-0 ${
            isSidebarOpen ? 'lg:left-[260px]' : 'lg:left-0'
          } left-0 right-0 bg-gradient-to-t from-[#212121] via-[#212121]/95 to-transparent pt-6 pb-3 z-20 pointer-events-none transition-all duration-200`}
        >
          <div className="pointer-events-auto">
            <ChatInput
              onSendMessage={handleSendMessage}
              isStreaming={isStreaming}
              onStopGeneration={handleStopGeneration}
              onOpenImageGen={() => setIsImageGenOpen(true)}
              currentStyle={settings.responseStyle}
              onSelectStyle={handleSelectStyle}
            />
          </div>
        </div>
      </div>

      {/* Real AI Image Generation Modal */}
      <ImageGenModal
        isOpen={isImageGenOpen}
        onClose={() => setIsImageGenOpen(false)}
        onGenerate={handleGenerateImage}
        isGenerating={isGeneratingImage}
      />

      {/* Settings Modal */}
      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        settings={settings}
        onSaveSettings={handleSaveSettings}
        storageStats={{
          chatCount: storageStats.chatCount,
          messageCount: storageStats.messageCount,
          formattedSize: storageStats.formattedSize,
        }}
        onExportJSON={handleExportJSON}
        onClearAllStorage={() => {
          setIsConfigOpen(false);
          setClearModal({
            isOpen: true,
            type: 'all',
            title: 'Delete all chats?',
            description:
              'This will permanently delete all saved conversations from your browser LocalStorage.',
          });
        }}
      />

      {/* Clear Confirmation Modal */}
      <ClearConfirmModal
        isOpen={clearModal.isOpen}
        onClose={() => setClearModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={() => {
          if (clearModal.type === 'active') {
            handleClearActiveChat();
          } else {
            handleClearAllHistory();
          }
        }}
        title={clearModal.title}
        description={clearModal.description}
      />

      {/* Edit Prompt Modal */}
      <EditPromptModal
        isOpen={editModal.isOpen}
        onClose={() => setEditModal((prev) => ({ ...prev, isOpen: false }))}
        messageId={editModal.messageId}
        initialContent={editModal.content}
        onSaveAndResubmit={handleSaveAndResubmitEdit}
      />
    </div>
  );
}
