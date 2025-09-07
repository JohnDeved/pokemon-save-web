import type React from 'react'

export function setRef<T>(ref: React.Ref<T> | undefined, value: T | null): void {
  if (!ref) return
  if (typeof ref === 'function') {
    ref(value)
  } else {
    // eslint-disable-next-line no-param-reassign
    ;(ref as React.MutableRefObject<T | null>).current = value
  }
}
