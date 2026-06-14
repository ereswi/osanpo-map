import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_CENTER,
  MAX_STORED_SESSIONS,
  MAX_STORED_TRAIL_POINTS,
  WALK_STATE_KEY,
} from '../lib/constants'
import { distanceMeters } from '../lib/distance'
import {
  getGeolocationSupportError,
  getLocationErrorMessage,
  toMapPoint,
} from '../lib/geolocation'
import { cellFromLatLng, cellId } from '../lib/grid'
import {
  buildStorageKey,
  getDeviceId,
  readJson,
  safeStorageSet,
} from '../lib/storage'
import { loadVisitedState, syncVisitedCells } from '../services/firebase'

const MIN_TRAIL_DISTANCE_METERS = 5
const MIN_POSITION_UPDATE_METERS = 12
const MAX_POSITION_UPDATE_INTERVAL_MS = 15000
const SYNC_ERROR_MESSAGE =
  'Firestoreへの保存に失敗しています。Firestore Rulesの反映状況とログイン状態を確認してください。'

function loadWalkState(storageScope) {
  return readJson(buildStorageKey(WALK_STATE_KEY, storageScope), {
    visitedCells: {},
    sessions: [],
    trail: [],
  })
}

function persistWalkState(storageScope, visitedCells, trail, sessions) {
  safeStorageSet(
    buildStorageKey(WALK_STATE_KEY, storageScope),
    JSON.stringify({
      visitedCells,
      sessions: sessions.slice(0, MAX_STORED_SESSIONS),
      trail: trail.slice(-MAX_STORED_TRAIL_POINTS),
      updatedAt: new Date().toISOString(),
    }),
  )
}

function formatTime(date) {
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

function getLastItem(list) {
  return list.length > 0 ? list[list.length - 1] : null
}

function createSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function getPointSessionId(point) {
  return point?.sessionId ?? 'legacy'
}

function canConnectTrailPoints(left, right) {
  return getPointSessionId(left) === getPointSessionId(right)
}

function calculateTrailDistance(points) {
  let meters = 0

  for (let index = 1; index < points.length; index += 1) {
    if (!canConnectTrailPoints(points[index - 1], points[index])) continue
    meters += distanceMeters(points[index - 1], points[index])
  }

  return meters
}

function shouldIgnorePositionJitter(previous, next) {
  if (!previous) return false

  const movedMeters = distanceMeters(previous, next)
  const elapsedMs = Math.abs(
    new Date(next.recordedAt).getTime() - new Date(previous.recordedAt).getTime(),
  )
  const accuracyFloor = Math.min(Math.max(next.accuracy ?? 0, 0), 25) / 2
  const threshold = Math.max(MIN_POSITION_UPDATE_METERS, accuracyFloor)

  return movedMeters < threshold && elapsedMs < MAX_POSITION_UPDATE_INTERVAL_MS
}

function mergeVisitedCells(current, incoming) {
  const merged = { ...current }

  for (const [id, nextCell] of Object.entries(incoming ?? {})) {
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

function mergeTrail(current, incoming) {
  const seen = new Set()
  const merged = []

  for (const point of [...current, ...(incoming ?? [])]) {
    if (!point?.recordedAt) continue
    const id = `${point.recordedAt}:${point.lat}:${point.lng}:${point.sessionId ?? ''}`
    if (seen.has(id)) continue
    seen.add(id)
    merged.push(point)
  }

  merged.sort((left, right) => {
    return Date.parse(left.recordedAt) - Date.parse(right.recordedAt)
  })

  return merged.slice(-MAX_STORED_TRAIL_POINTS)
}

function normalizeSessions(rawSessions) {
  if (!Array.isArray(rawSessions)) return []

  return rawSessions
    .filter((session) => session && typeof session === 'object' && session.id)
    .map((session) => {
      const trail = Array.isArray(session.trail) ? session.trail : []

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
          : calculateTrailDistance(trail),
        visitedCellIds: Array.isArray(session.visitedCellIds)
          ? session.visitedCellIds.filter((id) => typeof id === 'string')
          : [],
        newVisitedCellIds: Array.isArray(session.newVisitedCellIds)
          ? session.newVisitedCellIds.filter((id) => typeof id === 'string')
          : [],
        pointCount: Number.isFinite(session.pointCount)
          ? session.pointCount
          : trail.length,
        trail,
      }
    })
    .sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt))
    .slice(0, MAX_STORED_SESSIONS)
}

