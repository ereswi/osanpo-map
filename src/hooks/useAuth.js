import { useEffect, useState } from 'react'
import {
  bootstrapAuthSession,
  getAuthRequirement,
  getConfigError,
  observeAuthState,
  signInWithGoogle,
  signOutUser,
} from '../services/firebase'

const AUTH_BOOT_TIMEOUT_MS = 8000

export function useAuth() {
  const authRequired = getAuthRequirement()
  const configError = getConfigError()
  const [user, setUser] = useState(null)
  const [isReady, setIsReady] = useState(Boolean(configError))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!authRequired || configError) return undefined

    let cancelled = false
    let resolvedByObserver = false

    void bootstrapAuthSession().then((result) => {
      if (cancelled) return
      if (result.user) {
        setUser(result.user)
        setIsReady(true)
        setIsSubmitting(false)
      }
      if (result.error) {
        setError(result.error)
      }
    })

    const timeoutId = window.setTimeout(() => {
      if (!cancelled && !resolvedByObserver) {
        setError(
          '認証状態の確認に時間がかかっています。ブラウザを再読み込みして、もう一度お試しください。',
        )
        setIsReady(true)
      }
    }, AUTH_BOOT_TIMEOUT_MS)

    const unsubscribe = observeAuthState((nextUser) => {
      resolvedByObserver = true
      if (cancelled) return
      window.clearTimeout(timeoutId)
      setUser(nextUser)
      setIsReady(true)
      setIsSubmitting(false)
    })

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      unsubscribe()
    }
  }, [authRequired, configError])

  const signIn = async () => {
    setError('')
    setIsSubmitting(true)

    try {
      const nextUser = await signInWithGoogle()
      if (nextUser) {
        setUser(nextUser)
        setIsReady(true)
      }
    } catch (nextError) {
      setError(nextError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const signOut = async () => {
    await signOutUser()
    setUser(null)
  }

  return {
    authRequired,
    configError,
    error,
    isAllowed: Boolean(user),
    isAuthenticated: Boolean(user),
    isReady,
    isSubmitting,
    signIn,
    signOut,
    user,
  }
}
