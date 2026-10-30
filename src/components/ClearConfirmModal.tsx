import React from 'react';

interface ClearConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
}

export const ClearConfirmModal: React.FC<ClearConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100">
      <div className="w-full max-w-sm rounded-2xl bg-[#212121] border border-[#303030] shadow-2xl p-5 space-y-4 text-[#ececec]">
        <div>
          <h3 className="font-semibold text-base text-[#ececec]">{title}</h3>
          <p className="text-xs text-[#8e8e8e] mt-1.5 leading-relaxed">{description}</p>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            type="button"
            className="flex-1 py-2 rounded-xl bg-[#2f2f2f] hover:bg-[#383838] text-[#ececec] text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            type="button"
            className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-all cursor-pointer shadow-xs"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
