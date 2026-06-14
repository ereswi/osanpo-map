import { initializeApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  setDoc,
} from 'firebase/firestore'
import { SYNC_SESSIONS, SYNC_TRAIL_POINTS } from '../lib/constants'

let firebaseApp
let firebaseAuth
let firebaseDb
let authBootstrapPromise
let persistencePromise

function getFirebaseConfig() {
  const {
    VITE_FIREBASE_API_KEY,
    VITE_FIREBASE_AUTH_DOMAIN,
    VITE_FIREBASE_PROJECT_ID,
    VITE_FIREBASE_STORAGE_BUCKET,
    VITE_FIREBASE_MESSAGING_SENDER_ID,
    VITE_FIREBASE_APP_ID,
  } = import.meta.env

  if (
    !VITE_FIREBASE_API_KEY ||
    !VITE_FIREBASE_AUTH_DOMAIN ||
    !VITE_FIREBASE_PROJECT_ID ||
    !VITE_FIREBASE_STORAGE_BUCKET ||
    !VITE_FIREBASE_MESSAGING_SENDER_ID ||
    !VITE_FIREBASE_APP_ID
  ) {
    return null
  }

  return {
    apiKey: VITE_FIREBASE_API_KEY,
    authDomain: VITE_FIREBASE_AUTH_DOMAIN,
    projectId: VITE_FIREBASE_PROJECT_ID,
    storageBucket: VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: VITE_FIREBASE_APP_ID,
  }
}

function getFirebaseApp() {
  if (firebaseApp) return firebaseApp

  const config = getFirebaseConfig()
  if (!config) return null

  firebaseApp = initializeApp(config)
  return firebaseApp
}

function getDb() {
  if (firebaseDb) return firebaseDb

  const app = getFirebaseApp()
  if (!app) return null

  firebaseDb = getFirestore(app)
  return firebaseDb
}

function getAuthInstance() {
  if (firebaseAuth) return firebaseAuth

  const app = getFirebaseApp()
  if (!app) return null

  firebaseAuth = getAuth(app)
  firebaseAuth.languageCode = 'ja'
  return firebaseAuth
}

function normalizeFirebaseError(error) {
  const code = error?.code ?? ''

  switch (code) {
    case 'auth/popup-closed-by-user':
      return 'Google ログインの画面が閉じられました。もう一度お試しください。'
    case 'auth/popup-blocked':
      return 'ポップアップがブロックされました。ブラウザ設定を確認して、もう一度お試しください。'
    case 'auth/cancelled-popup-request':
      return '別のログイン操作が進行中です。少し待ってからもう一度お試しください。'
    case 'auth/unauthorized-domain':
      return 'このURLのホスト名が Firebase Authentication の Authorized domains に入っていません。'
    case 'auth/operation-not-supported-in-this-environment':
      return 'このブラウザ環境では、このログイン方式が使えません。'
    case 'auth/network-request-failed':
      return 'ネットワーク接続を確認して、もう一度お試しください。'
    default:
      return error?.message ?? 'ログインに失敗しました。'
  }
}

function normalizeVisitedCells(rawVisitedCells) {
  if (!rawVisitedCells || typeof rawVisitedCells !== 'object') {
    return {}
  }

  const normalized = {}
  for (const [id, cell] of Object.entries(rawVisitedCells)) {
    if (!cell || typeof cell !== 'object') continue
    if (!Number.isFinite(cell.gridX) || !Number.isFinite(cell.gridY)) continue

    normalized[id] = {
      gridX: cell.gridX,
      gridY: cell.gridY,
      lat: Number.isFinite(cell.lat) ? cell.lat : null,
      lng: Number.isFinite(cell.lng) ? cell.lng : null,
      visitedAt:
        typeof cell.visitedAt === 'string' ? cell.visitedAt : new Date(0).toISOString(),
    }
  }

  return normalized
}

function normalizeTrail(rawTrail) {
  if (!Array.isArray(rawTrail)) return []

  return rawTrail
    .filter((point) => {
      return (
        point &&
        typeof point === 'object' &&
        Number.isFinite(point.lat) &&
        Number.isFinite(point.lng) &&
        typeof point.recordedAt === 'string'
      )
    })
    .map((point) => ({
      lat: point.lat,
      lng: point.lng,
      accuracy: Number.isFinite(point.accuracy) ? point.accuracy : null,
      recordedAt: point.recordedAt,
      ...(typeof point.sessionId === 'string' ? { sessionId: point.sessionId } : {}),
    }))
}

function normalizeStringList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []
}

function normalizeSessions(rawSessions) {
  if (!Array.isArray(rawSessions)) return []

  return rawSessions
    .filter((session) => session && typeof session === 'object' && session.id)
    .map((session) => {
      const trail = normalizeTrail(session.trail)

      return {
        id: String(session.id),
        startedAt:
          typeof session.startedAt === 'string'
            ? session.startedAt
            : new Date(0).toISOString(),
        endedAt:
          typeof session.endedAt === 'string'
            ? session.endedAt
            : typeof session.startedAt === 'string'
              ? session.startedAt
              : new Date(0).toISOString(),
        distanceMeters: Number.isFinite(session.distanceMeters)
          ? session.distanceMeters
          : 0,
        visitedCellIds: normalizeStringList(session.visitedCellIds),
        newVisitedCellIds: normalizeStringList(session.newVisitedCellIds),
        pointCount: Number.isFinite(session.pointCount)
          ? session.pointCount
          : trail.length,
        trail,
      }
    })
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
    .slice(0, SYNC_SESSIONS)
}

