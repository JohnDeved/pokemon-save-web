/**
 * Go WASM Parser Wrapper
 * JavaScript interface for the Go-based Pokemon save parser
 */

class GoWASMParser {
  constructor() {
    this.wasmModule = null;
    this.go = null;
    this.ready = false;
    this.readyPromise = null;
  }

  async initialize(wasmPath = '/parser.wasm') {
    if (this.readyPromise) {
      return this.readyPromise;
    }

    this.readyPromise = this._loadWASM(wasmPath);
    return this.readyPromise;
  }

  async _loadWASM(wasmPath) {
    if (typeof window === 'undefined' && typeof global !== 'undefined') {
      // Node.js environment
      try {
        const fs = require('fs');
        const path = require('path');
        
        // For Node.js tests, we'll mock the functionality since WASM won't work easily
        if (process.env.NODE_ENV === 'test') {
          throw new Error('WASM not available in test environment');
        }
        
        const { Go } = require('./wasm_exec.js');
        this.go = new Go();
        
        const wasmBuffer = fs.readFileSync(path.resolve(wasmPath));
        const wasmModule = await WebAssembly.compile(wasmBuffer);
        const wasmInstance = await WebAssembly.instantiate(wasmModule, this.go.importObject);
        
        this.go.run(wasmInstance);
        this.ready = true;
        return;
      } catch (error) {
        throw new Error(`Failed to load WASM in Node.js: ${error.message}`);
      }
    }

    // Browser environment
    const go = new Go();
    this.go = go;

    const response = await fetch(wasmPath);
    const wasmBytes = await response.arrayBuffer();
    const wasmModule = await WebAssembly.compile(wasmBytes);
    const wasmInstance = await WebAssembly.instantiate(wasmModule, go.importObject);

    // Listen for WASM ready message
    const originalPostMessage = globalThis.postMessage;
    const readyPromise = new Promise((resolve) => {
      globalThis.postMessage = (data) => {
        if (data && data.type === 'wasm-ready') {
          this.ready = true;
          resolve();
        }
        if (originalPostMessage) {
          originalPostMessage(data);
        }
      };
    });

    go.run(wasmInstance);
    await readyPromise;
    
    // Restore original postMessage
    globalThis.postMessage = originalPostMessage;
  }

  async parseSaveFile(saveData) {
    await this.initialize();
    
    if (!this.ready) {
      throw new Error('WASM module not ready');
    }

    if (!(saveData instanceof Uint8Array)) {
      if (ArrayBuffer.isView(saveData)) {
        saveData = new Uint8Array(saveData.buffer);
      } else if (saveData instanceof ArrayBuffer) {
        saveData = new Uint8Array(saveData);
      } else {
        throw new Error('saveData must be Uint8Array, ArrayBuffer, or typed array');
      }
    }

    try {
      const resultJSON = await globalThis.parseBytes(saveData);
      return JSON.parse(resultJSON);
    } catch (error) {
      if (typeof error === 'string') {
        try {
          const errorObj = JSON.parse(error);
          throw new Error(errorObj.error + (errorObj.details ? ': ' + errorObj.details : ''));
        } catch {
          throw new Error(error);
        }
      }
      throw error;
    }
  }

  async encodeText(text, maxLength = 10) {
    await this.initialize();
    
    if (!this.ready) {
      throw new Error('WASM module not ready');
    }

    return globalThis.encodeText(text, maxLength);
  }

  async decodeText(data) {
    await this.initialize();
    
    if (!this.ready) {
      throw new Error('WASM module not ready');
    }

    if (!(data instanceof Uint8Array)) {
      if (ArrayBuffer.isView(data)) {
        data = new Uint8Array(data.buffer);
      } else if (data instanceof ArrayBuffer) {
        data = new Uint8Array(data);
      } else {
        throw new Error('data must be Uint8Array, ArrayBuffer, or typed array');
      }
    }

    return globalThis.decodeText(data);
  }

  async getVersion() {
    await this.initialize();
    
    if (!this.ready) {
      throw new Error('WASM module not ready');
    }

    return globalThis.getVersion();
  }

  isReady() {
    return this.ready;
  }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GoWASMParser };
} else if (typeof window !== 'undefined') {
  window.GoWASMParser = GoWASMParser;
}

export { GoWASMParser };