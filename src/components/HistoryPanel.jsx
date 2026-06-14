function formatSessionDate(value) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDuration(startedAt, endedAt) {
  const started = Date.parse(startedAt)
  const ended = Date.parse(endedAt)
  if (Number.isNaN(started) || Number.isNaN(ended) || ended < started) {
    return '0分'
  }

  const totalMinutes = Math.max(1, Math.round((ended - started) / 60000))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes}分`
  if (minutes === 0) return `${hours}時間`
  return `${hours}時間${minutes}分`
}

export function HistoryPanel({
  sessions,
  selectedSessionId,
  onBackToMap,
  onSelectSession,
}) {
  const selectedSession = sessions.find((session) => session.id === selectedSessionId)

  return (
    <section className="history-panel">
      <div className="history-heading">
        <div>
          <p className="eyebrow">Walk History</p>
          <h1>散歩履歴</h1>
        </div>
        <button type="button" className="ghost-button" onClick={onBackToMap}>
          地図へ戻る
        </button>
      </div>

      {sessions.length === 0 ? (
        <div className="history-empty">
          <strong>まだ履歴がありません</strong>
          <p>記録を開始して停止すると、1回分の散歩がここに保存されます。</p>
        </div>
      ) : (
        <div className="history-list">
          {sessions.map((session) => {
            const isSelected = session.id === selectedSessionId
            return (
              <button
                key={session.id}
                type="button"
                className={`history-card${isSelected ? ' is-selected' : ''}`}
                onClick={() => onSelectSession(session.id)}
              >
                <span className="history-card__date">
                  {formatSessionDate(session.startedAt)}
                </span>
                <strong>{(session.distanceMeters / 1000).toFixed(2)} km</strong>
                <span>{formatDuration(session.startedAt, session.endedAt)}</span>
                <dl>
                  <div>
                    <dt>訪問</dt>
                    <dd>{session.visitedCellIds.length}</dd>
                  </div>
                  <div>
                    <dt>新規</dt>
                    <dd>{session.newVisitedCellIds.length}</dd>
                  </div>
                  <div>
                    <dt>測位</dt>
                    <dd>{session.pointCount}</dd>
                  </div>
                </dl>
              </button>
            )
          })}
        </div>
      )}

      {selectedSession ? (
        <p className="history-selection-note">
          選択中: {formatSessionDate(selectedSession.startedAt)} の記録だけを右の地図に表示しています。
        </p>
      ) : null}
    </section>
  )
}
