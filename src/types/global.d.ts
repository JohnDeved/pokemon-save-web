declare global {
  interface Window {
    showSaveFilePicker?: (options?: any) => Promise<any>;
    showOpenFilePicker?: (options?: any) => Promise<any>;
  }
}

export {};