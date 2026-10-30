import React, { useState } from 'react';
import { ChatImage } from '../types/chat';

interface GeneratedImageViewerProps {
  image: ChatImage;
  onRegenerate?: (prompt: string) => void;
}

export const GeneratedImageViewer: React.FC<GeneratedImageViewerProps> = ({
  image,
  onRegenerate,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleDownload = async () => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `ai-generated-${Date.now()}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(image.url, '_blank');
    }
  };

  return (
    <>
      <div className="my-2.5 max-w-md rounded-2xl overflow-hidden border border-[#303030] bg-[#171717] shadow-lg group">
        {/* Image Display */}
        <div
          onClick={() => setIsFullscreen(true)}
          className="relative overflow-hidden cursor-zoom-in bg-black/40 flex items-center justify-center max-h-96"
        >
          <img
            src={image.url}
            alt={image.prompt || 'Generated AI visual'}
            className="w-full h-auto object-cover transition-transform duration-200 group-hover:scale-[1.01]"
            loading="lazy"
          />

          {/* Hover Overlay with Fullscreen Icon */}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
            <span className="p-2 rounded-full bg-black/60 text-white material-symbols-outlined text-[20px]">
              zoom_in
            </span>
          </div>
        </div>

        {/* Caption & Controls */}
        <div className="p-3 bg-[#1c1c1c] border-t border-[#303030] flex flex-col gap-2">
          {image.prompt && (
            <p className="text-xs text-[#ececec] font-medium leading-snug line-clamp-2">
              {image.prompt}
            </p>
          )}

          <div className="flex items-center justify-between text-[11px] text-[#8e8e8e]">
            <div className="flex items-center gap-1.5">
              {image.style && (
                <span className="px-1.5 py-0.5 rounded bg-[#262626] text-[#b4b4b4] capitalize">
                  {image.style}
                </span>
              )}
              {image.aspectRatio && (
                <span className="px-1.5 py-0.5 rounded bg-[#262626] text-[#b4b4b4]">
                  {image.aspectRatio}
                </span>
              )}
              {image.isGenerated && (
                <span className="px-1.5 py-0.5 rounded bg-[#10a37f]/20 text-[#10a37f] font-medium">
                  AI Image
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {onRegenerate && image.prompt && (
                <button
                  onClick={() => onRegenerate(image.prompt!)}
                  type="button"
                  className="p-1 rounded hover:text-white hover:bg-[#2f2f2f] transition-colors cursor-pointer"
                  title="Regenerate this image"
                >
                  <span className="material-symbols-outlined text-[16px]">refresh</span>
                </button>
              )}
              <button
                onClick={handleDownload}
                type="button"
                className="flex items-center gap-1 px-2 py-1 rounded bg-[#2f2f2f] hover:bg-[#383838] text-[#ececec] transition-colors cursor-pointer text-xs"
                title="Download high-resolution image"
              >
                <span className="material-symbols-outlined text-[15px]">download</span>
                <span>Save</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen Lightbox Modal */}
      {isFullscreen && (
        <div
          onClick={() => setIsFullscreen(false)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-100 cursor-zoom-out"
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <img
              src={image.url}
              alt={image.prompt || 'Full size visual'}
              className="max-w-full max-h-[82vh] object-contain rounded-xl shadow-2xl"
            />
            {image.prompt && (
              <p className="mt-3 text-xs text-[#ececec] bg-black/60 px-4 py-2 rounded-full backdrop-blur-xs text-center max-w-xl">
                {image.prompt}
              </p>
            )}
            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute top-2 right-2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
