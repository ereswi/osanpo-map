import { useEffect } from 'react'
import { useMap } from 'react-leaflet'

export function RecenterMap({ center }) {
  const map = useMap()

  useEffect(() => {
    map.flyTo(center, Math.max(map.getZoom(), 17), {
      animate: true,
      duration: 0.75,
    })
  }, [center, map])

  return null
}
