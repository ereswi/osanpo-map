export function BlackoutMode({
  isTracking,
  visitedCount,
  totalDistanceMeters,
  wakeLockActive,
  onRestore,
}) {
  return (
    <main
      className="blackout"
      onClick={onRestore}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          onRestore()
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="blackout__content">
        <p className="blackout__label">散歩記録モード</p>
        <h1>画面を見ずに記録中</h1>
        <p>{isTracking ? '位置追跡を継続しています' : '記録は停止中です'}</p>
        <div className="blackout__stats">
          <span>{visitedCount} グリッド</span>
          <span>{(totalDistanceMeters / 1000).toFixed(2)} km</span>
          <span>{wakeLockActive ? 'スリープ防止中' : '通常画面制御'}</span>
        </div>
        <p className="blackout__hint">タップすると地図に戻ります</p>
      </div>
    </main>
  )
}
