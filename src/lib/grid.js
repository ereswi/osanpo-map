import { GRID_SIZE_METERS } from './constants'

export function latLngToMeters(lat, lng) {
  const originShift = 20037508.34
  const x = (lng * originShift) / 180
  let y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)
  y = (y * originShift) / 180
  return { x, y }
}

export function metersToLatLng(x, y) {
  const originShift = 20037508.34
  const lng = (x / originShift) * 180
  let lat = (y / originShift) * 180
  lat =
    (180 / Math.PI) *
    (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2)

  return { lat, lng }
}

export function cellFromLatLng(lat, lng) {
  const point = latLngToMeters(lat, lng)
  return {
    gridX: Math.floor(point.x / GRID_SIZE_METERS),
    gridY: Math.floor(point.y / GRID_SIZE_METERS),
  }
}

export function cellId(cell) {
  return `${cell.gridX}:${cell.gridY}`
}

export function cellBounds(cell) {
  const min = metersToLatLng(
    cell.gridX * GRID_SIZE_METERS,
    cell.gridY * GRID_SIZE_METERS,
  )
  const max = metersToLatLng(
    (cell.gridX + 1) * GRID_SIZE_METERS,
    (cell.gridY + 1) * GRID_SIZE_METERS,
  )

  return [
    [min.lat, min.lng],
    [max.lat, max.lng],
  ]
}
