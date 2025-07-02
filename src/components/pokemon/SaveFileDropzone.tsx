import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from '../../lib/utils';

interface SaveFileDropzoneProps {
  onFileLoad: (file: File) => void;
  error?: string | null;
  showDropzone: boolean;
}

export const SaveFileDropzone: React.FC<SaveFileDropzoneProps> = ({
  onFileLoad,
  error = null,
  showDropzone,
}) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      onFileLoad(file);
    }
  }, [onFileLoad]);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
  } = useDropzone({
    onDrop,
    accept: {
      'application/octet-stream': ['.sav', '.sa2']
    },
    maxFiles: 1,
    noKeyboard: true,
  });

  const shouldShowOverlay = isDragActive || showDropzone;

  if (!shouldShowOverlay) {
    // Render a minimal root element to catch drag events globally
    // when the dropzone is not supposed to be visible.
    return <div {...getRootProps()} className="hidden" />;
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 transition-colors duration-200',
        isDragActive ? 'bg-black/20' : 'bg-transparent',
        showDropzone ? 'p-48' : 'p-0',
        !showDropzone && !isDragActive && 'pointer-events-none'
      )}
    >
      <div
        {...getRootProps()}
        className={cn(
          `group w-full h-full flex flex-col items-center justify-center 
          rounded-lg cursor-pointer transition-all duration-300 ease-in-out 
          border-2 border-dashed`,
          // Visibility and base styles
          (isDragActive || showDropzone) ? 'opacity-100' : 'opacity-0',
          showDropzone ? 'bg-slate-900/50 border-slate-700 shadow-2xl' : 'bg-transparent border-transparent',
          
          // Drag states
          isDragActive && 'bg-slate-800/80 border-cyan-400 ring-4 ring-cyan-300/60 shadow-[0_0_32px_8px_rgba(34,211,238,0.4)] backdrop-blur-xs',
          
          // Hover state only when it's the initial, visible dropzone
          !isDragActive && showDropzone && 'hover:border-slate-600 hover:bg-slate-900/70',
        )}
      >
        <input {...getInputProps()} />
        <div className="text-center p-8 flex flex-col items-center">
          <img
            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png"
            alt="Pokeball"
            className="w-24 h-24 mb-8"
            style={{ imageRendering: 'pixelated' }}
          />
          <h2 className="text-2xl font-bold text-slate-100">
            {isDragActive ? "Drop your Savegame to load!" : "Drop your Savegame here"}
          </h2>
          {showDropzone && <p className="text-slate-400 mt-1">or click to browse</p>}
          <p className="text-xs text-slate-500 mt-2">Supported: .sav, .sa2</p>
        </div>
        {error && (
          <div className="absolute bottom-6 left-6 right-6 mx-auto mt-4 p-3 bg-red-900/50 border border-red-500/50 rounded-lg max-w-md text-sm w-full">
            <div className="text-red-400 font-semibold mb-1">Error</div>
            <div className="text-red-300">{error}</div>
          </div>
        )}
      </div>
    </div>
  );
};
