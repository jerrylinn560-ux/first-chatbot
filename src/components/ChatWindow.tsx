import React, { useEffect, useRef, useState } from 'react';
import { Conversation } from '../types/chat';
import { MarkdownRenderer } from './MarkdownRenderer';
import { GeneratedImageViewer } from './GeneratedImageViewer';

interface ChatWindowProps {
  conversation: Conversation | null;
  isStreaming: boolean;
  streamingMessageId: string | null;
  onEditMessage: (messageId: string, currentContent: string) => void;
  onRegenerateResponse: (messageIndex: number) => void;
  onSendSuggestion: (text: string) => void;
  onOpenImageGen: () => void;
  onRegenerateImage?: (prompt: string) => void;
}

const CHATGPT_SUGGESTIONS = [
  {
    title: 'Help me debug a problem',
    desc: 'Paste code or describe an error to find the root cause',
    prompt: 'I have a bug in my code. Can you help me troubleshoot it step by step?',
    icon: 'code',
  },
  {
    title: 'Generate an AI Image',
    desc: 'Photorealistic landscapes, characters, or concept art',
    prompt: 'Generate a photorealistic cinematic render of a futuristic cyberpunk city at dusk',
    icon: 'palette',
    isImageGen: true,
  },
  {
    title: 'Explain a complex concept',
    desc: 'Break down difficult technical or academic ideas simply',
    prompt: 'Explain how vector databases and embeddings work using a simple analogy.',
    icon: 'lightbulb',
  },
  {
    title: 'Draft a professional message',
    desc: 'Emails, updates, proposals, or announcements',
    prompt: 'Help me draft a concise, polite email updating my team on project progress.',
    icon: 'edit_note',
  },
];

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  isStreaming,
  streamingMessageId,
  onEditMessage,
  onRegenerateResponse,
  onSendSuggestion,
  onOpenImageGen,
  onRegenerateImage,
}) => {
  const scrollEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, 'up' | 'down'>>({});

  // Auto-scroll to bottom smoothly on new chunks or messages
  useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages, isStreaming]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleFeedback = (id: string, type: 'up' | 'down') => {
    setFeedbackMap((prev) => ({
      ...prev,
      [id]: prev[id] === type ? undefined! : type,
    }));
  };

  const messages = conversation?.messages || [];

  return (
    <div
      ref={containerRef}
      className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 pt-4 pb-48 flex flex-col justify-between"
    >
      {/* Welcome Screen when Empty */}
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
          {/* Centered ChatGPT Sparkle Icon */}
          <div className="w-12 h-12 rounded-full bg-[#10a37f] text-white flex items-center justify-center mb-6 shadow-md">
            <span className="material-symbols-outlined text-[28px]">smart_toy</span>
          </div>

          <h2 className="text-2xl font-semibold text-[#ececec] tracking-tight">
            What can I help with today?
          </h2>

          {/* 4 Clean Suggestion Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-8 w-full max-w-2xl text-left">
            {CHATGPT_SUGGESTIONS.map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  if (item.isImageGen) {
                    onOpenImageGen();
                  } else {
                    onSendSuggestion(item.prompt);
                  }
                }}
                type="button"
                className="p-3.5 rounded-2xl bg-[#212121] hover:bg-[#2f2f2f] border border-[#303030]/80 transition-all text-left cursor-pointer group flex items-start gap-3"
              >
                <span className="material-symbols-outlined text-[#8e8e8e] group-hover:text-[#10a37f] text-[20px] mt-0.5 transition-colors">
                  {item.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-[#ececec] group-hover:text-white">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-[#8e8e8e] mt-0.5 truncate">{item.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Conversation Feed */
        <div className="flex flex-col space-y-6 pt-2">
          {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            const isMsgStreaming = isStreaming && msg.id === streamingMessageId;

            if (isUser) {
              return (
                <div key={msg.id} className="flex justify-end group">
                  <div className="relative max-w-[85%] sm:max-w-[75%] flex flex-col items-end gap-1.5">
                    {/* Attached Image if user sent image */}
                    {msg.image && (
                      <div className="rounded-2xl overflow-hidden border border-[#424242] max-w-xs shadow-md">
                        <img
                          src={msg.image.url}
                          alt={msg.image.name || 'User image'}
                          className="w-full h-auto object-cover max-h-60"
                        />
                      </div>
                    )}

                    {/* User message bubble */}
                    {msg.content && (
                      <div className="px-4 py-2.5 rounded-3xl bg-[#2f2f2f] text-[#ececec] text-[14px] leading-relaxed whitespace-pre-wrap select-text shadow-xs">
                        {msg.content}
                      </div>
                    )}

                    {/* Edit button on hover */}
                    <button
                      onClick={() => onEditMessage(msg.id, msg.content)}
                      type="button"
                      className="absolute -left-8 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 text-[#8e8e8e] hover:text-[#ececec] transition-opacity cursor-pointer"
                      title="Edit prompt"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                  </div>
                </div>
              );
            }

            // AI Response
            return (
              <div key={msg.id} className="flex flex-col space-y-2 group text-[#ececec]">
                {msg.error ? (
                  <div className="p-3 rounded-xl bg-red-950/30 border border-red-800/40 text-red-200 text-xs">
                    <p className="font-medium">Response Error</p>
                    <p className="mt-1 text-[11px] text-red-300">{msg.error}</p>
                    <button
                      onClick={() => onRegenerateResponse(index)}
                      type="button"
                      className="mt-2 px-2.5 py-1 rounded bg-red-900/40 hover:bg-red-900/60 text-xs font-medium cursor-pointer"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <div className="text-[15px] leading-relaxed text-[#ececec] font-normal">
                    {/* Render Image if this message contains an AI-generated image */}
                    {msg.image && (
                      <GeneratedImageViewer
                        image={msg.image}
                        onRegenerate={onRegenerateImage}
                      />
                    )}

                    {msg.content && <MarkdownRenderer content={msg.content} />}

                    {isMsgStreaming && (
                      <span className="inline-block w-2 h-4 bg-[#ececec] animate-pulse ml-0.5 align-middle rounded-xs" />
                    )}
                  </div>
                )}

                {/* Bottom Action Bar (Copy, Regenerate, Feedback) */}
                {!isMsgStreaming && !msg.error && (msg.content || msg.image) && (
                  <div className="flex items-center gap-1 text-[#8e8e8e] pt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {msg.content && (
                      <button
                        onClick={() => handleCopy(msg.id, msg.content)}
                        type="button"
                        className="p-1 rounded hover:text-[#ececec] hover:bg-[#2f2f2f] transition-colors cursor-pointer"
                        title="Copy response"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {copiedId === msg.id ? 'check' : 'content_copy'}
                        </span>
                      </button>
                    )}

                    <button
                      onClick={() => onRegenerateResponse(index)}
                      type="button"
                      className="p-1 rounded hover:text-[#ececec] hover:bg-[#2f2f2f] transition-colors cursor-pointer"
                      title="Regenerate response"
                    >
                      <span className="material-symbols-outlined text-[16px]">refresh</span>
                    </button>

                    <button
                      onClick={() => handleFeedback(msg.id, 'up')}
                      type="button"
                      className={`p-1 rounded hover:text-[#ececec] hover:bg-[#2f2f2f] transition-colors cursor-pointer ${
                        feedbackMap[msg.id] === 'up' ? 'text-[#10a37f]' : ''
                      }`}
                      title="Good response"
                    >
                      <span className="material-symbols-outlined text-[16px]">thumb_up</span>
                    </button>

                    <button
                      onClick={() => handleFeedback(msg.id, 'down')}
                      type="button"
                      className={`p-1 rounded hover:text-[#ececec] hover:bg-[#2f2f2f] transition-colors cursor-pointer ${
                        feedbackMap[msg.id] === 'down' ? 'text-red-400' : ''
                      }`}
                      title="Bad response"
                    >
                      <span className="material-symbols-outlined text-[16px]">thumb_down</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div ref={scrollEndRef} />
    </div>
  );
};
