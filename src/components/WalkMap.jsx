import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  MapContainer,
  Marker,
  Polyline,
  Rectangle,
  TileLayer,
  useMap,
} from 'react-leaflet'
import L from 'leaflet'
import { FogOfWar } from './FogOfWar'
import { RecenterMap } from './RecenterMap'
import {
  getGeolocationSupportError,
  getLocationErrorMessage,
  requestCurrentPosition,
} from '../lib/geolocation'
import { cellBounds } from '../lib/grid'

const currentLocationIcon = L.divIcon({
  className: 'current-location-marker',
  html: '<span class="current-location-dot" />',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

function getPointSessionId(point) {
  return point?.sessionId ?? 'legacy'
}

function splitTrailIntoSegments(trail) {
  const segments = []
  let currentSegment = []

  for (const point of trail) {
    const previous = currentSegment[currentSegment.length - 1]
    if (previous && getPointSessionId(previous) !== getPointSessionId(point)) {
      if (currentSegment.length > 1) segments.push(currentSegment)
      currentSegment = []
    }

    currentSegment.push(point)
  }

  if (currentSegment.length > 1) segments.push(currentSegment)
  return segments
}

function LocateControl({
  position,
  moveRef,
  onEnableFollow,
  onLocate,
  onLocateError,
}) {
  const map = useMap()

  useEffect(() => {
    const control = L.control({ position: 'bottomright' })
    const supportError = getGeolocationSupportError()
    const canUseGeolocation = !supportError

    control.onAdd = () => {
      const button = L.DomUtil.create('button', 'map-locate-button leaflet-bar')
      button.type = 'button'
      button.textContent = '現在地'
      button.title = canUseGeolocation
        ? '現在地へ移動し、記録中は追従を再開します'
        : supportError
      button.ariaLabel = button.title
      button.disabled = !canUseGeolocation

      L.DomEvent.disableClickPropagation(button)
      L.DomEvent.disableScrollPropagation(button)
      L.DomEvent.on(button, 'click', async (event) => {
        L.DomEvent.preventDefault(event)
        if (!canUseGeolocation) {
          onLocateError(supportError)
          return
        }

        try {
          button.disabled = true
          button.textContent = '取得中'
          const nextPosition = position ?? (await onLocate())
          if (moveRef) moveRef.current = true
          onEnableFollow()

          map.flyTo(
            [nextPosition.lat, nextPosition.lng],
            Math.max(map.getZoom(), 17),
            {
              animate: true,
              duration: 0.6,
            },
          )

          map.once('moveend', () => {
            if (moveRef) moveRef.current = false
          })
        } catch (error) {
          if (moveRef) moveRef.current = false
          onLocateError(getLocationErrorMessage(error))
        } finally {
          button.disabled = false
          button.textContent = '現在地'
        }
      })

      return button
    }

    control.addTo(map)

    return () => {
      control.remove()
    }
  }, [map, moveRef, onEnableFollow, onLocate, onLocateError, position])

  return null
}

export function WalkMap({
  center,
  position,
  trail,
  visitedCells,
  visitedList,
  isFogEnabled,
  isTracking = false,
  isReviewMode = false,
  followToken = 0,
}) {
  const [locatedPosition, setLocatedPosition] = useState(null)
  const [locationError, setLocationError] = useState('')
  const [disabledFollowToken, setDisabledFollowToken] = useState(null)
  const programmaticMoveRef = useRef(false)
  const currentPosition = position ?? locatedPosition
  const trailSegments = useMemo(() => splitTrailIntoSegments(trail), [trail])
  const isFollowing = disabledFollowToken !== followToken

  const handleLocate = useCallback(async () => {
    setLocationError('')
    const nextPosition = await requestCurrentPosition()
    setLocatedPosition(nextPosition)
    return nextPosition
  }, [])

  const handleUserInteraction = useCallback(() => {
    if (isTracking) {
      setDisabledFollowToken(followToken)
    }
  }, [followToken, isTracking])

  return (
    <section className="map-panel">
      <MapContainer
        center={center}
        zoom={17}
        minZoom={4}
        scrollWheelZoom
        className="map-view"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterMap
          center={center}
          enabled={!isReviewMode && isTracking && isFollowing}
          moveRef={programmaticMoveRef}
          onUserInteraction={handleUserInteraction}
        />
        {!isReviewMode ? (
          <LocateControl
            position={currentPosition}
            moveRef={programmaticMoveRef}
            onEnableFollow={() => setDisabledFollowToken(null)}
            onLocate={handleLocate}
            onLocateError={setLocationError}
          />
        ) : null}
        <FogOfWar enabled={!isReviewMode && isFogEnabled} visitedCells={visitedCells} />
        {visitedList.map((cell) => (
          <Rectangle
            key={cell.id}
            bounds={cellBounds(cell)}
            pathOptions={{
              color: isReviewMode ? '#2563eb' : '#f97316',
              weight: 1,
              fillColor: isReviewMode ? '#60a5fa' : '#fb923c',
              fillOpacity: 0.38,
            }}
          />
        ))}
        {trailSegments.map((segment) => (
          <Polyline
            key={`${segment[0].recordedAt}-${segment[segment.length - 1].recordedAt}`}
            positions={segment.map((point) => [point.lat, point.lng])}
            pathOptions={{
              color: isReviewMode ? '#1d4ed8' : '#0f172a',
              weight: isReviewMode ? 5 : 4,
              opacity: 0.75,
            }}
          />
        ))}
        {currentPosition && !isReviewMode ? (
          <Marker
            position={[currentPosition.lat, currentPosition.lng]}
            icon={currentLocationIcon}
            zIndexOffset={1000}
          />
        ) : null}
      </MapContainer>
      {locationError ? (
        <p className="map-location-error" role="alert">
          {locationError}
        </p>
      ) : null}
    </section>
  )
}
