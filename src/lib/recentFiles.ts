export interface RecentEntry {
  id: number
  name: string
  handle: FileSystemFileHandle
  updatedAt: number
}

const DB_NAME = 'pokemon-save-web'
const STORE = 'recents'
const MAX_RECENTS = 5

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.addEventListener('upgradeneeded', () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
        store.createIndex('updatedAt', 'updatedAt')
      }
    })
    req.addEventListener('success', () => resolve(req.result))
    req.addEventListener('error', () => reject(req.error))
  })
}

export async function listRecents(): Promise<RecentEntry[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const store = tx.objectStore(STORE)

    const records: RecentEntry[] = []
    const cursorReq = store.openCursor()
    cursorReq.addEventListener('success', () => {
      const cursor = cursorReq.result
      if (cursor) {
        records.push(cursor.value as RecentEntry)
        cursor.continue()
      } else {
        // Sort newest first and trim
        records.sort((a, b) => b.updatedAt - a.updatedAt)
        resolve(records.slice(0, MAX_RECENTS))
      }
    })
    cursorReq.addEventListener('error', () => reject(cursorReq.error))
  })
}

export async function clearRecents(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.clear()
    req.addEventListener('success', () => resolve())
    req.addEventListener('error', () => reject(req.error))
  })
}

async function putRecord(record: Omit<RecentEntry, 'id'> & Partial<Pick<RecentEntry, 'id'>>): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.put(record)
    req.addEventListener('success', () => resolve(req.result as number))
    req.addEventListener('error', () => reject(req.error))
  })
}

async function deleteRecord(id: number): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.delete(id)
    req.addEventListener('success', () => resolve())
    req.addEventListener('error', () => reject(req.error))
  })
}

export async function addRecent(handle: FileSystemFileHandle, name: string): Promise<void> {
  try {
    // Normalize name
    const displayName = name || handle.name || 'Unknown file'

    // Deduplicate by isSameEntry if possible
    const existing = await listRecents()
    for (const rec of existing) {
      try {
        const same = typeof rec.handle.isSameEntry === 'function' ? await rec.handle.isSameEntry(handle) : undefined
        if (same === true || (rec.handle.name && rec.handle.name === handle.name)) {
          await putRecord({ id: rec.id, name: displayName, handle, updatedAt: Date.now() })
          return
        }
      } catch {
        // Ignore comparison failure, treat as different handle
      }
    }

    // Insert new
    await putRecord({ name: displayName, handle, updatedAt: Date.now() })

    // Enforce MAX_RECENTS
    const all = await listRecents()
    if (all.length > MAX_RECENTS) {
      const toDelete = all.slice(MAX_RECENTS)
      await Promise.allSettled(toDelete.map(r => deleteRecord(r.id)))
    }
  } catch {
    // Swallow storage errors silently; recents are a non-critical feature
  }
}

export async function removeRecent(id: number): Promise<void> {
  try {
    await deleteRecord(id)
  } catch {}
}
