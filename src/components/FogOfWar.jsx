import { useMemo, useState } from 'react'
import { Rectangle, useMapEvents } from 'react-leaflet'
import { GRID_SIZE_METERS, MAX_FOG_TILES } from '../lib/constants'
import { cellId, latLngToMeters, metersToLatLng } from '../lib/grid'

function snapshotBounds(map) {
  const bounds = map.getBounds()
  return {
    north: bounds.getNorth(),
    south: bounds.getSouth(),
    east: bounds.getEast(),
    west: bounds.getWest(),
    zoom: map.getZoom(),
  }
}

function getFogScale(zoom) {
  if (zoom >= 17) return 1
  if (zoom >= 15) return 2
  if (zoom >= 13) return 4
  if (zoom >= 11) return 8
  if (zoom >= 9) return 16
  return 32
}

function getGridExtent(bounds) {
  const northWest = latLngToMeters(bounds.north, bounds.west)
  const southEast = latLngToMeters(bounds.south, bounds.east)

  return {
    minGridX:
      Math.floor(Math.min(northWest.x, southEast.x) / GRID_SIZE_METERS) - 1,
    maxGridX:
      Math.floor(Math.max(northWest.x, southEast.x) / GRID_SIZE_METERS) + 1,
    minGridY:
      Math.floor(Math.min(northWest.y, southEast.y) / GRID_SIZE_METERS) - 1,
    maxGridY:
      Math.floor(Math.max(northWest.y, southEast.y) / GRID_SIZE_METERS) + 1,
  }
}

function getGroupRange(extent, scale) {
  return {
    minGroupX: Math.floor(extent.minGridX / scale),
    maxGroupX: Math.floor(extent.maxGridX / scale),
    minGroupY: Math.floor(extent.minGridY / scale),
    maxGroupY: Math.floor(extent.maxGridY / scale),
  }
}

function countGroups(range) {
  return (
    (range.maxGroupX - range.minGroupX + 1) *
    (range.maxGroupY - range.minGroupY + 1)
  )
}

function chooseFogGrid(bounds) {
  let scale = getFogScale(bounds.zoom)
  const extent = getGridExtent(bounds)
  let range = getGroupRange(extent, scale)

  while (countGroups(range) > MAX_FOG_TILES) {
    scale *= 2
    range = getGroupRange(extent, scale)
  }

  return { range, scale }
}

function groupBounds(groupX, groupY, scale) {
  const min = metersToLatLng(
    groupX * scale * GRID_SIZE_METERS,
    groupY * scale * GRID_SIZE_METERS,
  )
  const max = metersToLatLng(
    (groupX + 1) * scale * GRID_SIZE_METERS,
    (groupY + 1) * scale * GRID_SIZE_METERS,
  )

  return [
    [min.lat, min.lng],
    [max.lat, max.lng],
  ]
}

function getExploredGroups(visitedCells, range, scale) {
  const exploredGroups = new Set()

  for (const id of Object.keys(visitedCells)) {
    const [gridX, gridY] = id.split(':').map(Number)
    if (!Number.isFinite(gridX) || !Number.isFinite(gridY)) continue

    const groupX = Math.floor(gridX / scale)
    const groupY = Math.floor(gridY / scale)
    if (
      groupX < range.minGroupX ||
      groupX > range.maxGroupX ||
      groupY < range.minGroupY ||
      groupY > range.maxGroupY
    ) {
      continue
    }

    exploredGroups.add(cellId({ gridX: groupX, gridY: groupY }))
  }

  return exploredGroups
}

function buildFogTiles(range, scale, exploredGroups) {
  const tiles = []

  for (let groupX = range.minGroupX; groupX <= range.maxGroupX; groupX += 1) {
    for (let groupY = range.minGroupY; groupY <= range.maxGroupY; groupY += 1) {
      const id = cellId({ gridX: groupX, gridY: groupY })
      if (exploredGroups.has(id)) continue

      tiles.push({
        id: `${id}:${scale}`,
        bounds: groupBounds(groupX, groupY, scale),
      })
    }
  }

  return tiles
}

export function FogOfWar({ enabled, visitedCells }) {
  const map = useMapEvents({
    moveend() {
      setBounds(snapshotBounds(map))
    },
    zoomend() {
      setBounds(snapshotBounds(map))
    },
    resize() {
      setBounds(snapshotBounds(map))
    },
  })
  const [bounds, setBounds] = useState(() => snapshotBounds(map))

  const hiddenCells = useMemo(() => {
    if (!enabled || !bounds) return []

    const { range, scale } = chooseFogGrid(bounds)
    const exploredGroups = getExploredGroups(visitedCells, range, scale)

    return buildFogTiles(range, scale, exploredGroups)
  }, [bounds, enabled, visitedCells])

  if (!enabled) return null

  return hiddenCells.map((cell) => (
    <Rectangle
      key={`fog-${cell.id}`}
      bounds={cell.bounds}
      pathOptions={{
        color: '#cbd5e1',
        weight: 0,
        fillColor: '#e2e8f0',
        fillOpacity: 0.88,
        className: 'fog-cell',
      }}
    />
  ))
}
