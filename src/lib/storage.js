import { DEVICE_ID_KEY, STORAGE_PREFIX } from './constants'

const SAFE_DEVICE_ID_PATTERN = /^[a-zA-Z0-9._-]+$/

export function buildStorageKey(key, scope = 'local') {
  return `${STORAGE_PREFIX}:${scope}:${key}`
}

export function safeStorageGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
    return
  }
}

export function readJson(key, fallback) {
  try {
    const raw = safeStorageGet(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function createFallbackId() {
  return `device-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function getDeviceId() {
  const current = safeStorageGet(DEVICE_ID_KEY)
  if (current && SAFE_DEVICE_ID_PATTERN.test(current)) return current

  const next =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : createFallbackId()

  safeStorageSet(DEVICE_ID_KEY, next)
  return next
}
