import { useEffect, useState } from 'react'
import { buildStorageKey, safeStorageGet, safeStorageSet } from '../lib/storage'

export function usePersistentFlag({ storageScope, key, defaultValue }) {
  const [value, setValue] = useState(() => {
    const stored = safeStorageGet(buildStorageKey(key, storageScope))
    if (stored === null) return defaultValue
    return stored === 'true'
  })

  useEffect(() => {
    safeStorageSet(buildStorageKey(key, storageScope), String(value))
  }, [key, storageScope, value])

  return [value, setValue]
}
