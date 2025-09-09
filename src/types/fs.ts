export interface WithFsPermissions {
  queryPermission?: (desc?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
  requestPermission?: (desc?: { mode?: 'read' | 'readwrite' }) => Promise<PermissionState>
}

export function hasFsPermissions(handle: unknown): handle is FileSystemFileHandle & WithFsPermissions {
  if (!handle || typeof handle !== 'object') return false
  const obj = handle as Partial<WithFsPermissions>
  return typeof obj.queryPermission === 'function' || typeof obj.requestPermission === 'function'
}
