import React from 'react';
import { UploadCloud, User } from 'lucide-react';
import { TryOnMode } from '../../types';

interface CameraOverlayProps {
  mode: TryOnMode;
  faceDetected: boolean;
  onFileUpload: (file: File) => void;
  isLoading: boolean;
  customPhotoUrl?: string | null;
  onSelectModel?: (url: string) => void;
}

export const CameraOverlay: React.FC<CameraOverlayProps> = ({
  mode,
  faceDetected,
  onFileUpload,
  isLoading,
  customPhotoUrl,
  onSelectModel,
}) => {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-4 select-none">
      {/* Searching Indicator in webcam mode */}
      {mode === 'webcam' && !isLoading && !faceDetected && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="glass-panel px-4 py-2 rounded-full text-xs font-mono text-neutral-300 border border-neutral-700/80 shadow-2xl flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>Align Face in View</span>
          </div>
        </div>
      )}

      {/* Sunglass Hut Model Selector Strip in Photo Portrait Mode */}
      {mode === 'photo' && (
        <div className="absolute top-16 inset-x-4 flex items-center justify-center pointer-events-auto z-20">
          <div className="glass-panel p-1.5 rounded-2xl border border-neutral-700/80 shadow-2xl flex items-center gap-2 bg-neutral-950/80 backdrop-blur-md">
            <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 px-2 hidden sm:inline">
              Choose Model:
            </span>

            <button
              onClick={() => onSelectModel?.('/models_faces/female_oval.jpg')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                customPhotoUrl?.includes('female_oval')
                  ? 'bg-white text-black font-bold shadow-md'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <span>👩 Elena</span>
              <span className="text-[9px] font-mono opacity-60">Oval</span>
            </button>

            <button
              onClick={() => onSelectModel?.('/models_faces/male_square.jpg')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                customPhotoUrl?.includes('male_square')
                  ? 'bg-white text-black font-bold shadow-md'
                  : 'text-neutral-300 hover:text-white hover:bg-neutral-800'
              }`}
            >
              <span>👨 Marcus</span>
              <span className="text-[9px] font-mono opacity-60">Square</span>
            </button>

            <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-neutral-300 hover:text-white hover:bg-neutral-800 transition-all cursor-pointer">
              <UploadCloud className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Upload</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>
        </div>
      )}

      {/* Loading state indicator */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-full border-2 border-white border-t-transparent animate-spin" />
          <p className="font-mono text-xs text-white tracking-widest uppercase">
            Starting camera...
          </p>
        </div>
      )}
    </div>
  );
};
