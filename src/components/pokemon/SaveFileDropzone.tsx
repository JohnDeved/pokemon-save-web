import { useEffect, useState, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { fromEvent } from 'file-selector'
import { cn } from '../../lib/utils'
import type { PokemonSaveParser } from '../../lib/parser'
import { toast } from 'sonner'

interface SaveFileDropzoneProps {
  onFileLoad: PokemonSaveParser['parseSaveFile']
  error?: string | null
  showDropzone: boolean
  onOpenFilePicker?: (fn: () => void) => void
}

export const SaveFileDropzone: React.FC<SaveFileDropzoneProps> = ({ onFileLoad, error = null, showDropzone, onOpenFilePicker }) => {
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null)
  const [lastModified, setLastModified] = useState<number | null>(null)
  const pollInterval = useRef<NodeJS.Timeout | null>(null)

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open,
  } = useDropzone({
    getFilesFromEvent: async (event) => {
      if (Array.isArray(event)) {
        // Handle file system access API
        const handle = event[0]
        if (!(handle instanceof FileSystemFileHandle)) {
          toast.error('Invalid file handle. Please try again.', {
            position: 'bottom-center',
            duration: 3000,
          })
          return []
        }
        setFileHandle(handle)
        onFileLoad(handle)
        const file = await handle.getFile()
        setLastModified(file.lastModified)
        return [] // we dont need to return files here, as we handle the file directly
      }

      // Fallback to default behavior for regular file drops
      return fromEvent(event)
    },
    onDrop: acceptedFiles => {
      const file = acceptedFiles[0]
      if (file) {
        onFileLoad(file)
      }
    },
    accept: {
      'application/octet-stream': ['.sav', '.sa2'],
    },
    maxFiles: 1,
    noKeyboard: true,
    noClick: true,
    useFsAccessApi: true,
  })

  // Poll for file changes if fileHandle is available
  useEffect(() => {
    if (!fileHandle) return

    pollInterval.current = setInterval(async () => {
      try {
        const file = await fileHandle.getFile()
        if (file.lastModified !== lastModified) {
          setLastModified(file.lastModified)
          onFileLoad(file)
        }
      } catch (error) {
        console.warn('Failed to poll file changes:', error)
      }
    }, 300) // Poll every 300ms

    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current)
    }
  }, [fileHandle, lastModified, onFileLoad])

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
  const overlayClasses = cn(
    'fixed inset-0 z-50 transition-colors duration-200',
    isDragActive ? 'bg-black/20' : 'bg-transparent',
    showDropzone ? 'p-48' : 'p-0',
    !showDropzone && !isDragActive && 'pointer-events-none',
  )

  const dropzoneBaseClasses =
    'group w-full h-full flex flex-col items-center justify-center rounded-lg cursor-pointer transition-all duration-300 ease-in-out border-2 border-dashed'

  const dropzoneStateClasses = cn(
    dropzoneBaseClasses,
    // Visibility
    (isDragActive || showDropzone) ? 'opacity-100' : 'opacity-0',
    // Base styling
    showDropzone ? 'bg-slate-900/50 border-slate-700 shadow-2xl' : 'bg-transparent border-transparent',
    // Active drag styling
    isDragActive && 'bg-slate-800/80 border-cyan-400 ring-4 ring-cyan-300/60 shadow-[0_0_32px_8px_rgba(34,211,238,0.4)] backdrop-blur-xs',
    // Hover styling
    !isDragActive && showDropzone && 'hover:border-slate-600 hover:bg-slate-900/70',
  )

  if (!shouldShowOverlay) {
    // Render a minimal root element to catch drag events globally
    // when the dropzone is not supposed to be visible.
    // input supports file open on browsers that do not support the File System Access API
    return (
      <div {...getRootProps()} className="hidden" >
        <input {...getInputProps()}/>
      </div>
    )
  }

  return (
    <div className={overlayClasses}>
      <div
        {...getRootProps({ onClick: showDropzone ? open : undefined })}
        className={dropzoneStateClasses}
      >
        <input {...getInputProps()}/>
        <div className="text-center p-8 flex flex-col items-center">
          <img
            src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png"
            alt="Pokeball"
            className="w-24 h-24 mb-8"
            style={{ imageRendering: 'pixelated' }}
          />
          <h2 className="text-2xl font-bold text-slate-100">
            {isDragActive ? 'Drop your Savegame to load!' : 'Drop your Savegame here'}
          </h2>
          {showDropzone && (
            <span className="text-slate-400 mt-1">or click to browse</span>
          )}
          <p className="text-xs text-slate-500 mt-2">Supported: .sav, .sa2</p>
        </div>
      </div>
    </div>
  )
}
