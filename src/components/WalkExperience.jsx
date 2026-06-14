import { useState } from 'react'
import { BlackoutMode } from './BlackoutMode'
import { ControlPanel } from './ControlPanel'
import { WalkMap } from './WalkMap'
import { usePersistentFlag } from '../hooks/usePersistentFlag'
import { useWakeLock } from '../hooks/useWakeLock'
import { useWalkRecorder } from '../hooks/useWalkRecorder'
import { FOG_ENABLED_KEY, LOCATION_ICON_ENABLED_KEY } from '../lib/constants'

export function WalkExperience({
  storageScope,
  user,
  authRequired,
  isAuthenticated,
  canSync,
  onSignOut,
}) {
  const recorder = useWalkRecorder({ storageScope, user, canSync })
  const [isBlackout, setIsBlackout] = useState(false)
  const [isFogEnabled, setIsFogEnabled] = usePersistentFlag({
    storageScope,
    key: FOG_ENABLED_KEY,
    defaultValue: true,
  })
  const [isLocationIconEnabled, setIsLocationIconEnabled] = usePersistentFlag({
    storageScope,
    key: LOCATION_ICON_ENABLED_KEY,
    defaultValue: true,
  })
  const wakeLockActive = useWakeLock(recorder.isTracking)

  if (isBlackout) {
    return (
      <BlackoutMode
        isTracking={recorder.isTracking}
        visitedCount={recorder.visitedList.length}
        totalDistanceMeters={recorder.totalDistanceMeters}
        wakeLockActive={wakeLockActive}
        onRestore={() => setIsBlackout(false)}
      />
    )
  }

  return (
    <main className="app-shell">
      <ControlPanel
        user={user}
        authRequired={authRequired}
        isAuthenticated={isAuthenticated}
        status={recorder.status}
        error={recorder.error}
        position={recorder.position}
        visitedCount={recorder.visitedList.length}
        totalDistanceMeters={recorder.totalDistanceMeters}
        isTracking={recorder.isTracking}
        isFogEnabled={isFogEnabled}
        isLocationIconEnabled={isLocationIconEnabled}
        wakeLockActive={wakeLockActive}
        onStartStop={recorder.isTracking ? recorder.stopTracking : recorder.startTracking}
        onBlackout={() => setIsBlackout(true)}
        onToggleFog={() => setIsFogEnabled((current) => !current)}
        onToggleLocationIcon={() => setIsLocationIconEnabled((current) => !current)}
        onClear={recorder.clearExploration}
        onSignOut={onSignOut}
      />
      <WalkMap
        center={recorder.mapCenter}
        position={recorder.position}
        user={user}
        trail={recorder.trail}
        visitedCells={recorder.visitedCells}
        visitedList={recorder.visitedList}
        isFogEnabled={isFogEnabled}
        isLocationIconEnabled={isLocationIconEnabled}
      />
    </main>
  )
}
