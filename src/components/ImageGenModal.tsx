import React, { useState } from 'react';

interface ImageGenModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (prompt: string, aspectRatio: '1:1' | '16:9' | '9:16' | '4:3', style: string) => Promise<void>;
  isGenerating: boolean;
}

const STYLES = [
  { id: 'photorealistic', label: 'Photo Realistic', icon: 'photo_camera' },
  { id: 'cinematic', label: 'Cinematic', icon: 'movie' },
  { id: 'anime', label: 'Anime & Manga', icon: 'brush' },
  { id: 'digital art', label: 'Digital Art', icon: 'draw' },
  { id: '3d render', label: '3D Render', icon: 'view_in_ar' },
  { id: 'cyberpunk', label: 'Cyberpunk', icon: 'nightlife' },
];

const ASPECT_RATIOS: { id: '1:1' | '16:9' | '9:16' | '4:3'; label: string; icon: string }[] = [
  { id: '1:1', label: 'Square (1:1)', icon: 'crop_square' },
  { id: '16:9', label: 'Landscape (16:9)', icon: 'crop_16_9' },
  { id: '9:16', label: 'Portrait (9:16)', icon: 'crop_portrait' },
  { id: '4:3', label: 'Standard (4:3)', icon: 'crop_landscape' },
];

const FORMULA_EXAMPLES = [
  {
    label: 'Cyberpunk Sports Car',
    prompt: 'A sleek futuristic electric hypercar speeding through wet neon streets at midnight, photorealistic cinematic render, wide angle 35mm lens with rain streaks and lens flares, moody high-tech cyberpunk vibe',
  },
  {
    label: 'Astronaut in Crystal Forest',
    prompt: 'An astronaut exploring an alien forest filled with bioluminescent giant crystals and floating spores, digital concept art, macro lens with soft volumetric atmospheric fog, ethereal and mysterious mood',
  },
  {
    label: 'Ancient Solitary Temple',
    prompt: 'An ancient moss-covered stone temple perched on a cliff at sunrise with golden sunbeams breaking through mist, National Geographic photography, drone wide shot, serene and majestic ambiance',
  },
];

export const ImageGenModal: React.FC<ImageGenModalProps> = ({
  isOpen,
  onClose,
  onGenerate,
  isGenerating,
}) => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState<'1:1' | '16:9' | '9:16' | '4:3'>('1:1');
  const [style, setStyle] = useState('photorealistic');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    await onGenerate(prompt.trim(), aspectRatio, style);
    setPrompt('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-100">
      <div className="w-full max-w-xl rounded-2xl bg-[#212121] border border-[#303030] shadow-2xl overflow-hidden flex flex-col text-[#ececec]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#303030] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[22px] text-[#10a37f]">
              palette
            </span>
            <div className="flex flex-col">
              <span className="font-semibold text-sm">AI Art &amp; Image Studio</span>
              <span className="text-[11px] text-[#8e8e8e]">High-Fidelity Visual Generation Engine</span>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2f2f2f] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto no-scrollbar">
          {/* Prompt Formula Guide Banner */}
          <div className="p-3 rounded-xl bg-[#171717] border border-[#303030]/80 space-y-1.5">
            <div className="flex items-center gap-1.5 text-[#10a37f] text-xs font-semibold">
              <span className="material-symbols-outlined text-[16px]">psychology</span>
              <span>Prompt Formula</span>
            </div>
            <p className="text-[11px] text-[#b4b4b4] leading-relaxed font-mono">
              [Subject/Action] + [Environment/Lighting] + [Art Style/Medium] + [Camera Angle/Lens] + [Vibe/Mood]
            </p>
            {/* Quick Inspiration Pills */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {FORMULA_EXAMPLES.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPrompt(ex.prompt)}
                  className="px-2 py-0.5 rounded-full bg-[#262626] hover:bg-[#303030] text-[#b4b4b4] hover:text-[#ececec] text-[10px] font-medium transition-colors"
                >
                  + {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Field */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#ececec] block">
              Image Description / Prompt
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. A solitary cyberpunk warrior standing on a neon rooftop overlooking a rainy futuristic metropolis, cinematic 85mm portrait, volumetric steam, moody and contemplative..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#171717] border border-[#303030] text-[#ececec] text-sm focus:outline-none focus:border-[#10a37f] resize-none leading-relaxed"
              autoFocus
            />
          </div>

          {/* Style Presets */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#ececec] block">Artistic Medium &amp; Style</label>
            <div className="grid grid-cols-3 gap-2">
              {STYLES.map((s) => {
                const isSelected = style === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyle(s.id)}
                    className={`flex items-center gap-1.5 p-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#2f2f2f] border-[#10a37f] text-white shadow-xs'
                        : 'bg-[#171717] border-[#303030] text-[#b4b4b4] hover:bg-[#262626]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px] text-[#10a37f]">
                      {s.icon}
                    </span>
                    <span className="truncate">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Aspect Ratio Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#ececec] block">Aspect Ratio</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ASPECT_RATIOS.map((r) => {
                const isSelected = aspectRatio === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setAspectRatio(r.id)}
                    className={`flex items-center justify-center gap-1.5 p-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#2f2f2f] border-[#10a37f] text-white'
                        : 'bg-[#171717] border-[#303030] text-[#b4b4b4] hover:bg-[#262626]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">{r.icon}</span>
                    <span>{r.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="pt-2 flex justify-end gap-2 border-t border-[#303030]/60">
            <button
              onClick={onClose}
              type="button"
              className="px-4 py-2 rounded-xl hover:bg-[#2f2f2f] text-[#ececec] text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!prompt.trim() || isGenerating}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-[#10a37f] hover:bg-[#0e8d6e] text-white text-xs font-medium transition-all disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {isGenerating ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Generating image...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                  <span>Generate Image</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
