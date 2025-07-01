import { useCallback, useEffect, useState, useRef } from 'react';

interface UseGlobalFileDropProps {
  onFileLoad: (file: File) => void;
  enabled?: boolean;
}

type SaveFileExtension = '.sav' | '.sa2';

const SAVE_FILE_EXTENSIONS: SaveFileExtension[] = ['.sav', '.sa2'];

const isSaveFile = (filename: string): boolean => {
  const lowerName = filename.toLowerCase();
  return SAVE_FILE_EXTENSIONS.some(ext => lowerName.endsWith(ext));
};

export const useGlobalFileDrop = ({ onFileLoad, enabled = true }: UseGlobalFileDropProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragOver = useCallback((e: DragEvent) => {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();
  }, [enabled]);

  const handleDragEnter = useCallback((e: DragEvent) => {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();
    
    dragCounter.current++;

    const items = Array.from(e.dataTransfer?.items || []);
    const hasFiles = items.some(item => item.kind === 'file');
    
    if (hasFiles && dragCounter.current > 0) {
      setIsDragging(true);
    }
  }, [enabled]);

  const handleDragLeave = useCallback((e: DragEvent) => {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();
    
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, [enabled]);

  const handleDrop = useCallback((e: DragEvent) => {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();

    dragCounter.current = 0;
    setIsDragging(false);

    const files = Array.from(e.dataTransfer?.files || []);
    const saveFile = files.find(file => isSaveFile(file.name));
    
    if (saveFile) {
      onFileLoad(saveFile);
    }
  }, [enabled, onFileLoad]);

  useEffect(() => {
    if (!enabled) return;

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [enabled, handleDragOver, handleDragEnter, handleDragLeave, handleDrop]);

  return { isDragging };
};
