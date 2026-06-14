import { useEffect } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'

export function RecenterMap({
  center,
  enabled = true,
  moveRef,
  onUserInteraction,
}) {
  const map = useMap()

  useMapEvents({
    dragstart() {
      if (!moveRef?.current) onUserInteraction?.()
    },
    zoomstart() {
      if (!moveRef?.current) onUserInteraction?.()
    },
  })

  useEffect(() => {
    if (!enabled) return

    if (moveRef) {
      moveRef.current = true
    }

    map.flyTo(center, Math.max(map.getZoom(), 17), {
      animate: true,
      duration: 0.75,
    })

    const clearProgrammaticMove = () => {
      if (moveRef) {
        moveRef.current = false
      }
    }

    map.once('moveend', clearProgrammaticMove)

    return () => {
      map.off('moveend', clearProgrammaticMove)
      clearProgrammaticMove()
    }
  }, [center, enabled, map, moveRef])

  return null
}
