import React, { useState, useRef, useEffect } from 'react';
import { ResponseStyle } from '../types/chat';
import { StyleSelector } from './StyleSelector';

interface ChatInputProps {
  onSendMessage: (message: string, attachedImage?: { url: string; mimeType: string; name: string }) => void;
  isStreaming: boolean;
  onStopGeneration: () => void;
  onOpenImageGen: () => void;
  currentStyle: ResponseStyle;
  onSelectStyle: (style: ResponseStyle) => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  isStreaming,
  onStopGeneration,
  onOpenImageGen,
  currentStyle,
  onSelectStyle,
}) => {
  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<{
    url: string;
    mimeType: string;
    name: string;
  } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-resize textarea smoothly (ChatGPT style)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(Math.max(scrollHeight, 44), 200)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (isStreaming) {
      onStopGeneration();
      return;
    }

    if (!input.trim() && !attachedImage) return;

    onSendMessage(input.trim(), attachedImage || undefined);
    setInput('');
    setAttachedImage(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if image file
    if (file.type.startsWith('image/')) {
      if (file.size > 8 * 1024 * 1024) {
        alert('Image too large. Please select an image under 8MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setAttachedImage({
          url: dataUrl,
          mimeType: file.type,
          name: file.name,
        });
      };
      reader.readAsDataURL(file);
    } else {
      // Code or text file
      if (file.size > 2 * 1024 * 1024) {
        alert('File too large. Please select a text or code file under 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          setInput(
            (prev) =>
              `${prev ? `${prev}\n\n` : ''}Here is the file \`${file.name}\`:\n\`\`\`\n${content}\n\`\`\``
          );
        }
      };
      reader.readAsText(file);
    }

    e.target.value = '';
  };

  const canSend = (input.trim().length > 0 || attachedImage !== null) && !isStreaming;

  return (
    <div className="w-full max-w-3xl mx-auto px-4">
      {/* Top Bar above Composer: Style Selector & Quick Image Gen */}
      <div className="flex items-center justify-between pb-1.5 px-1">
        <div className="flex items-center gap-1.5">
          <StyleSelector currentStyle={currentStyle} onSelectStyle={onSelectStyle} />
        </div>

        <button
          onClick={onOpenImageGen}
          type="button"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2f2f2f] hover:bg-[#383838] text-[#ececec] text-xs font-medium border border-[#424242]/50 transition-colors cursor-pointer"
          title="Create an AI Image"
        >
          <span className="material-symbols-outlined text-[15px] text-[#10a37f]">
            auto_awesome
          </span>
          <span>Generate Image</span>
        </button>
      </div>

      {/* ChatGPT Rounded Composer Container */}
      <div className="relative w-full rounded-[26px] bg-[#2f2f2f] border border-[#303030]/80 shadow-md flex flex-col focus-within:border-[#424242] transition-colors">
        {/* Hidden File Input (supports images and code/text) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.txt,.md,.json,.js,.ts,.tsx,.jsx,.html,.css,.py,.csv"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Attached Image Preview Chip */}
        {attachedImage && (
          <div className="p-3 pb-0 flex items-center gap-2">
            <div className="relative rounded-xl overflow-hidden border border-[#424242] w-14 h-14 bg-black/40 shrink-0 group">
              <img
                src={attachedImage.url}
                alt={attachedImage.name}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setAttachedImage(null)}
                type="button"
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                title="Remove attached image"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            </div>
            <div className="flex flex-col min-w-0 text-xs">
              <span className="text-[#ececec] truncate font-medium">{attachedImage.name}</span>
              <span className="text-[11px] text-[#10a37f]">Ready for multimodal vision</span>
            </div>
          </div>
        )}

        {/* Textarea Field */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={attachedImage ? 'Ask about this image...' : 'Message ChatGPT...'}
          rows={1}
          className="w-full px-4 pt-3 pb-2 bg-transparent text-[#ececec] placeholder:text-[#8e8e8e] text-sm resize-none focus:outline-none max-h-48 font-normal leading-relaxed"
        />

        {/* Action Controls Toolbar inside the container */}
        <div className="px-3 pb-2 pt-1 flex items-center justify-between">
          {/* Left tools: Attachment & Image Generator */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#383838] transition-colors cursor-pointer"
              title="Upload image or text file"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>

            <button
              onClick={onOpenImageGen}
              type="button"
              className="w-8 h-8 rounded-full flex items-center justify-center text-[#8e8e8e] hover:text-[#10a37f] hover:bg-[#383838] transition-colors cursor-pointer"
              title="Generate AI Image"
            >
              <span className="material-symbols-outlined text-[18px]">palette</span>
            </button>
          </div>

          {/* Right tool: Send / Stop button */}
          <div className="flex items-center gap-1.5">
            {isStreaming ? (
              <button
                onClick={onStopGeneration}
                type="button"
                className="w-8 h-8 rounded-full bg-white hover:bg-neutral-200 text-black flex items-center justify-center transition-all cursor-pointer shadow-xs"
                title="Stop generating"
              >
                <span className="material-symbols-outlined text-[18px]">stop</span>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!canSend}
                type="button"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  canSend
                    ? 'bg-white text-black hover:bg-neutral-200 cursor-pointer shadow-xs'
                    : 'bg-[#383838] text-[#8e8e8e] cursor-not-allowed opacity-60'
                }`}
                title="Send message (Enter)"
              >
                <span className="material-symbols-outlined text-[18px] font-bold">
                  arrow_upward
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ChatGPT Disclaimer Footer */}
      <div className="text-center py-2">
        <p className="text-[11px] text-[#8e8e8e]">
          ChatGPT can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
};
