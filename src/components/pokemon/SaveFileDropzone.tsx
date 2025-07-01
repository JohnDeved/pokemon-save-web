import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from '../../lib/utils';

interface SaveFileDropzoneProps {
  onFileLoad: (file: File) => void;
  error?: string | null;
  isGlobalDragActive?: boolean;
}

export const SaveFileDropzone: React.FC<SaveFileDropzoneProps> = ({
  onFileLoad,
  error = null,
  isGlobalDragActive = false,
}) => {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      onFileLoad(file);
    }
  }, [onFileLoad]);

  const { getRootProps, getInputProps, isDragActive: isLocalDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/octet-stream': ['.sav', '.sa2'],
      'application/x-binary': ['.sav', '.sa2'],
      '*/*': ['.sav', '.sa2']
    },
    maxFiles: 1,
    disabled: false,
    noClick: isGlobalDragActive,
    noKeyboard: isGlobalDragActive,
  });

  const isDragActive = isGlobalDragActive || isLocalDragActive;

  return (
    <div className="fixed inset-0 z-50 p-48 bg-black/60">
      <div
        {...getRootProps()}
        className={cn(
            `group w-full h-full flex flex-col items-center justify-center 
            rounded-lg cursor-pointer transition-all duration-300 ease-in-out 
            bg-slate-900/50 border-2 border-dashed border-slate-700 shadow-2xl`,
            isDragActive && 'bg-slate-800/80 border-cyan-400 ring-4 ring-cyan-300/60 shadow-[0_0_32px_8px_rgba(34,211,238,0.4)]',
            !isDragActive && 'hover:border-slate-600 hover:bg-slate-900/70',
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
            {isDragActive ? "Drop your save file to load!" : "Drop your .sav or .sa2 here"}
          </h2>
          {!isGlobalDragActive && <p className="text-slate-400 mt-1">or click to browse</p>}
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
