import { useCallback, useEffect, useState } from 'react'
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getUserInitial(user) {
  const source = user?.displayName || user?.email || 'U'
  return source.trim().charAt(0).toUpperCase()
}

function createCurrentLocationIcon(user) {
  const photoUrl = user?.photoURL
  const content = photoUrl
    ? `<span class="walker-avatar-ring"><img src="${escapeHtml(photoUrl)}" alt="" referrerpolicy="no-referrer" /></span>`
    : `<span class="walker-avatar-ring walker-avatar-fallback">${escapeHtml(getUserInitial(user))}</span>`

  return L.divIcon({
    className: 'walker-avatar-marker',
    html: content,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function LocateControl({ position, onLocate, onLocateError }) {
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
        ? '現在地へ移動します。未取得の場合は位置情報の許可を求めます。'
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

          map.flyTo(
            [nextPosition.lat, nextPosition.lng],
            Math.max(map.getZoom(), 17),
            {
              animate: true,
              duration: 0.6,
            },
          )
        } catch (error) {
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
  }, [map, onLocate, onLocateError, position])

  return null
}

export function WalkMap({
  center,
  position,
  user,
  trail,
  visitedCells,
  visitedList,
  isFogEnabled,
  isLocationIconEnabled,
}) {
  const [locatedPosition, setLocatedPosition] = useState(null)
  const [locationError, setLocationError] = useState('')
  const currentPosition = position ?? locatedPosition
  const currentLocationIcon = createCurrentLocationIcon(user)

  const handleLocate = useCallback(async () => {
    setLocationError('')
    const nextPosition = await requestCurrentPosition()
    setLocatedPosition(nextPosition)
    return nextPosition
  }, [])

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
        <RecenterMap center={center} />
        <LocateControl
          position={currentPosition}
          onLocate={handleLocate}
          onLocateError={setLocationError}
        />
        <FogOfWar enabled={isFogEnabled} visitedCells={visitedCells} />
        {visitedList.map((cell) => (
          <Rectangle
            key={cell.id}
            bounds={cellBounds(cell)}
            pathOptions={{
              color: '#f97316',
              weight: 1,
              fillColor: '#fb923c',
              fillOpacity: 0.38,
            }}
          />
        ))}
        {trail.length > 1 ? (
          <Polyline
            positions={trail.map((point) => [point.lat, point.lng])}
            pathOptions={{ color: '#0f172a', weight: 4, opacity: 0.75 }}
          />
        ) : null}
        {currentPosition && isLocationIconEnabled ? (
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