function mergeSessions(current, incoming) {
  const merged = new Map()

  for (const session of [...current, ...(incoming ?? [])]) {
    if (!session?.id) continue
    const existing = merged.get(session.id)
    if (!existing || Date.parse(session.endedAt) >= Date.parse(existing.endedAt)) {
      merged.set(session.id, session)
    }
  }

  return normalizeSessions([...merged.values()])
}

function finalizeSession(session, endedAt) {
  if (!session) return null

  const trail = session.trail.slice()
  const visitedCellIds = [...session.visitedCellIds]
  const newVisitedCellIds = [...session.newVisitedCellIds]

  if (trail.length === 0 && visitedCellIds.length === 0) return null

  return {
    id: session.id,
    startedAt: session.startedAt,
    endedAt,
    distanceMeters: calculateTrailDistance(trail),
    visitedCellIds,
    newVisitedCellIds,
    pointCount: trail.length,
    trail,
  }
}

function getFirestoreSyncErrorMessage(error) {
  if (error?.code === 'permission-denied') {
    return `${SYNC_ERROR_MESSAGE} (permission-denied)`
  }

  if (error?.code === 'unauthenticated') {
    return `${SYNC_ERROR_MESSAGE} (unauthenticated)`
  }

  return `${SYNC_ERROR_MESSAGE}${error?.code ? ` (${error.code})` : ''}`
}

