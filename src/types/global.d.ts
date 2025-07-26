declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>
  }
}

interface SaveFilePickerOptions {
  suggestedName?: string
  types?: Array<{
    description?: string
    accept: Record<string, string[]>
  }>
}

interface OpenFilePickerOptions {
  multiple?: boolean
  types?: Array<{
    description?: string
    accept: Record<string, string[]>
  }>
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>
  getFile(): Promise<File>
}

interface FileSystemWritableFileStream {
  write(data: BufferSource | Blob | string): Promise<void>
  close(): Promise<void>
}

export {}
