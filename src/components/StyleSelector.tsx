import React, { useState } from 'react';
import { ResponseStyle } from '../types/chat';

interface StyleSelectorProps {
  currentStyle: ResponseStyle;
  onSelectStyle: (style: ResponseStyle) => void;
}

export const STYLES: { id: ResponseStyle; label: string; icon: string; desc: string }[] = [
  { id: 'balanced', label: 'Balanced', icon: 'balance', desc: 'Natural, engaging, and well-proportioned' },
  { id: 'research', label: 'Research Analyst', icon: 'travel_explore', desc: 'Deep dive with verified sources & citations' },
  { id: 'creative', label: 'Art Director', icon: 'palette', desc: 'Formula-crafted visuals & creative prompts' },
  { id: 'coding', label: 'Coding Expert', icon: 'code', desc: 'High-performance typed production code' },
  { id: 'concise', label: 'Concise', icon: 'bolt', desc: 'Direct, brief, and punchy answers' },
  { id: 'detailed', label: 'Detailed', icon: 'menu_book', desc: 'Comprehensive step-by-step deep dives' },
  { id: 'professional', label: 'Professional', icon: 'work', desc: 'Formal, objective, executive structure' },
  { id: 'friendly', label: 'Friendly & Warm', icon: 'favorite', desc: 'Supportive, encouraging, and empathetic' },
  { id: 'funny', label: 'Funny & Playful', icon: 'sentiment_very_satisfied', desc: 'Playful humor, wit, and banter' },
];

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  currentStyle,
  onSelectStyle,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const activeStyleObj = STYLES.find((s) => s.id === currentStyle) || STYLES[0];

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        type="button"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#2f2f2f] hover:bg-[#383838] text-[#ececec] text-xs font-medium border border-[#424242]/50 transition-colors cursor-pointer"
        title="Change Assistant Response Mode"
      >
        <span className="material-symbols-outlined text-[15px] text-[#10a37f]">
          {activeStyleObj.icon}
        </span>
        <span>{activeStyleObj.label}</span>
        <span className="material-symbols-outlined text-[14px] text-[#8e8e8e]">
          expand_more
        </span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 bottom-full mb-2 w-72 rounded-2xl bg-[#212121] border border-[#303030] p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 max-h-80 overflow-y-auto no-scrollbar">
            <div className="px-3 py-1.5 text-[10px] font-semibold text-[#8e8e8e] uppercase tracking-wider">
              Personality &amp; Mode Selector
            </div>
            <div className="space-y-0.5">
              {STYLES.map((s) => {
                const isSelected = s.id === currentStyle;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      onSelectStyle(s.id);
                      setIsOpen(false);
                    }}
                    type="button"
                    className={`w-full text-left px-3 py-2 rounded-xl transition-all flex items-start gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'bg-[#2f2f2f] text-white'
                        : 'text-[#b4b4b4] hover:bg-[#2f2f2f]/60 hover:text-[#ececec]'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-[16px] mt-0.5 ${
                        isSelected ? 'text-[#10a37f]' : 'text-[#8e8e8e]'
                      }`}
                    >
                      {s.icon}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-medium">{s.label}</span>
                      <span className="text-[10px] text-[#8e8e8e] truncate">{s.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
