import React, { useState } from 'react';
import { ChatSettings } from '../types/chat';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ChatSettings;
  onSaveSettings: (newSettings: Partial<ChatSettings>) => void;
  storageStats: {
    chatCount: number;
    messageCount: number;
    formattedSize: string;
  };
  onExportJSON: () => void;
  onClearAllStorage: () => void;
}

export const ConfigModal: React.FC<ConfigModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  storageStats,
  onExportJSON,
  onClearAllStorage,
}) => {
  const [temperature, setTemperature] = useState(settings.temperature);
  const [systemInstruction, setSystemInstruction] = useState(settings.systemInstruction);
  const [maxContextTurns, setMaxContextTurns] = useState(settings.maxContextTurns || 10);
  const [searchGrounding, setSearchGrounding] = useState(settings.searchGrounding || false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSaveSettings({
      temperature,
      systemInstruction,
      maxContextTurns,
      searchGrounding,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-100">
      <div className="w-full max-w-lg rounded-2xl bg-[#212121] border border-[#303030] shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-[#ececec]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#303030] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[#10a37f]">tune</span>
            <span className="font-semibold text-sm">Settings</span>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2f2f2f] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
          {/* Temperature Slider */}
          <div className="space-y-1.5 p-3 rounded-xl bg-[#171717] border border-[#303030]/60">
            <div className="flex justify-between items-center">
              <label htmlFor="tempSlider" className="font-medium text-[#ececec]">
                Sampling Temperature
              </label>
              <span className="font-mono text-[#10a37f] font-semibold">{temperature.toFixed(1)}</span>
            </div>
            <input
              id="tempSlider"
              type="range"
              min="0.0"
              max="1.0"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              className="w-full accent-[#10a37f] cursor-pointer"
            />
            <div className="flex justify-between text-[#8e8e8e] text-[10px]">
              <span>Direct &amp; Precise (0.0)</span>
              <span>Balanced (0.7)</span>
              <span>Creative (1.0)</span>
            </div>
          </div>

          {/* Context Window Slider */}
          <div className="space-y-1.5 p-3 rounded-xl bg-[#171717] border border-[#303030]/60">
            <div className="flex justify-between items-center">
              <label htmlFor="contextSlider" className="font-medium text-[#ececec]">
                Recent Messages Context Memory
              </label>
              <span className="font-mono text-[#10a37f] font-semibold">{maxContextTurns} turns</span>
            </div>
            <input
              id="contextSlider"
              type="range"
              min="4"
              max="20"
              step="2"
              value={maxContextTurns}
              onChange={(e) => setMaxContextTurns(parseInt(e.target.value, 10))}
              className="w-full accent-[#10a37f] cursor-pointer"
            />
            <div className="flex justify-between text-[#8e8e8e] text-[10px]">
              <span>Fastest (4 turns)</span>
              <span>Standard (10 turns)</span>
              <span>Deep (20 turns)</span>
            </div>
          </div>

          {/* System Instructions Persona */}
          <div className="space-y-1.5">
            <label htmlFor="personaText" className="font-medium text-[#ececec] block">
              Custom Instructions / System Persona
            </label>
            <textarea
              id="personaText"
              rows={4}
              value={systemInstruction}
              onChange={(e) => setSystemInstruction(e.target.value)}
              placeholder="How would you like ChatGPT to respond?"
              className="w-full px-3 py-2 rounded-xl bg-[#171717] border border-[#303030] text-[#ececec] text-xs focus:outline-none focus:border-[#10a37f] resize-none leading-relaxed"
            />
          </div>

          {/* LocalStorage Data Operations */}
          <div className="p-3.5 rounded-xl bg-[#171717] border border-[#303030]/60 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[#ececec]">Browser LocalStorage</span>
              <span className="text-[#8e8e8e] text-[11px]">
                {storageStats.chatCount} chats ({storageStats.formattedSize})
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onExportJSON}
                type="button"
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#262626] hover:bg-[#2f2f2f] text-[#ececec] text-xs font-medium border border-[#303030] transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">download</span>
                <span>Export Data</span>
              </button>
              <button
                onClick={onClearAllStorage}
                type="button"
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-red-950/20 hover:bg-red-950/40 text-red-400 text-xs font-medium border border-red-900/40 transition-colors cursor-pointer"
              >
                <span className="material-symbols-outlined text-[15px]">delete_forever</span>
                <span>Delete all chats</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#303030] flex justify-end gap-2">
          <button
            onClick={onClose}
            type="button"
            className="px-4 py-2 rounded-xl hover:bg-[#2f2f2f] text-[#ececec] text-xs font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            type="button"
            className="px-4 py-2 rounded-xl bg-[#10a37f] hover:bg-[#0e8d6e] text-white text-xs font-medium transition-colors cursor-pointer shadow-xs"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
};
