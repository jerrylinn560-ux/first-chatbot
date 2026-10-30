import React, { useState } from 'react';
import { ModelOption, ResponseStyle } from '../types/chat';

interface HeaderProps {
  models: ModelOption[];
  currentModel: string;
  onSelectModel: (modelId: string) => void;
  onNewChat: () => void;
  onOpenConfig: () => void;
  onOpenImageGen: () => void;
  onExportMarkdown: () => void;
  onExportJSON: () => void;
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  currentStyle: ResponseStyle;
}

export const Header: React.FC<HeaderProps> = ({
  models,
  currentModel,
  onSelectModel,
  onNewChat,
  onOpenConfig,
  onOpenImageGen,
  onExportMarkdown,
  onExportJSON,
  onToggleSidebar,
  currentStyle,
}) => {
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const selectedModelObj = models.find((m) => m.id === currentModel) || models[0];

  return (
    <header className="sticky top-0 z-30 w-full bg-[#212121]/95 dark:bg-[#212121]/95 light:bg-white/95 backdrop-blur-md transition-colors">
      <div className="h-14 px-3 sm:px-4 flex items-center justify-between gap-3">
        {/* Left: Sidebar Toggle, New Chat & Model Selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSidebar}
            type="button"
            className="p-2 rounded-lg text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#2f2f2f] transition-colors cursor-pointer"
            title="Toggle Sidebar"
          >
            <span className="material-symbols-outlined text-[20px]">view_sidebar</span>
          </button>

          <button
            onClick={onNewChat}
            type="button"
            className="p-2 rounded-lg text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#2f2f2f] transition-colors cursor-pointer lg:hidden"
            title="New Chat"
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
          </button>

          {/* Model Selector Dropdown (ChatGPT style) */}
          <div className="relative">
            <button
              onClick={() => {
                setShowModelMenu(!showModelMenu);
                setShowExportMenu(false);
              }}
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-[#2f2f2f] text-[#ececec] text-sm font-semibold transition-colors cursor-pointer"
            >
              <span>{selectedModelObj ? selectedModelObj.name : 'Auto (Smart Router)'}</span>
              <span className="material-symbols-outlined text-[18px] text-[#8e8e8e]">
                expand_more
              </span>
            </button>

            {/* Model Selection Dropdown Menu */}
            {showModelMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowModelMenu(false)}
                />
                <div className="absolute left-0 mt-1 w-80 rounded-2xl bg-[#212121] border border-[#303030] p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-[#8e8e8e] uppercase tracking-wider flex items-center justify-between">
                    <span>Model Selection</span>
                    <span className="text-[10px] text-[#10a37f]">Multi-Model Engine</span>
                  </div>
                  <div className="space-y-1">
                    {models.map((m) => {
                      const isSelected = m.id === currentModel;
                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            onSelectModel(m.id);
                            setShowModelMenu(false);
                          }}
                          type="button"
                          className={`w-full text-left p-2.5 rounded-xl transition-all cursor-pointer flex flex-col gap-0.5 ${
                            isSelected
                              ? 'bg-[#2f2f2f] text-[#ececec]'
                              : 'hover:bg-[#2f2f2f]/60 text-[#b4b4b4] hover:text-[#ececec]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs flex items-center gap-1.5">
                              {isSelected && (
                                <span className="w-1.5 h-1.5 rounded-full bg-[#10a37f]" />
                              )}
                              {m.name}
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                m.isAuto
                                  ? 'bg-[#10a37f]/20 text-[#10a37f] font-medium'
                                  : 'text-[#8e8e8e]'
                              }`}
                            >
                              {m.badge}
                            </span>
                          </div>
                          <span className="text-[11px] text-[#8e8e8e] leading-tight">
                            {m.description}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Right Action Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Quick Image Gen Trigger */}
          <button
            onClick={onOpenImageGen}
            type="button"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#b4b4b4] hover:text-[#10a37f] hover:bg-[#2f2f2f] transition-colors cursor-pointer"
            title="Generate AI Image"
          >
            <span className="material-symbols-outlined text-[17px] text-[#10a37f]">palette</span>
            <span>Image</span>
          </button>

          {/* Export Dropdown */}
          <div className="relative">
            <button
              onClick={() => {
                setShowExportMenu(!showExportMenu);
                setShowModelMenu(false);
              }}
              type="button"
              className="p-2 rounded-lg text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#2f2f2f] transition-colors cursor-pointer"
              title="Share or Export chat"
            >
              <span className="material-symbols-outlined text-[18px]">ios_share</span>
            </button>

            {showExportMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowExportMenu(false)}
                />
                <div className="absolute right-0 mt-1 w-44 rounded-xl bg-[#212121] border border-[#303030] p-1 shadow-xl z-50">
                  <button
                    onClick={() => {
                      onExportMarkdown();
                      setShowExportMenu(false);
                    }}
                    type="button"
                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-[#ececec] hover:bg-[#2f2f2f] flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">description</span>
                    <span>Export Markdown</span>
                  </button>
                  <button
                    onClick={() => {
                      onExportJSON();
                      setShowExportMenu(false);
                    }}
                    type="button"
                    className="w-full text-left px-3 py-2 rounded-lg text-xs text-[#ececec] hover:bg-[#2f2f2f] flex items-center gap-2 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">data_object</span>
                    <span>Export JSON</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Settings Trigger */}
          <button
            onClick={onOpenConfig}
            type="button"
            className="p-2 rounded-lg text-[#b4b4b4] hover:text-[#ececec] hover:bg-[#2f2f2f] transition-colors cursor-pointer"
            title="Settings"
          >
            <span className="material-symbols-outlined text-[20px]">tune</span>
          </button>
        </div>
      </div>
    </header>
  );
};
