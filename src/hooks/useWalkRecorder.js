import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_CENTER,
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
import { syncVisitedCells } from '../services/firebase'

const MIN_TRAIL_DISTANCE_METERS = 5
const MIN_POSITION_UPDATE_METERS = 12
const MAX_POSITION_UPDATE_INTERVAL_MS = 15000

function loadWalkState(storageScope) {
  return readJson(buildStorageKey(WALK_STATE_KEY, storageScope), {
    visitedCells: {},
    trail: [],
  })
}

function persistWalkState(storageScope, visitedCells, trail) {
  safeStorageSet(
    buildStorageKey(WALK_STATE_KEY, storageScope),
    JSON.stringify({
      visitedCells,
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

export function useWalkRecorder({ storageScope, user, canSync }) {
  const stored = useMemo(() => loadWalkState(storageScope), [storageScope])
  const [position, setPosition] = useState(null)
  const [trail, setTrail] = useState(stored.trail)
  const [visitedCells, setVisitedCells] = useState(stored.visitedCells)
  const [isTracking, setIsTracking] = useState(false)
  const [status, setStatus] = useState('まだ記録を開始していません')
  const [error, setError] = useState('')
  const watchIdRef = useRef(null)
  const lastAcceptedPositionRef = useRef(null)
  const deviceId = useMemo(() => getDeviceId(), [])

  const visitedList = useMemo(
    () =>
      Object.entries(visitedCells).map(([id, visited]) => ({
        id,
        ...visited,
      })),
    [visitedCells],
  )

  const totalDistanceMeters = useMemo(() => {
    let meters = 0
    for (let index = 1; index < trail.length; index += 1) {
      meters += distanceMeters(trail[index - 1], trail[index])
    }
    return meters
  }, [trail])

  const mapCenter = useMemo(() => {
    if (position) return [position.lat, position.lng]

    const lastTrailPoint = getLastItem(trail)
    if (lastTrailPoint) return [lastTrailPoint.lat, lastTrailPoint.lng]

    return [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng]
  }, [position, trail])

  useEffect(() => {
    persistWalkState(storageScope, visitedCells, trail)
  }, [storageScope, trail, visitedCells])

  useEffect(() => {
    if (!canSync || !user) return

    syncVisitedCells({
      user,
      deviceId,
      visitedCells,
      trail,
    }).catch(() => {
      return
    })
  }, [canSync, deviceId, trail, user, visitedCells])

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

    watchIdRef.current = navigator.geolocation.watchPosition(
      (nextPosition) => {
        const next = toMapPoint(nextPosition)

        if (shouldIgnorePositionJitter(lastAcceptedPositionRef.current, next)) {
          setStatus(`記録中 ${formatTime(new Date())}`)
          return
        }

        lastAcceptedPositionRef.current = next
        const cell = cellFromLatLng(next.lat, next.lng)
        const id = cellId(cell)

        setPosition(next)
        setTrail((current) => {
          const prev = getLastItem(current)
          const isDuplicate =
            prev &&
            distanceMeters(prev, next) < MIN_TRAIL_DISTANCE_METERS &&
            Math.abs(new Date(next.recordedAt) - new Date(prev.recordedAt)) < 4000

          if (isDuplicate) return current
          return [...current, next].slice(-MAX_STORED_TRAIL_POINTS)
        })
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
    setStatus('記録を停止しました')
  }

  const clearExploration = () => {
    setVisitedCells({})
    setTrail([])
    setPosition(null)
    lastAcceptedPositionRef.current = null
    setStatus('記録をリセットしました')
  }

  return {
    clearExploration,
    error,
    isTracking,
    mapCenter,
    position,
    startTracking,
    status,
    stopTracking,
    totalDistanceMeters,
    trail,
    visitedCells,
    visitedList,
  }
}
