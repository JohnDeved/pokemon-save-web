import { fromEvent } from 'file-selector'
import { useEffect, useRef, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import type { PokemonSaveParser } from '@/lib/parser/core/PokemonSaveParser'
import { cn } from '@/lib/utils'

interface SaveFileDropzoneProps {
  onFileLoad: PokemonSaveParser['parse']
  error?: string | null
  showDropzone: boolean
  onOpenFilePicker?: (fn: () => void) => void
}

function isFsFileHandle(obj: unknown): obj is FileSystemFileHandle {
  if (!obj || typeof obj !== 'object') return false
  const anyObj = obj as { getFile?: unknown; createWritable?: unknown }
  return typeof anyObj.getFile === 'function' && typeof anyObj.createWritable === 'function'
}

export const SaveFileDropzone: React.FC<SaveFileDropzoneProps> = ({ onFileLoad, error = null, showDropzone, onOpenFilePicker }) => {
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null)
  const pollInterval = useRef<NodeJS.Timeout | null>(null)
  const lastModifiedRef = useRef<number | null>(null)

  const supportsFsAccessApi = typeof window !== 'undefined' && 'showOpenFilePicker' in window

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    getFilesFromEvent: async event => {
      if (Array.isArray(event)) {
        // Handle file system access API
        const [handle] = event
        if (!isFsFileHandle(handle)) {
          toast.error('Invalid file handle. Please try again.', {
            position: 'bottom-center',
            duration: 3000,
          })
          return []
        }
        setFileHandle(handle)
        void onFileLoad(handle)
        const file = await handle.getFile()
        lastModifiedRef.current = file.lastModified
        return [] // we dont need to return files here, as we handle the file directly
      }

      // Fallback to default behavior for regular file drops
      return fromEvent(event)
    },
    onDrop: acceptedFiles => {
      const [file] = acceptedFiles
      if (typeof file !== 'undefined') {
        setFileHandle(null)
        lastModifiedRef.current = file.lastModified ?? null
        void onFileLoad(file)
      }
    },
    accept: {
      'application/octet-stream': ['.sav', '.sa2'],
    },
    maxFiles: 1,
    noKeyboard: true,
    noClick: true,
    useFsAccessApi: supportsFsAccessApi,
  })

  // Poll for file changes if fileHandle is available
  useEffect(() => {
    if (!fileHandle) return

    const refreshHandle = async () => {
      try {
        const file = await fileHandle.getFile()
        const nextModified = file.lastModified
        if (lastModifiedRef.current !== nextModified) {
          lastModifiedRef.current = nextModified
          void onFileLoad(file)
        }
      } catch (pollError) {
        console.warn('Failed to poll file changes:', pollError)
      }
    }

    pollInterval.current = setInterval(() => {
      void refreshHandle()
    }, 300)

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current)
      pollInterval.current = null
    }
  }, [fileHandle, onFileLoad])

  // Provide open to parent for external triggering, only if function changes
  useEffect(() => {
    if (onOpenFilePicker) {
      onOpenFilePicker(open)
    }
  }, [onOpenFilePicker, open])

  // Show error toast if error prop changes
  useEffect(() => {
    if (error) {
      toast.error(error, {
        position: 'bottom-center',
        duration: 5000,
      })
    }
  }, [error])

  const shouldShowOverlay = isDragActive || showDropzone

  // Define reusable style constants
  const overlayClasses = cn('fixed inset-0 z-50 transition-colors duration-200', isDragActive ? 'bg-black/20' : 'bg-transparent', showDropzone ? 'p-48' : 'p-0', !showDropzone && !isDragActive && 'pointer-events-none')

  const dropzoneBaseClasses = 'group w-full h-full flex flex-col items-center justify-center rounded-lg cursor-pointer transition-all duration-300 ease-in-out border-2 border-dashed'

  const dropzoneStateClasses = cn(
    dropzoneBaseClasses,
    // Visibility
    isDragActive || showDropzone ? 'opacity-100' : 'opacity-0',
    // Base styling
    showDropzone ? 'bg-background/50 border shadow-2xl' : 'bg-transparent border-transparent',
    // Active drag styling
    isDragActive && 'bg-background/80 border-cyan-400 ring-4 ring-cyan-300/60 shadow-[0_0_32px_8px_rgba(34,211,238,0.4)] backdrop-blur-xs',
    // Hover styling
    !isDragActive && showDropzone && 'hover:bg-background/70'
  )

  if (!shouldShowOverlay) {
    // Render a minimal root element to catch drag events globally
    // when the dropzone is not supposed to be visible.
    // input supports file open on browsers that do not support the File System Access API
    return (
      <div {...getRootProps()} className="hidden">
        <input {...getInputProps()} />
      </div>
    )
  }

  return (
    <div className={overlayClasses}>
      <div {...getRootProps({ onClick: showDropzone ? open : undefined })} className={dropzoneStateClasses}>
        <input {...getInputProps()} />
        <div className="text-center p-8 flex flex-col items-center">
          <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png" alt="Pokeball" className="w-24 h-24 mb-8" style={{ imageRendering: 'pixelated' }} />
          <h2 className="text-2xl font-bold text-foreground">{isDragActive ? 'Drop your Savegame to load!' : 'Drop your Savegame here'}</h2>
          {showDropzone && <span className="text-muted-foreground mt-1 text-base">or click to browse</span>}
          <p className="text-xs text-muted-foreground mt-2">Supported: .sav, .sa2</p>
        </div>
      </div>
    </div>
  )
}