function mergeVisitedCellsByFreshness(current, incoming) {
  const merged = { ...current }

  for (const [id, nextCell] of Object.entries(incoming)) {
    const currentCell = merged[id]
    if (!currentCell) {
      merged[id] = nextCell
      continue
    }

    const currentVisitedAt = Date.parse(currentCell.visitedAt ?? '')
    const nextVisitedAt = Date.parse(nextCell.visitedAt ?? '')

    if (
      Number.isNaN(currentVisitedAt) ||
      (!Number.isNaN(nextVisitedAt) && nextVisitedAt >= currentVisitedAt)
    ) {
      merged[id] = nextCell
    }
  }

  return merged
}

function mergeTrailPoints(points) {
  const seen = new Set()
  const uniquePoints = []

  for (const point of points) {
    const id = `${point.recordedAt}:${point.lat}:${point.lng}:${point.sessionId ?? ''}`
    if (seen.has(id)) continue
    seen.add(id)
    uniquePoints.push(point)
  }

  uniquePoints.sort((left, right) => {
    return Date.parse(left.recordedAt) - Date.parse(right.recordedAt)
  })

  return uniquePoints.slice(-SYNC_TRAIL_POINTS)
}

function mergeSessions(sessions) {
  const merged = new Map()

  for (const session of sessions) {
    if (!session?.id) continue
    const existing = merged.get(session.id)
    if (!existing || Date.parse(session.endedAt) >= Date.parse(existing.endedAt)) {
      merged.set(session.id, session)
    }
  }

  return normalizeSessions([...merged.values()])
}

async function ensurePersistence(auth) {
  if (!persistencePromise) {
    persistencePromise = setPersistence(auth, browserLocalPersistence).catch(() => {
      return
    })
  }

  await persistencePromise
}

export function getAuthRequirement() {
  return true
}

export function getConfigError() {
  if (!getFirebaseConfig()) {
    return 'Firebase 設定が未完了です。.env の VITE_FIREBASE_* を設定してください。'
  }
  return ''
}

export async function bootstrapAuthSession() {
  const auth = getAuthInstance()
  if (!auth) return { error: null, user: null }

  if (!authBootstrapPromise) {
    authBootstrapPromise = (async () => {
      await ensurePersistence(auth)

      try {
        const result = await getRedirectResult(auth)
        return { error: null, user: result?.user ?? auth.currentUser ?? null }
      } catch (error) {
        return { error: normalizeFirebaseError(error), user: auth.currentUser ?? null }
      }
    })()
  }

  return authBootstrapPromise
}

export function observeAuthState(callback) {
  const auth = getAuthInstance()
  if (!auth) {
    callback(null)
    return () => {}
  }

  return onAuthStateChanged(auth, callback)
}

export async function signInWithGoogle() {
  const auth = getAuthInstance()
  if (!auth) {
    throw new Error('Firebase Authentication の設定が未完了です。')
  }

  await ensurePersistence(auth)

  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({
    prompt: 'select_account',
  })

  try {
    const result = await signInWithPopup(auth, provider)
    return result.user
  } catch (error) {
    const code = error?.code ?? ''
    if (
      code !== 'auth/popup-blocked' &&
      code !== 'auth/operation-not-supported-in-this-environment'
    ) {
      throw new Error(normalizeFirebaseError(error), { cause: error })
    }
  }

  await signInWithRedirect(auth, provider)
  return null
}

export async function signOutUser() {
  const auth = getAuthInstance()
  if (!auth) return

  await signOut(auth)
}

export async function loadVisitedState(user) {
  const db = getDb()
  if (!db || !user) {
    return { visitedCells: {}, sessions: [], trail: [] }
  }

  const snapshot = await getDocs(collection(db, 'users', user.uid, 'devices'))
  let visitedCells = {}
  const trailPoints = []
  const sessions = []

  snapshot.forEach((deviceDoc) => {
    const data = deviceDoc.data()
    visitedCells = mergeVisitedCellsByFreshness(
      visitedCells,
      normalizeVisitedCells(data.visitedCells),
    )
    trailPoints.push(...normalizeTrail(data.trail))
    sessions.push(...normalizeSessions(data.sessions))
  })

  return {
    visitedCells,
    sessions: mergeSessions(sessions),
    trail: mergeTrailPoints(trailPoints),
  }
}

export async function syncVisitedCells({
  user,
  deviceId,
  visitedCells,
  sessions,
  trail,
}) {
  const db = getDb()
  if (!db || !user) return

  await setDoc(
    doc(db, 'users', user.uid, 'devices', deviceId),
    {
      deviceId,
      userId: user.uid,
      email: user.email ?? null,
      displayName: user.displayName ?? null,
      visitedCells,
      sessions: sessions.slice(0, SYNC_SESSIONS),
      trail: trail.slice(-SYNC_TRAIL_POINTS),
      updatedAt: new Date().toISOString(),
    },
    { merge: true },
  )
}
