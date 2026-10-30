import React, { useState, useEffect } from 'react';

interface EditPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  messageId: string | null;
  initialContent: string;
  onSaveAndResubmit: (messageId: string, updatedContent: string) => void;
}

export const EditPromptModal: React.FC<EditPromptModalProps> = ({
  isOpen,
  onClose,
  messageId,
  initialContent,
  onSaveAndResubmit,
}) => {
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  if (!isOpen || !messageId) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    onSaveAndResubmit(messageId, content.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100">
      <div className="w-full max-w-lg rounded-2xl bg-[#212121] border border-[#303030] shadow-2xl p-5 space-y-4 text-[#ececec]">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-[#ececec]">Edit message</h3>
          <button
            onClick={onClose}
            type="button"
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2f2f2f] transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-[#171717] border border-[#303030] text-[#ececec] text-sm focus:outline-none focus:border-[#10a37f] resize-none leading-relaxed"
            placeholder="Edit your message..."
            autoFocus
          />

          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 rounded-xl hover:bg-[#2f2f2f] text-[#ececec] text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!content.trim()}
              className="px-4 py-2 rounded-xl bg-[#10a37f] hover:bg-[#0e8d6e] text-white text-xs font-medium transition-all disabled:opacity-50 cursor-pointer shadow-xs"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
