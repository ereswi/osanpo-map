import { useMemo, useState } from 'react'
import { BlackoutMode } from './BlackoutMode'
import { ControlPanel } from './ControlPanel'
import { HistoryPanel } from './HistoryPanel'
import { WalkMap } from './WalkMap'
import { usePersistentFlag } from '../hooks/usePersistentFlag'
import { useWakeLock } from '../hooks/useWakeLock'
import { useWalkRecorder } from '../hooks/useWalkRecorder'
import { FOG_ENABLED_KEY } from '../lib/constants'

function getSessionCenter(session, fallbackCenter) {
  const firstPoint = session?.trail?.[0]
  if (firstPoint) return [firstPoint.lat, firstPoint.lng]
  return fallbackCenter
}

function buildSessionVisitedList(session, visitedCells) {
  if (!session) return []

  return session.visitedCellIds
    .map((id) => {
      const cell = visitedCells[id]
      return cell ? { id, ...cell } : null
    })
    .filter(Boolean)
}

function buildVisitedCellMap(visitedList) {
  return Object.fromEntries(visitedList.map((cell) => [cell.id, cell]))
}

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
  const [view, setView] = useState('map')
  const [selectedSessionId, setSelectedSessionId] = useState('')
  const [followToken, setFollowToken] = useState(0)
  const [isFogEnabled, setIsFogEnabled] = usePersistentFlag({
    storageScope,
    key: FOG_ENABLED_KEY,
    defaultValue: true,
  })
  const wakeLockActive = useWakeLock(recorder.isTracking)
  const selectedSession = useMemo(() => {
    if (selectedSessionId) {
      return recorder.sessions.find((session) => session.id === selectedSessionId)
    }

    return recorder.sessions[0] ?? null
  }, [recorder.sessions, selectedSessionId])
  const sessionVisitedList = useMemo(
    () => buildSessionVisitedList(selectedSession, recorder.visitedCells),
    [recorder.visitedCells, selectedSession],
  )
  const sessionVisitedCells = useMemo(
    () => buildVisitedCellMap(sessionVisitedList),
    [sessionVisitedList],
  )

  const openHistory = () => {
    setSelectedSessionId((current) => current || recorder.sessions[0]?.id || '')
    setView('history')
  }

  const handleStartStop = () => {
    if (recorder.isTracking) {
      recorder.stopTracking()
      return
    }

    setFollowToken((current) => current + 1)
    recorder.startTracking()
  }

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

  if (view === 'history') {
    return (
      <main className="app-shell">
        <HistoryPanel
          sessions={recorder.sessions}
          selectedSessionId={selectedSession?.id ?? ''}
          onBackToMap={() => setView('map')}
          onSelectSession={setSelectedSessionId}
        />
        <WalkMap
          center={getSessionCenter(selectedSession, recorder.mapCenter)}
          position={null}
          trail={selectedSession?.trail ?? []}
          visitedCells={sessionVisitedCells}
          visitedList={sessionVisitedList}
          isFogEnabled={false}
          isReviewMode
        />
      </main>
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
        syncError={recorder.syncError}
        syncStatus={recorder.syncStatus}
        position={recorder.position}
        visitedCount={recorder.visitedList.length}
        totalDistanceMeters={recorder.totalDistanceMeters}
        isTracking={recorder.isTracking}
        isFogEnabled={isFogEnabled}
        wakeLockActive={wakeLockActive}
        onStartStop={handleStartStop}
        onBlackout={() => setIsBlackout(true)}
        onToggleFog={() => setIsFogEnabled((current) => !current)}
        onOpenHistory={openHistory}
        onClear={recorder.clearExploration}
        onSignOut={onSignOut}
      />
      <WalkMap
        center={recorder.mapCenter}
        position={recorder.position}
        trail={recorder.trail}
        visitedCells={recorder.visitedCells}
        visitedList={recorder.visitedList}
        isFogEnabled={isFogEnabled}
        isTracking={recorder.isTracking}
        followToken={followToken}
      />
    </main>
  )
}
