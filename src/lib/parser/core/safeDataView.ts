/**
 * DataView wrapper for little-endian operations with bounds checking
 * Shared utility to eliminate code duplication
 */
export class SafeDataView {
  private readonly view: DataView

  constructor (buffer: ArrayBuffer, byteOffset = 0, byteLength?: number) {
    this.view = new DataView(buffer, byteOffset, byteLength)
  }

  getUint8 (byteOffset: number): number {
    if (byteOffset >= this.view.byteLength) {
      throw new RangeError(`Offset ${byteOffset} out of bounds`)
    }
    return this.view.getUint8(byteOffset)
  }

  getUint16 (byteOffset: number, littleEndian = true): number {
    if (byteOffset + 1 >= this.view.byteLength) {
      throw new RangeError(`Offset ${byteOffset} out of bounds`)
    }
    return this.view.getUint16(byteOffset, littleEndian)
  }

  getUint32 (byteOffset: number, littleEndian = true): number {
    if (byteOffset + 3 >= this.view.byteLength) {
      throw new RangeError(`Offset ${byteOffset} out of bounds`)
    }
    return this.view.getUint32(byteOffset, littleEndian)
  }

  getBytes (byteOffset: number, length: number): Uint8Array {
    if (byteOffset + length > this.view.byteLength) {
      throw new RangeError(`Range ${byteOffset}:${byteOffset + length} out of bounds`)
    }
    return new Uint8Array(this.view.buffer, this.view.byteOffset + byteOffset, length)
  }

  setUint8 (byteOffset: number, value: number): void {
    if (byteOffset >= this.view.byteLength) {
      throw new RangeError(`Offset ${byteOffset} out of bounds`)
    }
    this.view.setUint8(byteOffset, value)
  }

  setUint16 (byteOffset: number, value: number, littleEndian = true): void {
    if (byteOffset + 1 >= this.view.byteLength) {
      throw new RangeError(`Offset ${byteOffset} out of bounds`)
    }
    this.view.setUint16(byteOffset, value, littleEndian)
  }

  setUint32 (byteOffset: number, value: number, littleEndian = true): void {
    if (byteOffset + 3 >= this.view.byteLength) {
      throw new RangeError(`Offset ${byteOffset} out of bounds`)
    }
    this.view.setUint32(byteOffset, value, littleEndian)
  }

  setBytes (byteOffset: number, bytes: Uint8Array): void {
    if (byteOffset + bytes.length > this.view.byteLength) {
      throw new RangeError(`Range ${byteOffset}:${byteOffset + bytes.length} out of bounds`)
    }
    new Uint8Array(this.view.buffer, this.view.byteOffset + byteOffset, bytes.length).set(bytes)
  }

  get byteLength (): number {
    return this.view.byteLength
  }
}
