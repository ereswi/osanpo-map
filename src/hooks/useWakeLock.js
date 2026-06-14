import { useEffect, useState } from 'react'

export function useWakeLock(active) {
  const [wakeLockActive, setWakeLockActive] = useState(false)

  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return undefined

    let cancelled = false
    let lock

    const requestWakeLock = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          await lock.release()
          return
        }

        setWakeLockActive(true)
        lock.addEventListener('release', () => {
          setWakeLockActive(false)
        })
      } catch {
        setWakeLockActive(false)
      }
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && active) {
        void requestWakeLock()
      }
    }

    void requestWakeLock()
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibility)
      lock?.release?.()
    }
  }, [active])

  return active && wakeLockActive
}