export function useWalkRecorder({ storageScope, user, canSync }) {
  const stored = useMemo(() => loadWalkState(storageScope), [storageScope])
  const [position, setPosition] = useState(null)
  const [trail, setTrail] = useState(stored.trail)
  const [visitedCells, setVisitedCells] = useState(stored.visitedCells)
  const [sessions, setSessions] = useState(() => normalizeSessions(stored.sessions))
  const [isTracking, setIsTracking] = useState(false)
  const [status, setStatus] = useState('まだ記録を開始していません')
  const [error, setError] = useState('')
  const [syncError, setSyncError] = useState('')
  const [syncStatus, setSyncStatus] = useState(canSync ? '同期準備中' : '同期なし')
  const [restoredUserId, setRestoredUserId] = useState('')
  const watchIdRef = useRef(null)
  const lastAcceptedPositionRef = useRef(getLastItem(stored.trail))
  const activeSessionRef = useRef(null)
  const deviceId = useMemo(() => getDeviceId(), [])
  const restoreTargetUserId = canSync && user ? user.uid : ''
  const isRestoring = Boolean(restoreTargetUserId && restoredUserId !== restoreTargetUserId)

  const visitedList = useMemo(
    () =>
      Object.entries(visitedCells).map(([id, visited]) => ({
        id,
        ...visited,
      })),
    [visitedCells],
  )

  const totalDistanceMeters = useMemo(() => {
    return calculateTrailDistance(trail)
  }, [trail])

  const mapCenter = useMemo(() => {
    if (position) return [position.lat, position.lng]

    const lastTrailPoint = getLastItem(trail)
    if (lastTrailPoint) return [lastTrailPoint.lat, lastTrailPoint.lng]

    return [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]
  }, [position, trail])

  useEffect(() => {
    persistWalkState(storageScope, visitedCells, trail, sessions)
  }, [sessions, storageScope, trail, visitedCells])

  useEffect(() => {
    if (!canSync || !user) return

    let cancelled = false

    void loadVisitedState(user)
      .then((remoteState) => {
        if (cancelled) return

        setVisitedCells((current) => mergeVisitedCells(current, remoteState.visitedCells))
        setTrail((current) => {
          const mergedTrail = mergeTrail(current, remoteState.trail)
          lastAcceptedPositionRef.current = getLastItem(mergedTrail)
          return mergedTrail
        })
        setSessions((current) => mergeSessions(current, remoteState.sessions))
        setSyncError('')
        setSyncStatus('同期準備完了')
        setRestoredUserId(user.uid)
      })
      .catch((nextError) => {
        if (!cancelled) {
          setError('保存済みの記録を読み込めませんでした。ローカルの記録で続行します。')
          setSyncError(getFirestoreSyncErrorMessage(nextError))
          setSyncStatus('同期エラー')
          setRestoredUserId(user.uid)
        }
      })

    return () => {
      cancelled = true
    }
  }, [canSync, user])

  useEffect(() => {
    if (!canSync || !user || isRestoring) return

    syncVisitedCells({
      user,
      deviceId,
      visitedCells,
      sessions,
      trail,
    })
      .then(() => {
        setSyncError('')
        setSyncStatus('Firestore保存済み')
      })
      .catch((nextError) => {
        setSyncError(getFirestoreSyncErrorMessage(nextError))
        setSyncStatus('同期エラー')
      })
  }, [canSync, deviceId, isRestoring, sessions, trail, user, visitedCells])

  useEffect(
    () => () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    },
    [],
  )

  const startTracking = () => {
    const supportError = getGeolocationSupportError()
    if (supportError) {
      setError(supportError)
      setStatus('位置情報を利用できません')
      return
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }

    setError('')
    setStatus('現在地の取得を開始しています...')
    setIsTracking(true)
    activeSessionRef.current = {
      id: createSessionId(),
      startedAt: new Date().toISOString(),
      startVisitedCellIds: new Set(Object.keys(visitedCells)),
      visitedCellIds: new Set(),
      newVisitedCellIds: new Set(),
      trail: [],
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (nextPosition) => {
        const next = toMapPoint(nextPosition)

        if (shouldIgnorePositionJitter(lastAcceptedPositionRef.current, next)) {
          setStatus(`記録中 ${formatTime(new Date())}`)
          return
        }

        lastAcceptedPositionRef.current = next
        const activeSession = activeSessionRef.current
        const nextTrailPoint = activeSession
          ? { ...next, sessionId: activeSession.id }
          : next
        const cell = cellFromLatLng(next.lat, next.lng)
        const id = cellId(cell)
        const previousSessionPoint = getLastItem(activeSession?.trail ?? [])
        const isDuplicate =
          previousSessionPoint &&
          distanceMeters(previousSessionPoint, nextTrailPoint) <
            MIN_TRAIL_DISTANCE_METERS &&
          Math.abs(
            new Date(nextTrailPoint.recordedAt) -
              new Date(previousSessionPoint.recordedAt),
          ) < 4000

        if (activeSession) {
          activeSession.visitedCellIds.add(id)
          if (!activeSession.startVisitedCellIds.has(id)) {
            activeSession.newVisitedCellIds.add(id)
          }
          if (!isDuplicate) {
            activeSession.trail.push(nextTrailPoint)
          }
        }

        setPosition(next)
        if (!isDuplicate) {
          setTrail((current) =>
            [...current, nextTrailPoint].slice(-MAX_STORED_TRAIL_POINTS),
          )
        }
        setVisitedCells((current) => ({
          ...current,
          [id]: {
            ...cell,
            lat: next.lat,
            lng: next.lng,
            visitedAt: next.recordedAt,
          },
        }))
        setStatus(`記録中 ${formatTime(new Date())}`)
      },
      (geoError) => {
        setError(getLocationErrorMessage(geoError))
        setStatus('位置情報の取得に失敗しました')
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      },
    )
  }

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }

    setIsTracking(false)
    const completedSession = finalizeSession(
      activeSessionRef.current,
      new Date().toISOString(),
    )
    activeSessionRef.current = null

    if (completedSession) {
      setSessions((current) => mergeSessions([completedSession], current))
    }

    setStatus('記録を停止しました')
  }

  const clearExploration = () => {
    setVisitedCells({})
    setSessions([])
    setTrail([])
    setPosition(null)
    lastAcceptedPositionRef.current = null
    activeSessionRef.current = null
    setStatus('記録をリセットしました')
  }

  return {
    clearExploration,
    error,
    isRestoring,
    isTracking,
    mapCenter,
    position,
    sessions,
    startTracking,
    status,
    stopTracking,
    syncError,
    syncStatus,
    totalDistanceMeters,
    trail,
    visitedCells,
    visitedList,
  }
}
